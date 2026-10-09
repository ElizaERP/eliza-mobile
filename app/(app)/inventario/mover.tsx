import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ApiError } from '@/core/http/apiClient';
import { Card, Section } from '@/components/ui/Section';
import { useProduct } from '@/features/catalog/hooks';
import { useLocationMap, useStock, useTransferir } from '@/features/inventory/hooks';
import { buscarExistencia, qty } from '@/features/inventory/labels';
import { UbicacionPicker } from '@/features/inventory/UbicacionPicker';

/**
 * Mover entre ubicaciones (Sprint 13): pasa parte o todo el disponible de un lote
 * a otra ubicación. Lo reservado para pedidos no se mueve.
 */
export default function MoverScreen() {
  const { productId, existenciaId } = useLocalSearchParams<{ productId: string; existenciaId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const product = useProduct(productId ?? '');
  const stock = useStock(productId ?? '');
  const { map: ubicaciones } = useLocationMap();
  const mover = useTransferir();

  const hallado = buscarExistencia(stock.data, existenciaId ?? '');
  const u = hallado?.ubicacion;
  const max = u?.cantidadDisponible ?? 0;

  const [cantidad, setCantidad] = useState('');
  const [destino, setDestino] = useState<string | null>(null);
  const [listoDefault, setListoDefault] = useState(false);
  useEffect(() => {
    if (listoDefault || !u) return;
    setCantidad(u.cantidadDisponible > 0 ? String(u.cantidadDisponible) : '');
    setListoDefault(true);
  }, [u, listoDefault]);

  const n = Number(cantidad.replace(',', '.'));
  const faltan: string[] = [];
  if (!(Number.isFinite(n) && n > 0)) faltan.push('cantidad');
  else if (n > max) faltan.push(`máximo ${qty(max)}`);
  if (!destino) faltan.push('destino');
  const listo = !!u && faltan.length === 0 && !mover.isPending;

  const enviar = () => {
    if (!u || !hallado || !destino || !productId) return;
    const nombreDestino = ubicaciones.get(destino)?.label ?? 'la ubicación elegida';
    mover.mutate(
      { productId, loteId: hallado.lote.loteId, origenLocationId: u.locationId, destinoLocationId: destino, cantidad: n },
      {
        onSuccess: () => {
          Alert.alert('Movido', `${qty(n)} del lote ${hallado.lote.codigoLote} ahora están en ${nombreDestino}.`);
          router.back();
        },
        onError: (e) => Alert.alert('No se pudo mover', (e as unknown as ApiError).message),
      },
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Mover de ubicación' }} />
      <KeyboardAvoidingView className="flex-1 bg-snow" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="p-5 pb-8" keyboardShouldPersistTaps="handled">
          {stock.isLoading ? <ActivityIndicator className="mt-10" color="#0B3A53" /> : null}
          {stock.data && !hallado ? <Text className="mt-6 text-sm text-graphite-600">Esta existencia ya no está en el inventario.</Text> : null}
          {hallado && u ? (
            <>
              <Text className="text-xl font-bold text-graphite-900">{product.data?.name ?? 'Producto'}</Text>
              <Text className="mt-1 text-xs text-graphite-400">Lote {hallado.lote.codigoLote}</Text>

              <Card className="mt-4">
                <Text className="text-sm text-graphite-600">
                  Desde 📍 <Text className="font-semibold text-graphite-900">{ubicaciones.get(u.locationId)?.label ?? 'Ubicación'}</Text>
                </Text>
                <Text className="mt-1 text-sm text-graphite-600">
                  Disponible para mover: <Text className="font-bold text-graphite-900">{qty(max)}</Text>
                </Text>
                {u.cantidadReservada > 0 ? (
                  <Text className="mt-1 text-xs text-graphite-400">{qty(u.cantidadReservada)} reservadas para pedidos se quedan aquí.</Text>
                ) : null}
              </Card>

              <Section title="Cantidad a mover">
                <TextInput
                  value={cantidad}
                  onChangeText={(t) => setCantidad(t.replace(/[^0-9.,]/g, ''))}
                  keyboardType="decimal-pad"
                  editable={!mover.isPending}
                  className="min-h-12 rounded-2xl border border-ice-100 bg-white px-4 text-lg font-semibold text-graphite-900"
                />
              </Section>

              <Section title="Hacia">
                <UbicacionPicker value={destino} onChange={setDestino} excluir={u.locationId} />
              </Section>
            </>
          ) : null}
        </ScrollView>

        <View className="border-t border-ice-100 bg-white px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 12) + 12 }}>
          {faltan.length > 0 && u ? <Text className="mb-2 text-xs text-graphite-400">Falta: {faltan.join(', ')}.</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={!listo}
            onPress={enviar}
            className={`min-h-12 items-center justify-center rounded-2xl ${listo ? 'bg-frost-900' : 'bg-graphite-400/40'}`}
          >
            {mover.isPending ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-base font-semibold text-white">Mover</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
