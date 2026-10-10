import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ApiError } from '@/core/http/apiClient';
import { FilterChips } from '@/components/ui/FilterChips';
import { Card, Section } from '@/components/ui/Section';
import type { Product } from '@/features/catalog/api';
import { useProductList, useProductsByIds, useUomMap } from '@/features/catalog/hooks';
import { TYPE_LABEL } from '@/features/catalog/labels';
import { fechaMasDias, type PrioridadOrden } from '@/features/production/api';
import { useCrearJornada } from '@/features/production/hooks';
import { num } from '@/features/production/labels';

const PRIORIDADES: { key: PrioridadOrden; label: string }[] = [
  { key: 'Alta', label: 'Alta' },
  { key: 'Media', label: 'Media' },
  { key: 'Baja', label: 'Baja' },
];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

interface Linea {
  producto: Product;
  cantidad: string;
}

/**
 * Nueva jornada de producción (Sprint 15): varios productos del mismo día de
 * planta. Se crea una orden por producto (con su receta copiada); luego se
 * reservan e inician juntas desde la jornada. Muestra el total de materias
 * primas que va a necesitar la jornada.
 */
export default function NuevaJornadaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const crear = useCrearJornada();
  const { map: uoms } = useUomMap();

  const [lineas, setLineas] = useState<Linea[]>([]);
  const [agregando, setAgregando] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [fecha, setFecha] = useState(fechaMasDias(0));
  const [prioridad, setPrioridad] = useState<PrioridadOrden>('Media');
  const [notas, setNotas] = useState('');

  const productosQ = useProductList(['Active'], true, ['FinishedGood', 'SemiFinished']);
  const candidatos = useMemo(() => {
    const usados = new Set(lineas.map((l) => l.producto.id));
    const t = filtro.trim().toLowerCase();
    return (productosQ.data?.pages.flatMap((p) => p.items) ?? []).filter(
      (p) => p.components.length > 0 && !usados.has(p.id) && (!t || `${p.name} ${p.code}`.toLowerCase().includes(t)),
    );
  }, [productosQ.data, lineas, filtro]);

  const cantidades = lineas.map((l) => Number(l.cantidad.replace(',', '.')));

  // Total de materias primas de la jornada (receta × cantidad, sumado entre productos)
  const totales = useMemo(() => {
    const m = new Map<string, { productId: string; uomId: string; cantidad: number }>();
    lineas.forEach((l, i) => {
      const n = cantidades[i]!;
      if (!(Number.isFinite(n) && n > 0)) return;
      for (const c of l.producto.components) {
        const k = `${c.componentProductId}|${c.uomId}`;
        const prev = m.get(k) ?? { productId: c.componentProductId, uomId: c.uomId, cantidad: 0 };
        prev.cantidad = Math.round((prev.cantidad + c.quantity * n) * 1e6) / 1e6;
        m.set(k, prev);
      }
    });
    return Array.from(m.values());
  }, [lineas, cantidades]);
  const compQueries = useProductsByIds([...new Set(totales.map((t) => t.productId))]);
  const nombreDe = (id: string) => compQueries.find((q) => q.data?.id === id)?.data?.name ?? '…';

  const faltan: string[] = [];
  if (lineas.length === 0) faltan.push('al menos un producto');
  const sinCantidad = lineas.filter((_, i) => !(Number.isFinite(cantidades[i]) && cantidades[i]! > 0)).map((l) => l.producto.name);
  if (sinCantidad.length) faltan.push(`cantidad de ${sinCantidad.join(', ')}`);
  if (!FECHA.test(fecha)) faltan.push('fecha AAAA-MM-DD');
  const listo = faltan.length === 0 && !crear.isPending;

  const agregar = (p: Product) => {
    setLineas((ls) => [...ls, { producto: p, cantidad: '' }]);
    setAgregando(false);
    setFiltro('');
  };

  const enviar = () =>
    crear.mutate(
      {
        lineas: lineas.map((l, i) => ({ productoTerminadoId: l.producto.id, cantidadObjetivo: cantidades[i]! })),
        prioridad,
        fechaProgramada: fecha,
        notas: notas.trim() || undefined,
      },
      {
        onSuccess: (j) => router.replace({ pathname: '/(app)/produccion/jornada/[codigo]', params: { codigo: j.codigo } }),
        onError: (e) => Alert.alert('No se pudo crear la jornada', (e as unknown as ApiError).message),
      },
    );

  return (
    <>
      <Stack.Screen options={{ title: 'Nueva jornada' }} />
      <KeyboardAvoidingView className="flex-1 bg-snow" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="p-5 pb-8" keyboardShouldPersistTaps="handled">
          <Section title={`1. Productos (${lineas.length})`}>
            <View className="gap-3">
              {lineas.map((l, i) => (
                <Card key={l.producto.id}>
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-graphite-900">{l.producto.name}</Text>
                      <Text className="text-xs text-graphite-400">
                        {l.producto.code} · receta con {l.producto.components.length} materia(s) prima(s)
                      </Text>
                    </View>
                    <Pressable accessibilityRole="button" onPress={() => setLineas((ls) => ls.filter((_, j) => j !== i))} disabled={crear.isPending}>
                      <Text className="text-sm font-medium text-danger">Quitar</Text>
                    </Pressable>
                  </View>
                  <TextInput
                    value={l.cantidad}
                    onChangeText={(t) => setLineas((ls) => ls.map((x, j) => (j === i ? { ...x, cantidad: t.replace(/[^0-9.,]/g, '') } : x)))}
                    keyboardType="decimal-pad"
                    placeholder="Unidades a producir"
                    placeholderTextColor="#8295A3"
                    editable={!crear.isPending}
                    className="mt-3 min-h-11 rounded-xl border border-ice-100 bg-snow px-3 text-lg font-semibold text-graphite-900"
                  />
                </Card>
              ))}
            </View>

            {agregando ? (
              <View className="mt-3 gap-2 rounded-2xl border border-frost-700 bg-white p-3">
                <TextInput
                  value={filtro}
                  onChangeText={setFiltro}
                  placeholder="Buscar producto con receta"
                  placeholderTextColor="#8295A3"
                  autoCorrect={false}
                  className="min-h-11 rounded-xl border border-ice-100 bg-snow px-3 text-base text-graphite-900"
                />
                {productosQ.isLoading ? (
                  <ActivityIndicator color="#0B3A53" />
                ) : candidatos.length === 0 ? (
                  <Text className="text-sm text-graphite-600">No hay más productos activos con receta. La receta se define en Catálogo.</Text>
                ) : (
                  candidatos.slice(0, 30).map((p) => (
                    <Pressable key={p.id} accessibilityRole="button" onPress={() => agregar(p)} className="rounded-xl border border-ice-100 p-3 active:bg-ice-50">
                      <Text className="text-sm font-semibold text-graphite-900">{p.name}</Text>
                      <Text className="text-xs text-graphite-400">
                        {p.code} · {TYPE_LABEL[p.type]}
                      </Text>
                    </Pressable>
                  ))
                )}
                {productosQ.hasNextPage ? (
                  <Pressable accessibilityRole="button" onPress={() => void productosQ.fetchNextPage()} className="min-h-10 items-center justify-center">
                    <Text className="text-sm font-medium text-frost-900">{productosQ.isFetchingNextPage ? 'Cargando…' : 'Ver más'}</Text>
                  </Pressable>
                ) : null}
                {lineas.length > 0 ? (
                  <Pressable accessibilityRole="button" onPress={() => setAgregando(false)} className="min-h-10 items-center justify-center">
                    <Text className="text-sm font-medium text-graphite-600">Cerrar</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => setAgregando(true)}
                disabled={crear.isPending}
                className="mt-3 min-h-11 items-center justify-center rounded-2xl border border-frost-700 bg-white"
              >
                <Text className="text-sm font-semibold text-frost-900">+ Agregar producto</Text>
              </Pressable>
            )}
          </Section>

          {totales.length > 0 ? (
            <Section title="Materias primas que necesita la jornada">
              <Card>
                {totales.map((t) => (
                  <View key={`${t.productId}|${t.uomId}`} className="flex-row justify-between py-1">
                    <Text className="flex-1 pr-3 text-sm text-graphite-600">{nombreDe(t.productId)}</Text>
                    <Text className="text-sm font-semibold text-graphite-900">
                      {num(t.cantidad)} {uoms.get(t.uomId)?.symbol ?? ''}
                    </Text>
                  </View>
                ))}
                <Text className="mt-2 text-xs text-graphite-400">Se reservan al tocar “Reservar todo” en la jornada.</Text>
              </Card>
            </Section>
          ) : null}

          <Section title="2. Fecha">
            <TextInput
              value={fecha}
              onChangeText={(t) => setFecha(t.replace(/[^0-9-]/g, '').slice(0, 10))}
              placeholder="AAAA-MM-DD"
              placeholderTextColor="#8295A3"
              keyboardType="numbers-and-punctuation"
              editable={!crear.isPending}
              className="min-h-12 rounded-2xl border border-ice-100 bg-white px-4 text-base text-graphite-900"
            />
          </Section>

          <Section title="3. Prioridad">
            <FilterChips options={PRIORIDADES} value={prioridad} onChange={setPrioridad} small />
          </Section>

          <Section title="4. Notas (opcional)">
            <TextInput
              value={notas}
              onChangeText={setNotas}
              placeholder="Ej.: pedido grande de La quesita"
              placeholderTextColor="#8295A3"
              multiline
              maxLength={1000}
              editable={!crear.isPending}
              className="min-h-20 rounded-2xl border border-ice-100 bg-white px-4 py-3 text-base text-graphite-900"
            />
          </Section>
        </ScrollView>

        <View className="border-t border-ice-100 bg-white px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 12) + 12 }}>
          {faltan.length > 0 ? <Text className="mb-2 text-xs text-graphite-400">Falta: {faltan.join('; ')}.</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={!listo}
            onPress={enviar}
            className={`min-h-12 items-center justify-center rounded-2xl ${listo ? 'bg-frost-900' : 'bg-graphite-400/40'}`}
          >
            {crear.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-base font-semibold text-white">Crear jornada{lineas.length > 1 ? ` (${lineas.length} productos)` : ''}</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
