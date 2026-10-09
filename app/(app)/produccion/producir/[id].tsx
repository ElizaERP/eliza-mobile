import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ApiError } from '@/core/http/apiClient';
import { Section } from '@/components/ui/Section';
import { useProduct } from '@/features/catalog/hooks';
import { useLocationMap } from '@/features/inventory/hooks';
import { fechaMasDias, sugerirCodigoLote } from '@/features/production/api';
import { useOrder, useRegistrarProduccion } from '@/features/production/hooks';
import { num } from '@/features/production/labels';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const LOTE = /^[A-Z0-9][A-Z0-9-]{2,49}$/;

/**
 * Registrar producción (Sprint 12): crea el lote de producto terminado y lo ingresa
 * al inventario en la ubicación elegida. Sugiere el código de lote, la cantidad que
 * falta y el vencimiento (hoy + vida útil del producto); todo es editable.
 */
export default function RegistrarProduccionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const order = useOrder(id ?? '');
  const o = order.data;
  const product = useProduct(o?.productoTerminado.id ?? '');
  const { map: locationMap, isLoading: cargandoUbicaciones } = useLocationMap();
  const ubicaciones = useMemo(() => Array.from(locationMap.values()), [locationMap]);
  const registrar = useRegistrarProduccion(id ?? '');

  const [cantidad, setCantidad] = useState('');
  const [lote, setLote] = useState('');
  const [vence, setVence] = useState('');
  const [ubicacion, setUbicacion] = useState<string | null>(null);
  const [notas, setNotas] = useState('');
  const [listoDefaults, setListoDefaults] = useState(false);

  // Valores sugeridos una sola vez, cuando llegan la orden y el producto
  useEffect(() => {
    if (!o || listoDefaults || product.isLoading) return;
    const falta = Math.max(0, o.cantidadObjetivo - o.cantidadRealProducida);
    setCantidad(falta > 0 ? String(falta) : '');
    setLote(sugerirCodigoLote(o.productoTerminado.code));
    const vida = product.data?.expiryDays;
    setVence(typeof vida === 'number' && vida > 0 ? fechaMasDias(vida) : '');
    setListoDefaults(true);
  }, [o, product.isLoading, product.data, listoDefaults]);

  useEffect(() => {
    if (!ubicacion && ubicaciones.length === 1) setUbicacion(ubicaciones[0]!.id);
  }, [ubicaciones, ubicacion]);

  const n = Number(cantidad.replace(',', '.'));
  const faltan: string[] = [];
  if (!(Number.isFinite(n) && n > 0)) faltan.push('cantidad');
  if (!LOTE.test(lote)) faltan.push('código de lote (A-Z, 0-9 y guiones)');
  if (!FECHA.test(vence)) faltan.push('vencimiento AAAA-MM-DD');
  else if (vence <= fechaMasDias(0)) faltan.push('vencimiento posterior a hoy');
  if (!ubicacion) faltan.push('ubicación');
  const enProceso = o?.estado === 'EnProceso';
  const listo = enProceso && faltan.length === 0 && !registrar.isPending;

  const enviar = () => {
    if (!ubicacion || !o) return;
    const pasa = n > Math.max(0, o.cantidadObjetivo - o.cantidadRealProducida);
    const hacer = () =>
      registrar.mutate(
        { codigoLote: lote, cantidad: n, fechaVencimiento: vence, locationId: ubicacion, notas: notas.trim() || undefined },
        {
          onSuccess: () => {
            Alert.alert('Lote registrado', `${lote}: ${num(n)} unidades ingresadas al inventario.`);
            router.back();
          },
          onError: (e) => Alert.alert('No se pudo registrar', (e as unknown as ApiError).message),
        },
      );
    if (pasa) {
      Alert.alert('Más de lo planeado', `Con este lote se producen ${num(o.cantidadRealProducida + n)} de ${num(o.cantidadObjetivo)}. ¿Registrar igual?`, [
        { text: 'Volver', style: 'cancel' },
        { text: 'Registrar', onPress: hacer },
      ]);
    } else {
      hacer();
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Registrar producción' }} />
      <KeyboardAvoidingView className="flex-1 bg-snow" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="p-5 pb-8" keyboardShouldPersistTaps="handled">
          {order.isLoading ? <ActivityIndicator className="mt-10" color="#0B3A53" /> : null}
          {o ? (
            <>
              <Text className="text-xl font-bold text-graphite-900">{o.productoTerminado.name}</Text>
              <Text className="mt-1 text-xs text-graphite-400">
                {o.codigo} · producido {num(o.cantidadRealProducida)} de {num(o.cantidadObjetivo)}
              </Text>
              {!enProceso ? (
                <View className="mt-4 rounded-2xl bg-warn/10 p-4">
                  <Text className="text-sm font-semibold text-warn">La orden no está En proceso</Text>
                  <Text className="mt-1 text-sm text-graphite-600">Solo se registra producción de una orden iniciada.</Text>
                </View>
              ) : null}

              <Section title="Cantidad del lote">
                <TextInput
                  value={cantidad}
                  onChangeText={(t) => setCantidad(t.replace(/[^0-9.,]/g, ''))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor="#8295A3"
                  className="min-h-12 rounded-2xl border border-ice-100 bg-white px-4 text-lg font-semibold text-graphite-900"
                />
              </Section>

              <Section title="Código de lote">
                <TextInput
                  value={lote}
                  onChangeText={(t) => setLote(t.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={50}
                  className="min-h-12 rounded-2xl border border-ice-100 bg-white px-4 text-base text-graphite-900"
                />
                <Text className="mt-1 text-xs text-graphite-400">Sugerido con la fecha y el producto. Debe ser único.</Text>
              </Section>

              <Section title="Vence">
                <TextInput
                  value={vence}
                  onChangeText={(t) => setVence(t.replace(/[^0-9-]/g, '').slice(0, 10))}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor="#8295A3"
                  keyboardType="numbers-and-punctuation"
                  className="min-h-12 rounded-2xl border border-ice-100 bg-white px-4 text-base text-graphite-900"
                />
                <Text className="mt-1 text-xs text-graphite-400">
                  {product.data?.expiryDays ? `Sugerido: hoy + ${product.data.expiryDays} días de vida útil.` : 'El producto no tiene vida útil en el catálogo: escribe la fecha.'}
                </Text>
              </Section>

              <Section title="Ubicación de entrada">
                {cargandoUbicaciones ? (
                  <ActivityIndicator color="#0B3A53" />
                ) : ubicaciones.length === 0 ? (
                  <Text className="text-sm text-danger">No hay ubicaciones de bodega configuradas.</Text>
                ) : (
                  <View className="gap-2">
                    {ubicaciones.map((u) => {
                      const sel = u.id === ubicacion;
                      return (
                        <Pressable
                          key={u.id}
                          accessibilityRole="button"
                          accessibilityState={{ selected: sel }}
                          onPress={() => setUbicacion(u.id)}
                          className={`rounded-2xl border bg-white p-3 ${sel ? 'border-frost-700' : 'border-ice-100'}`}
                        >
                          <Text className={`text-sm font-semibold ${sel ? 'text-frost-900' : 'text-graphite-900'}`}>{u.label}</Text>
                          <Text className="text-xs text-graphite-400">{u.name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </Section>

              <Section title="Notas (opcional)">
                <TextInput
                  value={notas}
                  onChangeText={setNotas}
                  multiline
                  maxLength={500}
                  placeholder="Ej.: turno de la mañana"
                  placeholderTextColor="#8295A3"
                  className="min-h-16 rounded-2xl border border-ice-100 bg-white px-4 py-3 text-base text-graphite-900"
                />
              </Section>
            </>
          ) : null}
        </ScrollView>

        <View className="border-t border-ice-100 bg-white px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 12) + 12 }}>
          {faltan.length > 0 && o ? <Text className="mb-2 text-xs text-graphite-400">Falta: {faltan.join(', ')}.</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={!listo}
            onPress={enviar}
            className={`min-h-12 items-center justify-center rounded-2xl ${listo ? 'bg-frost-900' : 'bg-graphite-400/40'}`}
          >
            {registrar.isPending ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-base font-semibold text-white">Registrar lote</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
