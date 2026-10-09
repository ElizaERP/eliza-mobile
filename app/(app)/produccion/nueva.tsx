import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ApiError } from '@/core/http/apiClient';
import { FilterChips } from '@/components/ui/FilterChips';
import { Card, Section } from '@/components/ui/Section';
import type { Product } from '@/features/catalog/api';
import { useProductList } from '@/features/catalog/hooks';
import { nuevoCodigoOrden, type PrioridadOrden } from '@/features/production/api';
import { useCrearOrden } from '@/features/production/hooks';

const PRIORIDADES: { key: PrioridadOrden; label: string }[] = [
  { key: 'Alta', label: 'Alta' },
  { key: 'Media', label: 'Media' },
  { key: 'Baja', label: 'Baja' },
];

/**
 * Nueva orden de producción (Sprint 12). Solo productos terminados activos con receta (BOM):
 * al crearla, el backend copia la receta en la orden con las cantidades × objetivo.
 */
export default function NuevaOrdenScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const crear = useCrearOrden();
  const [producto, setProducto] = useState<Product | null>(null);
  const [cantidad, setCantidad] = useState('');
  const [prioridad, setPrioridad] = useState<PrioridadOrden>('Media');
  const [notas, setNotas] = useState('');

  const products = useProductList(['Active'], true, ['FinishedGood']);
  const conReceta = useMemo(
    () => (products.data?.pages.flatMap((p) => p.items) ?? []).filter((p) => p.components.length > 0),
    [products.data],
  );
  const n = Number(cantidad.replace(',', '.'));
  const listo = !!producto && Number.isFinite(n) && n > 0 && !crear.isPending;

  const enviar = () => {
    if (!producto) return;
    crear.mutate(
      {
        codigo: nuevoCodigoOrden(),
        productoTerminadoId: producto.id,
        cantidadObjetivo: n,
        prioridad,
        notas: notas.trim() || undefined,
      },
      {
        onSuccess: (o) => router.replace({ pathname: '/(app)/produccion/[id]', params: { id: o.id } }),
        onError: (e) => Alert.alert('No se pudo crear la orden', (e as unknown as ApiError).message),
      },
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Nueva orden' }} />
      <KeyboardAvoidingView className="flex-1 bg-snow" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="p-5 pb-8" keyboardShouldPersistTaps="handled">
          <Section title="1. Producto">
            {producto ? (
              <Card>
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-graphite-900">{producto.name}</Text>
                    <Text className="mt-1 text-xs text-graphite-400">
                      {producto.code} · receta con {producto.components.length} materia(s) prima(s)
                    </Text>
                  </View>
                  <Pressable accessibilityRole="button" onPress={() => setProducto(null)} disabled={crear.isPending}>
                    <Text className="text-sm font-medium text-frost-700">Cambiar</Text>
                  </Pressable>
                </View>
              </Card>
            ) : products.isLoading ? (
              <ActivityIndicator color="#0B3A53" />
            ) : conReceta.length === 0 ? (
              <Text className="text-sm text-graphite-600">No hay productos terminados activos con receta. La receta se define en Catálogo.</Text>
            ) : (
              <View className="gap-2">
                {conReceta.map((p) => (
                  <Pressable
                    key={p.id}
                    accessibilityRole="button"
                    onPress={() => setProducto(p)}
                    className="rounded-2xl border border-ice-100 bg-white p-4 active:bg-ice-50"
                  >
                    <Text className="text-base font-semibold text-graphite-900">{p.name}</Text>
                    <Text className="mt-1 text-xs text-graphite-400">
                      {p.code} · {p.components.length} materia(s) prima(s)
                    </Text>
                  </Pressable>
                ))}
                {products.hasNextPage ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void products.fetchNextPage()}
                    className="min-h-10 items-center justify-center rounded-full border border-ice-100 bg-white"
                  >
                    <Text className="text-sm font-medium text-frost-900">{products.isFetchingNextPage ? 'Cargando…' : 'Ver más productos'}</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </Section>

          <Section title="2. Cantidad a producir">
            <TextInput
              value={cantidad}
              onChangeText={(t) => setCantidad(t.replace(/[^0-9.,]/g, ''))}
              placeholder="Ej.: 500"
              placeholderTextColor="#8295A3"
              keyboardType="decimal-pad"
              editable={!crear.isPending}
              className="min-h-12 rounded-2xl border border-ice-100 bg-white px-4 text-lg font-semibold text-graphite-900"
            />
            <Text className="mt-1 text-xs text-graphite-400">Unidades de producto terminado. Las materias primas se calculan con la receta.</Text>
          </Section>

          <Section title="3. Prioridad">
            <FilterChips options={PRIORIDADES} value={prioridad} onChange={setPrioridad} small />
          </Section>

          <Section title="4. Notas (opcional)">
            <TextInput
              value={notas}
              onChangeText={setNotas}
              placeholder="Ej.: para el pedido de La quesita"
              placeholderTextColor="#8295A3"
              multiline
              maxLength={1000}
              editable={!crear.isPending}
              className="min-h-20 rounded-2xl border border-ice-100 bg-white px-4 py-3 text-base text-graphite-900"
            />
          </Section>
        </ScrollView>

        <View className="border-t border-ice-100 bg-white px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 12) + 12 }}>
          <Pressable
            accessibilityRole="button"
            disabled={!listo}
            onPress={enviar}
            className={`min-h-12 items-center justify-center rounded-2xl ${listo ? 'bg-frost-900' : 'bg-graphite-400/40'}`}
          >
            {crear.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-base font-semibold text-white">
                {!producto ? 'Elige un producto' : !(n > 0) ? 'Escribe la cantidad' : 'Crear orden planificada'}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
