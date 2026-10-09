import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ApiError } from '@/core/http/apiClient';
import { FilterChips } from '@/components/ui/FilterChips';
import { Card, Section } from '@/components/ui/Section';
import { useProduct } from '@/features/catalog/hooks';
import { useAjustarConteo, useLocationMap, useStock } from '@/features/inventory/hooks';
import { buscarExistencia, fisicoDe, qty } from '@/features/inventory/labels';

const MOTIVOS = [
  { key: 'Conteo cíclico', label: 'Conteo cíclico' },
  { key: 'Merma', label: 'Merma' },
  { key: 'Producto dañado', label: 'Dañado' },
  { key: 'Hallazgo', label: 'Hallazgo' },
] as const;
type Motivo = (typeof MOTIVOS)[number]['key'];

/**
 * Contar (Sprint 13): el operario escribe lo que hay físicamente en la ubicación
 * y el servidor ajusta la diferencia contra el sistema. Se cuenta TODO lo que hay
 * en el estante (también lo reservado para pedidos); no puede quedar por debajo
 * de lo reservado.
 */
export default function ContarScreen() {
  const { productId, existenciaId } = useLocalSearchParams<{ productId: string; existenciaId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const product = useProduct(productId ?? '');
  const stock = useStock(productId ?? '');
  const { map: ubicaciones } = useLocationMap();
  const ajustar = useAjustarConteo();

  const [contado, setContado] = useState('');
  const [motivo, setMotivo] = useState<Motivo>('Conteo cíclico');
  const [detalle, setDetalle] = useState('');

  const hallado = buscarExistencia(stock.data, existenciaId ?? '');
  const u = hallado?.ubicacion;
  const sistema = u ? fisicoDe(u) : 0;
  const comprometido = u ? u.cantidadReservada + u.cantidadBloqueada : 0;
  const n = Number(contado.replace(',', '.'));
  const valido = contado.trim() !== '' && Number.isFinite(n) && n >= 0;
  const diferencia = valido ? Math.round((n - sistema) * 1e6) / 1e6 : 0;

  let aviso = '';
  if (valido && n < comprometido) aviso = `No puede ser menor que lo reservado (${qty(comprometido)}). Si de verdad falta, primero hay que liberar esas reservas.`;
  else if (valido && diferencia === 0) aviso = 'Coincide con el sistema: no hay nada que ajustar.';
  const listo = !!u && valido && !aviso && !ajustar.isPending;

  const enviar = () => {
    if (!u || !hallado) return;
    const texto = detalle.trim() ? `${motivo}: ${detalle.trim()}` : motivo;
    const hacer = () =>
      ajustar.mutate(
        { existenciaId: u.existenciaId, cantidadContada: n, motivo: texto },
        {
          onSuccess: () => {
            Alert.alert('Conteo registrado', `Lote ${hallado.lote.codigoLote}: ${diferencia > 0 ? '+' : '−'}${qty(Math.abs(diferencia))} ajustadas.`);
            router.back();
          },
          onError: (e) => Alert.alert('No se pudo ajustar', (e as unknown as ApiError).message),
        },
      );
    Alert.alert(
      diferencia < 0 ? 'Faltante' : 'Sobrante',
      `Sistema ${qty(sistema)}, contado ${qty(n)}.\nSe ${diferencia < 0 ? 'restan' : 'suman'} ${qty(Math.abs(diferencia))} del lote ${hallado.lote.codigoLote}.`,
      [
        { text: 'Volver', style: 'cancel' },
        { text: 'Ajustar', style: diferencia < 0 ? 'destructive' : 'default', onPress: hacer },
      ],
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Contar' }} />
      <KeyboardAvoidingView className="flex-1 bg-snow" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="p-5 pb-8" keyboardShouldPersistTaps="handled">
          {stock.isLoading ? <ActivityIndicator className="mt-10" color="#0B3A53" /> : null}
          {stock.data && !hallado ? <Text className="mt-6 text-sm text-graphite-600">Esta existencia ya no está en el inventario.</Text> : null}
          {hallado && u ? (
            <>
              <Text className="text-xl font-bold text-graphite-900">{product.data?.name ?? 'Producto'}</Text>
              <Text className="mt-1 text-xs text-graphite-400">
                Lote {hallado.lote.codigoLote} · 📍 {ubicaciones.get(u.locationId)?.label ?? 'Ubicación'}
              </Text>

              <Card className="mt-4">
                <Text className="text-sm text-graphite-600">
                  En el sistema: <Text className="font-bold text-graphite-900">{qty(sistema)}</Text>
                </Text>
                {comprometido > 0 ? (
                  <Text className="mt-1 text-xs text-graphite-400">
                    Incluye {qty(u.cantidadReservada)} reservadas{u.cantidadBloqueada > 0 ? ` y ${qty(u.cantidadBloqueada)} bloqueadas` : ''}: también se cuentan.
                  </Text>
                ) : null}
              </Card>

              <Section title="¿Cuánto hay físicamente?">
                <TextInput
                  value={contado}
                  onChangeText={(t) => setContado(t.replace(/[^0-9.,]/g, ''))}
                  keyboardType="decimal-pad"
                  placeholder={String(sistema)}
                  placeholderTextColor="#8295A3"
                  autoFocus
                  editable={!ajustar.isPending}
                  className="min-h-12 rounded-2xl border border-ice-100 bg-white px-4 text-lg font-semibold text-graphite-900"
                />
                {valido && diferencia !== 0 && !aviso ? (
                  <Text className={`mt-2 text-sm font-semibold ${diferencia < 0 ? 'text-danger' : 'text-ok'}`}>
                    {diferencia < 0 ? 'Faltan' : 'Sobran'} {qty(Math.abs(diferencia))}
                  </Text>
                ) : null}
                {aviso ? <Text className="mt-2 text-sm text-warn">{aviso}</Text> : null}
              </Section>

              <Section title="Motivo">
                <FilterChips options={[...MOTIVOS]} value={motivo} onChange={setMotivo} small />
                <TextInput
                  value={detalle}
                  onChangeText={setDetalle}
                  placeholder="Detalle (opcional)"
                  placeholderTextColor="#8295A3"
                  maxLength={300}
                  editable={!ajustar.isPending}
                  className="mt-3 min-h-12 rounded-2xl border border-ice-100 bg-white px-4 text-base text-graphite-900"
                />
              </Section>
            </>
          ) : null}
        </ScrollView>

        <View className="border-t border-ice-100 bg-white px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 12) + 12 }}>
          <Pressable
            accessibilityRole="button"
            disabled={!listo}
            onPress={enviar}
            className={`min-h-12 items-center justify-center rounded-2xl ${listo ? 'bg-frost-900' : 'bg-graphite-400/40'}`}
          >
            {ajustar.isPending ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-base font-semibold text-white">Registrar conteo</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
