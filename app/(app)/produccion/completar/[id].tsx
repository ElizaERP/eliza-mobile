import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ApiError } from '@/core/http/apiClient';
import { Card } from '@/components/ui/Section';
import { consumoTeorico } from '@/features/production/api';
import { useCompletarOrden, useOrder } from '@/features/production/hooks';
import { num } from '@/features/production/labels';

/**
 * Completar una orden con el consumo REAL (Sprint 15). Por cada materia prima
 * propone receta × lo que de verdad se produjo; el operario lo corrige si hubo
 * merma o sobró (0 = no se usó). Lo reservado que no se gasta vuelve al
 * inventario; si se gastó más, el backend descuenta lo que falta.
 */
export default function CompletarOrdenScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const order = useOrder(id ?? '');
  const completar = useCompletarOrden(id ?? '');
  const o = order.data;

  const [valores, setValores] = useState<Record<string, string>>({});
  const [listoDefaults, setListoDefaults] = useState(false);

  useEffect(() => {
    if (!o || listoDefaults) return;
    const v: Record<string, string> = {};
    for (const c of o.componentes) {
      if (Number.isFinite(c.cantidadPorUnidad)) v[c.productId] = String(consumoTeorico(c.cantidadPorUnidad, o.cantidadRealProducida));
    }
    setValores(v);
    setListoDefaults(true);
  }, [o, listoDefaults]);

  const componentes = (o?.componentes ?? []).filter((c) => Number.isFinite(c.cantidadPorUnidad));
  const leidos = componentes.map((c) => {
    const t = (valores[c.productId] ?? '').trim().replace(',', '.');
    const n = t === '' ? Number.NaN : Number(t);
    return { c, n, teorico: o ? consumoTeorico(c.cantidadPorUnidad, o.cantidadRealProducida) : 0 };
  });
  const invalidos = leidos.filter((l) => !(Number.isFinite(l.n) && l.n >= 0)).map((l) => l.c.productName);
  const enProceso = o?.estado === 'EnProceso';
  const sinLotes = (o?.lotesProducidos.length ?? 0) === 0;
  const listo = !!o && enProceso && !sinLotes && listoDefaults && invalidos.length === 0 && !completar.isPending;

  const enviar = () => {
    if (!o) return;
    const resumen = leidos
      .map((l) => `• ${l.c.productName}: ${num(l.n)} ${l.c.unidadMedida}${l.n > l.c.cantidadTotalRequerida ? ' (más de lo reservado)' : ''}`)
      .join('\n');
    Alert.alert(
      'Completar orden',
      `Producido: ${num(o.cantidadRealProducida)} de ${num(o.cantidadObjetivo)}.\n\nSe descontará del inventario:\n${resumen}\n\nLo reservado que no se usó vuelve al inventario. No se puede deshacer.`,
      [
        { text: 'Volver', style: 'cancel' },
        {
          text: 'Completar',
          style: 'destructive',
          onPress: () =>
            completar.mutate(
              leidos.map((l) => ({ productId: l.c.productId, cantidad: l.n })),
              {
                onSuccess: () => {
                  Alert.alert('Orden completada', 'Materias primas descontadas según el consumo real.');
                  router.back();
                },
                onError: (e) => {
                  const err = e as unknown as ApiError;
                  Alert.alert(err.code === 'manufacturing.insufficient_stock' ? 'Materia prima insuficiente' : 'No se pudo completar', err.message);
                },
              },
            ),
        },
      ],
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Completar orden' }} />
      <KeyboardAvoidingView className="flex-1 bg-snow" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="p-5 pb-8" keyboardShouldPersistTaps="handled">
          {order.isLoading ? <ActivityIndicator className="mt-10" color="#0B3A53" /> : null}
          {o ? (
            <>
              <Text className="text-xl font-bold text-graphite-900">{o.productoTerminado.name}</Text>
              <Text className="mt-1 text-xs text-graphite-400">{o.codigo}</Text>

              <Card className="mt-4">
                <Text className="text-sm text-graphite-600">
                  Producido <Text className="text-lg font-bold text-graphite-900">{num(o.cantidadRealProducida)}</Text> de {num(o.cantidadObjetivo)} planeadas
                </Text>
                <Text className="mt-1 text-xs text-graphite-400">
                  {o.lotesProducidos.length} lote(s). El consumo se calcula con lo producido; corrígelo si hubo merma o sobró.
                </Text>
              </Card>

              {!enProceso ? (
                <View className="mt-4 rounded-2xl bg-warn/10 p-4">
                  <Text className="text-sm font-semibold text-warn">La orden no está En proceso</Text>
                </View>
              ) : sinLotes ? (
                <View className="mt-4 rounded-2xl bg-warn/10 p-4">
                  <Text className="text-sm font-semibold text-warn">Registra al menos un lote antes de completar</Text>
                </View>
              ) : null}

              <Text className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-graphite-400">Consumo real</Text>
              <View className="gap-3">
                {leidos.map(({ c, n, teorico }) => {
                  const cambiado = Number.isFinite(n) && Math.abs(n - teorico) > 1e-9;
                  return (
                    <Card key={c.productId}>
                      <Text className="text-base font-semibold text-graphite-900">{c.productName}</Text>
                      <Text className="text-xs text-graphite-400">
                        Receta: {num(c.cantidadPorUnidad)} {c.unidadMedida}/unidad · reservado {num(c.cantidadTotalRequerida)} {c.unidadMedida}
                      </Text>
                      <View className="mt-3 flex-row items-center gap-3">
                        <TextInput
                          value={valores[c.productId] ?? ''}
                          onChangeText={(t) => setValores((v) => ({ ...v, [c.productId]: t.replace(/[^0-9.,]/g, '') }))}
                          keyboardType="decimal-pad"
                          editable={!completar.isPending}
                          className="min-h-11 flex-1 rounded-xl border border-ice-100 bg-snow px-3 text-lg font-semibold text-graphite-900"
                        />
                        <Text className="text-base text-graphite-600">{c.unidadMedida}</Text>
                      </View>
                      <View className="mt-2 flex-row items-center justify-between">
                        <Text className="text-xs text-graphite-400">Según receta: {num(teorico)} {c.unidadMedida}</Text>
                        {cambiado ? (
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => setValores((v) => ({ ...v, [c.productId]: String(teorico) }))}
                          >
                            <Text className="text-xs font-semibold text-frost-700">Usar receta</Text>
                          </Pressable>
                        ) : null}
                      </View>
                      {Number.isFinite(n) && n > c.cantidadTotalRequerida ? (
                        <Text className="mt-1 text-xs text-warn">Más de lo reservado: se descontará lo que falta del stock disponible.</Text>
                      ) : null}
                    </Card>
                  );
                })}
              </View>
            </>
          ) : null}
        </ScrollView>

        <View className="border-t border-ice-100 bg-white px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 12) + 12 }}>
          {invalidos.length > 0 ? <Text className="mb-2 text-xs text-graphite-400">Falta el consumo de: {invalidos.join(', ')}.</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={!listo}
            onPress={enviar}
            className={`min-h-12 items-center justify-center rounded-2xl ${listo ? 'bg-frost-900' : 'bg-graphite-400/40'}`}
          >
            {completar.isPending ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-base font-semibold text-white">Completar y descontar</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
