import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ApiError } from '@/core/http/apiClient';
import { FilterChips } from '@/components/ui/FilterChips';
import { Card, Section } from '@/components/ui/Section';
import type { Product } from '@/features/catalog/api';
import { useGuardarReceta, useProduct, useProductList, useProductsByIds, useUomList } from '@/features/catalog/hooks';
import { TYPE_LABEL } from '@/features/catalog/labels';

interface Fila {
  productId: string;
  nombre: string;
  codigo: string;
  /** Dimensión de la unidad del componente (masa, volumen…): limita las unidades ofrecidas. */
  unidadBase: string;
  cantidad: string;
  uomId: string;
}

/**
 * Receta / lista de materiales (Sprint 14). Cantidades POR UNIDAD del producto:
 * al crear una orden de producción se multiplican por la cantidad a producir.
 * Se guarda la lista completa (reemplaza la anterior). Componentes: materias
 * primas y semielaborados activos; el backend rechaza ciclos y descontinuados.
 */
export default function RecetaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const product = useProduct(id ?? '');
  const guardar = useGuardarReceta(id ?? '');
  const { list: unidades, isLoading: cargandoUom } = useUomList();
  const p = product.data;

  const [filas, setFilas] = useState<Fila[]>([]);
  const [version, setVersion] = useState<number | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [filtro, setFiltro] = useState('');

  // Componentes actuales: nombre y unidad de cada uno
  const actuales = useMemo(() => (p ? [...p.components].sort((a, b) => a.position - b.position) : []), [p]);
  const compQueries = useProductsByIds(actuales.map((c) => c.componentProductId));
  const compListos = compQueries.every((q) => !!q.data || q.isError);
  const dimension = useMemo(() => new Map(unidades.map((u) => [u.id, u.dimension])), [unidades]);

  useEffect(() => {
    if (!p || version !== null || !compListos || cargandoUom) return;
    setFilas(
      actuales.map((c, i) => {
        const comp = compQueries[i]?.data;
        return {
          productId: c.componentProductId,
          nombre: comp?.name ?? 'Producto no disponible',
          codigo: comp?.code ?? '',
          unidadBase: comp ? (dimension.get(comp.unitOfSaleId) ?? '') : '',
          cantidad: String(c.quantity),
          uomId: c.uomId,
        };
      }),
    );
    setVersion(p.version);
  }, [p, version, compListos, actuales, compQueries, cargandoUom, dimension]);

  // Candidatos para agregar
  const candidatosQ = useProductList(['Active'], agregando, ['RawMaterial', 'SemiFinished']);
  const candidatos = useMemo(() => {
    const usados = new Set(filas.map((f) => f.productId));
    const t = filtro.trim().toLowerCase();
    return (candidatosQ.data?.pages.flatMap((pg) => pg.items) ?? []).filter(
      (c) => c.id !== id && !usados.has(c.id) && (!t || `${c.name} ${c.code}`.toLowerCase().includes(t)),
    );
  }, [candidatosQ.data, filas, filtro, id]);

  const agregar = (c: Product) => {
    setFilas((f) => [
      ...f,
      { productId: c.id, nombre: c.name, codigo: c.code, unidadBase: dimension.get(c.unitOfSaleId) ?? '', cantidad: '', uomId: c.unitOfSaleId },
    ]);
    setAgregando(false);
    setFiltro('');
  };
  const cambiar = (i: number, cambio: Partial<Fila>) => setFilas((f) => f.map((x, j) => (j === i ? { ...x, ...cambio } : x)));
  const quitar = (i: number) => setFilas((f) => f.filter((_, j) => j !== i));

  const cantidades = filas.map((f) => Number(f.cantidad.replace(',', '.')));
  const invalidas = filas.filter((_, i) => !(Number.isFinite(cantidades[i]) && cantidades[i]! > 0)).map((f) => f.nombre);
  const cargado = !!p && version !== null;
  const listo = cargado && invalidas.length === 0 && !guardar.isPending;

  const enviar = () => {
    if (version === null || !p) return;
    const hacer = () =>
      guardar.mutate(
        {
          version,
          components: filas.map((f, i) => ({ componentProductId: f.productId, quantity: cantidades[i]!, uomId: f.uomId, position: i })),
        },
        {
          onSuccess: () => {
            Alert.alert('Receta guardada', filas.length ? `${p.name}: ${filas.length} componente(s).` : `${p.name} quedó sin receta.`);
            router.back();
          },
          onError: (e) => {
            const err = e as unknown as ApiError;
            Alert.alert(err.code === 'product.version_conflict' ? 'El producto cambió' : 'No se pudo guardar', err.message);
          },
        },
      );
    if (filas.length === 0 && actuales.length > 0) {
      Alert.alert('Quitar la receta', 'Sin receta no se pueden crear órdenes de producción de este producto.', [
        { text: 'Volver', style: 'cancel' },
        { text: 'Quitar', style: 'destructive', onPress: hacer },
      ]);
    } else {
      hacer();
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Receta' }} />
      <KeyboardAvoidingView className="flex-1 bg-snow" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="p-5 pb-8" keyboardShouldPersistTaps="handled">
          {!cargado ? <ActivityIndicator className="mt-10" color="#0B3A53" /> : null}
          {p && cargado ? (
            <>
              <Text className="text-xl font-bold text-graphite-900">{p.name}</Text>
              <Text className="mt-1 text-xs text-graphite-400">Cantidades para producir UNA unidad de este producto.</Text>

              <Section title={`Componentes (${filas.length})`}>
                {filas.length === 0 ? <Text className="text-sm text-graphite-600">Sin componentes.</Text> : null}
                <View className="gap-3">
                  {filas.map((f, i) => {
                    const opciones = unidades.filter((u) => !f.unidadBase || u.dimension === f.unidadBase || u.id === f.uomId);
                    return (
                      <Card key={f.productId}>
                        <View className="flex-row items-start justify-between gap-3">
                          <View className="flex-1">
                            <Text className="text-base font-semibold text-graphite-900">{f.nombre}</Text>
                            <Text className="text-xs text-graphite-400">{f.codigo}</Text>
                          </View>
                          <Pressable accessibilityRole="button" onPress={() => quitar(i)} disabled={guardar.isPending}>
                            <Text className="text-sm font-medium text-danger">Quitar</Text>
                          </Pressable>
                        </View>
                        <TextInput
                          value={f.cantidad}
                          onChangeText={(t) => cambiar(i, { cantidad: t.replace(/[^0-9.,]/g, '') })}
                          keyboardType="decimal-pad"
                          placeholder="Cantidad por unidad"
                          placeholderTextColor="#8295A3"
                          editable={!guardar.isPending}
                          className="mt-3 min-h-11 rounded-xl border border-ice-100 bg-snow px-3 text-base font-semibold text-graphite-900"
                        />
                        <View className="mt-2">
                          <FilterChips
                            options={opciones.map((u) => ({ key: u.id, label: u.symbol }))}
                            value={f.uomId}
                            onChange={(uomId) => cambiar(i, { uomId })}
                            small
                          />
                        </View>
                      </Card>
                    );
                  })}
                </View>

                {agregando ? (
                  <View className="mt-3 gap-2 rounded-2xl border border-frost-700 bg-white p-3">
                    <TextInput
                      value={filtro}
                      onChangeText={setFiltro}
                      placeholder="Buscar materia prima o semielaborado"
                      placeholderTextColor="#8295A3"
                      autoFocus
                      autoCorrect={false}
                      className="min-h-11 rounded-xl border border-ice-100 bg-snow px-3 text-base text-graphite-900"
                    />
                    {candidatosQ.isLoading ? (
                      <ActivityIndicator color="#0B3A53" />
                    ) : candidatos.length === 0 ? (
                      <Text className="text-sm text-graphite-600">No hay más productos activos que coincidan.</Text>
                    ) : (
                      candidatos.slice(0, 30).map((c) => (
                        <Pressable key={c.id} accessibilityRole="button" onPress={() => agregar(c)} className="rounded-xl border border-ice-100 p-3 active:bg-ice-50">
                          <Text className="text-sm font-semibold text-graphite-900">{c.name}</Text>
                          <Text className="text-xs text-graphite-400">
                            {c.code} · {TYPE_LABEL[c.type]}
                          </Text>
                        </Pressable>
                      ))
                    )}
                    {candidatosQ.hasNextPage ? (
                      <Pressable accessibilityRole="button" onPress={() => void candidatosQ.fetchNextPage()} className="min-h-10 items-center justify-center">
                        <Text className="text-sm font-medium text-frost-900">{candidatosQ.isFetchingNextPage ? 'Cargando…' : 'Ver más'}</Text>
                      </Pressable>
                    ) : null}
                    <Pressable accessibilityRole="button" onPress={() => setAgregando(false)} className="min-h-10 items-center justify-center">
                      <Text className="text-sm font-medium text-graphite-600">Cerrar</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setAgregando(true)}
                    disabled={guardar.isPending}
                    className="mt-3 min-h-11 items-center justify-center rounded-2xl border border-frost-700 bg-white"
                  >
                    <Text className="text-sm font-semibold text-frost-900">+ Agregar componente</Text>
                  </Pressable>
                )}
              </Section>
            </>
          ) : null}
        </ScrollView>

        <View className="border-t border-ice-100 bg-white px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 12) + 12 }}>
          {cargado && invalidas.length > 0 ? <Text className="mb-2 text-xs text-graphite-400">Falta la cantidad de: {invalidas.join(', ')}.</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={!listo}
            onPress={enviar}
            className={`min-h-12 items-center justify-center rounded-2xl ${listo ? 'bg-frost-900' : 'bg-graphite-400/40'}`}
          >
            {guardar.isPending ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-base font-semibold text-white">Guardar receta</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
