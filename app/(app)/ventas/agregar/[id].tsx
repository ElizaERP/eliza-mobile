import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ApiError } from '@/core/http/apiClient';
import { Section } from '@/components/ui/Section';
import type { Product } from '@/features/catalog/api';
import { useProductList } from '@/features/catalog/hooks';
import { FilaProducto } from '@/features/sales/FilaProducto';
import { useAgregarLineas, useSalesOrder } from '@/features/sales/hooks';
import { money } from '@/features/sales/labels';

/**
 * Agregar productos a un pedido en Borrador (Sprint 11).
 * Se ocultan los productos que ya están en el pedido (el backend no permite repetirlos;
 * para cambiar la cantidad, se quita la línea y se vuelve a agregar).
 */
export default function AgregarProductosScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const order = useSalesOrder(id ?? '');
  const agregar = useAgregarLineas(id ?? '');
  const [cantidades, setCantidades] = useState<Record<string, number>>({});

  const products = useProductList(['Active'], true, ['FinishedGood']);
  const enPedido = useMemo(() => new Set(order.data?.lineas.map((l) => l.productId) ?? []), [order.data]);
  const catalogo: Product[] = useMemo(
    () => (products.data?.pages.flatMap((p) => p.items) ?? []).filter((p) => !enPedido.has(p.id)),
    [products.data, enPedido],
  );
  const elegidos = catalogo.filter((p) => (cantidades[p.id] ?? 0) > 0);
  const subtotal = elegidos.reduce((a, p) => a + (p.salePrice ?? 0) * (cantidades[p.id] ?? 0), 0);
  const noBorrador = !!order.data && order.data.estado !== 'Borrador';
  const listo = elegidos.length > 0 && !agregar.isPending && !noBorrador;

  const setCantidad = (pid: string, n: number) =>
    setCantidades((prev) => ({ ...prev, [pid]: Math.max(0, Math.min(99_999, Math.floor(n) || 0)) }));

  const enviar = () =>
    agregar.mutate(
      elegidos.map((p) => ({ productId: p.id, productName: p.name, cantidad: cantidades[p.id] ?? 0 })),
      {
        onSuccess: ({ agregadas, fallidas }) => {
          if (fallidas.length > 0) {
            Alert.alert(
              agregadas > 0 ? 'Agregado con avisos' : 'No se agregó nada',
              fallidas.map((f) => `• ${f.productName}: ${f.mensaje}`).join('\n'),
            );
          }
          router.back();
        },
        onError: (e) => Alert.alert('No se pudo agregar', (e as unknown as ApiError).message),
      },
    );

  return (
    <>
      <Stack.Screen options={{ title: order.data ? `Agregar a ${order.data.codigo}` : 'Agregar productos' }} />
      <KeyboardAvoidingView className="flex-1 bg-snow" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="p-5 pb-8" keyboardShouldPersistTaps="handled">
          {noBorrador ? (
            <View className="rounded-2xl bg-warn/10 p-4">
              <Text className="text-sm font-semibold text-warn">El pedido ya no está en Borrador</Text>
              <Text className="mt-1 text-sm text-graphite-600">Solo se pueden agregar productos antes de confirmarlo.</Text>
            </View>
          ) : null}
          <Section title="Productos">
            {products.isLoading || order.isLoading ? (
              <ActivityIndicator color="#0B3A53" />
            ) : products.error ? (
              <Text className="text-sm text-danger">No se pudo cargar el catálogo.</Text>
            ) : catalogo.length === 0 ? (
              <Text className="text-sm text-graphite-600">Todos los productos activos ya están en el pedido.</Text>
            ) : (
              <View className="gap-3">
                {catalogo.map((p) => (
                  <FilaProducto
                    key={p.id}
                    product={p}
                    cantidad={cantidades[p.id] ?? 0}
                    onChange={(n) => setCantidad(p.id, n)}
                    disabled={agregar.isPending || noBorrador}
                  />
                ))}
                {products.hasNextPage ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void products.fetchNextPage()}
                    className="min-h-10 items-center justify-center rounded-full border border-ice-100 bg-white"
                  >
                    <Text className="text-sm font-medium text-frost-900">
                      {products.isFetchingNextPage ? 'Cargando…' : 'Ver más productos'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </Section>
        </ScrollView>

        <View className="border-t border-ice-100 bg-white px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 12) + 12 }}>
          <Text className="text-xs text-graphite-400">
            {elegidos.length === 0 ? 'Elige cantidades' : `${elegidos.length} producto(s) · ${money(subtotal)} + IVA`}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={!listo}
            onPress={enviar}
            className={`mt-3 min-h-12 items-center justify-center rounded-2xl ${listo ? 'bg-frost-900' : 'bg-graphite-400/40'}`}
          >
            {agregar.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-base font-semibold text-white">
                {elegidos.length === 0 ? 'Agrega productos' : `Agregar ${elegidos.length} producto(s)`}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
