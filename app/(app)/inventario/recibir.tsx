import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ApiError } from '@/core/http/apiClient';
import { FilterChips } from '@/components/ui/FilterChips';
import { Card, Section } from '@/components/ui/Section';
import type { Product } from '@/features/catalog/api';
import { useProduct, useProductList } from '@/features/catalog/hooks';
import { TYPE_LABEL } from '@/features/catalog/labels';
import type { OrigenEntrada } from '@/features/inventory/api';
import { useRegistrarEntrada } from '@/features/inventory/hooks';
import { qty } from '@/features/inventory/labels';
import { UbicacionPicker } from '@/features/inventory/UbicacionPicker';
import { fechaMasDias, sugerirCodigoLote } from '@/features/production/api';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const LOTE = /^[A-Z0-9][A-Z0-9-]{2,49}$/;
const ORIGENES: { key: OrigenEntrada; label: string }[] = [
  { key: 'Purchase', label: 'Compra a proveedor' },
  { key: 'Manual', label: 'Entrada manual' },
];

/**
 * Recibir mercancía (Sprint 13): crea el lote y lo ingresa al inventario en un paso.
 * Compra → número de factura o remisión; manual → una referencia (p. ej. inventario inicial).
 * Sugiere código de lote y vencimiento (hoy + vida útil del producto); todo es editable.
 * Los lotes de producción no entran por aquí: los registra la orden de producción.
 */
export default function RecibirScreen() {
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const recibir = useRegistrarEntrada();

  const [producto, setProducto] = useState<Product | null>(null);
  const [filtro, setFiltro] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [origen, setOrigen] = useState<OrigenEntrada>('Purchase');
  const [documento, setDocumento] = useState('');
  const [lote, setLote] = useState('');
  const [vence, setVence] = useState('');
  const [ubicacion, setUbicacion] = useState<string | null>(null);
  const [notas, setNotas] = useState('');

  const elegir = (p: Product) => {
    setProducto(p);
    setLote(sugerirCodigoLote(p.code));
    setVence(typeof p.expiryDays === 'number' && p.expiryDays > 0 ? fechaMasDias(p.expiryDays) : '');
  };

  // Llegando desde las existencias de un producto, viene ya elegido
  // (solo una vez: si luego toca "Cambiar", no se vuelve a elegir solo)
  const preelegido = useProduct(productId ?? '');
  const [usoPreelegido, setUsoPreelegido] = useState(false);
  useEffect(() => {
    if (usoPreelegido || !preelegido.data) return;
    setUsoPreelegido(true);
    if (preelegido.data.status === 'Active') elegir(preelegido.data);
  }, [preelegido.data, usoPreelegido]);

  const list = useProductList(['Active'], !producto, []);
  const productos = useMemo(() => {
    const all = (list.data?.pages.flatMap((p) => p.items) ?? []).filter((p) => p.type !== 'Service');
    const t = filtro.trim().toLowerCase();
    return t ? all.filter((p) => `${p.name} ${p.code} ${p.sku}`.toLowerCase().includes(t)) : all;
  }, [list.data, filtro]);

  const n = Number(cantidad.replace(',', '.'));
  const faltan: string[] = [];
  if (!producto) faltan.push('producto');
  if (!(Number.isFinite(n) && n > 0)) faltan.push('cantidad');
  if (documento.trim().length === 0) faltan.push(origen === 'Purchase' ? 'factura o remisión' : 'referencia');
  if (!LOTE.test(lote)) faltan.push('código de lote (A-Z, 0-9 y guiones)');
  if (!FECHA.test(vence)) faltan.push('vencimiento AAAA-MM-DD');
  else if (vence <= fechaMasDias(0)) faltan.push('vencimiento posterior a hoy');
  if (!ubicacion) faltan.push('ubicación');
  const listo = faltan.length === 0 && !recibir.isPending;

  const enviar = () => {
    if (!producto || !ubicacion) return;
    recibir.mutate(
      {
        productId: producto.id,
        codigoLote: lote,
        cantidad: n,
        locationId: ubicacion,
        fechaVencimiento: vence,
        origenTipo: origen,
        documento: documento.trim(),
        notas: notas.trim() || undefined,
      },
      {
        onSuccess: () => {
          Alert.alert('Mercancía recibida', `Lote ${lote}: ${qty(n)} de ${producto.name} ingresadas al inventario.`);
          router.replace({ pathname: '/(app)/inventario/[productId]', params: { productId: producto.id } });
        },
        onError: (e) => {
          const err = e as unknown as ApiError;
          Alert.alert(err.code === 'inventory.lote_code_exists' ? 'Código de lote repetido' : 'No se pudo recibir', err.message);
        },
      },
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Recibir mercancía' }} />
      <KeyboardAvoidingView className="flex-1 bg-snow" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="p-5 pb-8" keyboardShouldPersistTaps="handled">
          <Section title="1. Producto">
            {producto ? (
              <Card>
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-graphite-900">{producto.name}</Text>
                    <Text className="mt-1 text-xs text-graphite-400">
                      {producto.code} · {TYPE_LABEL[producto.type]}
                    </Text>
                  </View>
                  <Pressable accessibilityRole="button" onPress={() => setProducto(null)} disabled={recibir.isPending}>
                    <Text className="text-sm font-medium text-frost-700">Cambiar</Text>
                  </Pressable>
                </View>
              </Card>
            ) : (
              <View className="gap-2">
                <TextInput
                  value={filtro}
                  onChangeText={setFiltro}
                  placeholder="Filtrar por nombre o código"
                  placeholderTextColor="#8295A3"
                  autoCorrect={false}
                  autoCapitalize="none"
                  className="min-h-12 rounded-2xl border border-ice-100 bg-white px-4 text-base text-graphite-900"
                />
                {list.isLoading || (productId && preelegido.isLoading && !usoPreelegido) ? (
                  <ActivityIndicator color="#0B3A53" />
                ) : productos.length === 0 ? (
                  <Text className="text-sm text-graphite-600">No hay productos activos que coincidan.</Text>
                ) : (
                  productos.map((p) => (
                    <Pressable
                      key={p.id}
                      accessibilityRole="button"
                      onPress={() => elegir(p)}
                      className="rounded-2xl border border-ice-100 bg-white p-4 active:bg-ice-50"
                    >
                      <Text className="text-base font-semibold text-graphite-900">{p.name}</Text>
                      <Text className="mt-1 text-xs text-graphite-400">
                        {p.code} · {TYPE_LABEL[p.type]}
                      </Text>
                    </Pressable>
                  ))
                )}
                {list.hasNextPage ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void list.fetchNextPage()}
                    className="min-h-10 items-center justify-center rounded-full border border-ice-100 bg-white"
                  >
                    <Text className="text-sm font-medium text-frost-900">{list.isFetchingNextPage ? 'Cargando…' : 'Ver más productos'}</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </Section>

          {producto ? (
            <>
              <Section title="2. Cantidad recibida">
                <TextInput
                  value={cantidad}
                  onChangeText={(t) => setCantidad(t.replace(/[^0-9.,]/g, ''))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor="#8295A3"
                  editable={!recibir.isPending}
                  className="min-h-12 rounded-2xl border border-ice-100 bg-white px-4 text-lg font-semibold text-graphite-900"
                />
              </Section>

              <Section title="3. Origen">
                <FilterChips options={ORIGENES} value={origen} onChange={setOrigen} small />
                <TextInput
                  value={documento}
                  onChangeText={setDocumento}
                  placeholder={origen === 'Purchase' ? 'Factura o remisión, ej.: FAC-10234' : 'Ej.: Inventario inicial'}
                  placeholderTextColor="#8295A3"
                  maxLength={100}
                  editable={!recibir.isPending}
                  className="mt-3 min-h-12 rounded-2xl border border-ice-100 bg-white px-4 text-base text-graphite-900"
                />
              </Section>

              <Section title="4. Código de lote">
                <TextInput
                  value={lote}
                  onChangeText={(t) => setLote(t.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={50}
                  editable={!recibir.isPending}
                  className="min-h-12 rounded-2xl border border-ice-100 bg-white px-4 text-base text-graphite-900"
                />
                <Text className="mt-1 text-xs text-graphite-400">
                  Si el proveedor trae su propio lote, escríbelo aquí. Debe ser único para el producto.
                </Text>
              </Section>

              <Section title="5. Vence">
                <TextInput
                  value={vence}
                  onChangeText={(t) => setVence(t.replace(/[^0-9-]/g, '').slice(0, 10))}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor="#8295A3"
                  keyboardType="numbers-and-punctuation"
                  editable={!recibir.isPending}
                  className="min-h-12 rounded-2xl border border-ice-100 bg-white px-4 text-base text-graphite-900"
                />
                <Text className="mt-1 text-xs text-graphite-400">
                  {producto.expiryDays
                    ? `Sugerido: hoy + ${producto.expiryDays} días de vida útil. Usa la fecha del empaque si es otra.`
                    : 'El producto no tiene vida útil en el catálogo: escribe la fecha del empaque.'}
                </Text>
              </Section>

              <Section title="6. Ubicación">
                <UbicacionPicker value={ubicacion} onChange={setUbicacion} />
              </Section>

              <Section title="Notas (opcional)">
                <TextInput
                  value={notas}
                  onChangeText={setNotas}
                  multiline
                  maxLength={1000}
                  placeholder="Ej.: llegó con la cadena de frío bien"
                  placeholderTextColor="#8295A3"
                  editable={!recibir.isPending}
                  className="min-h-16 rounded-2xl border border-ice-100 bg-white px-4 py-3 text-base text-graphite-900"
                />
              </Section>
            </>
          ) : null}
        </ScrollView>

        <View className="border-t border-ice-100 bg-white px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 12) + 12 }}>
          {faltan.length > 0 && producto ? <Text className="mb-2 text-xs text-graphite-400">Falta: {faltan.join(', ')}.</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={!listo}
            onPress={enviar}
            className={`min-h-12 items-center justify-center rounded-2xl ${listo ? 'bg-frost-900' : 'bg-graphite-400/40'}`}
          >
            {recibir.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-base font-semibold text-white">{producto ? 'Recibir' : 'Elige un producto'}</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
