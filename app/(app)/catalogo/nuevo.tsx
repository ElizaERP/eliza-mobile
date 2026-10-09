import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ApiError } from '@/core/http/apiClient';
import { FilterChips } from '@/components/ui/FilterChips';
import { Section } from '@/components/ui/Section';
import type { ProductType } from '@/features/catalog/api';
import { useCategoryOptions, useCrearProducto, useUomList } from '@/features/catalog/hooks';
import { CampoTexto, DATOS_VACIOS, DatosProducto, leerDatos, type DatosForm } from '@/features/catalog/ProductoForm';

type Tipo = Exclude<ProductType, 'Service'>;
const TIPOS: { key: Tipo; label: string }[] = [
  { key: 'FinishedGood', label: 'Producto terminado' },
  { key: 'RawMaterial', label: 'Materia prima' },
  { key: 'SemiFinished', label: 'Semielaborado' },
];
const PREFIJO: Record<Tipo, string> = { FinishedGood: 'PT', RawMaterial: 'MP', SemiFinished: 'SE' };
const CODIGO = /^[A-Z][A-Z0-9-]{1,49}$/;

/** Código sugerido a partir del nombre: PT-AREP-QUES-X12 (editable). */
function sugerirCodigo(nombre: string, tipo: Tipo): string {
  const palabras = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((w) => w.slice(0, 4));
  return palabras.length ? [PREFIJO[tipo], ...palabras].join('-').slice(0, 50) : '';
}

/**
 * Nuevo producto (Sprint 14). Queda en Borrador: después se le pone precio y
 * receta y se activa desde el detalle. El SKU es el mismo código.
 * Cadena de frío (por defecto en producto terminado) exige vida útil y temperatura.
 */
export default function NuevoProductoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const crear = useCrearProducto();
  const { options: categorias, isLoading: cargandoCat } = useCategoryOptions();
  const { list: unidades, isLoading: cargandoUom } = useUomList();

  const [tipo, setTipo] = useState<Tipo>('FinishedGood');
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [codigoTocado, setCodigoTocado] = useState(false);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [unidad, setUnidad] = useState<string | null>(null);
  const [cadenaFrio, setCadenaFrio] = useState(true);
  const [datos, setDatos] = useState<DatosForm>(DATOS_VACIOS);

  const cambiarTipo = (t: Tipo) => {
    setTipo(t);
    setCadenaFrio(t === 'FinishedGood');
    if (!codigoTocado) setCodigo(sugerirCodigo(nombre, t));
  };
  const cambiarNombre = (n: string) => {
    setNombre(n);
    if (!codigoTocado) setCodigo(sugerirCodigo(n, tipo));
  };

  const { faltan: faltanDatos, valores } = leerDatos(datos, cadenaFrio);
  const faltan: string[] = [];
  if (nombre.trim().length === 0) faltan.push('nombre');
  if (!CODIGO.test(codigo)) faltan.push('código (empieza con letra; A-Z, 0-9 y guiones)');
  if (!categoria) faltan.push('categoría');
  if (!unidad) faltan.push('unidad');
  faltan.push(...faltanDatos);
  const listo = faltan.length === 0 && !crear.isPending;

  const enviar = () => {
    if (!categoria || !unidad) return;
    crear.mutate(
      {
        code: codigo,
        sku: codigo,
        name: nombre.trim(),
        type: tipo,
        categoryId: categoria,
        unitOfSaleId: unidad,
        isControlled: cadenaFrio,
        ...(valores.description ? { description: valores.description } : {}),
        ...(valores.barcode ? { barcode: valores.barcode } : {}),
        ...(valores.packSize !== null ? { packSize: valores.packSize } : {}),
        ...(valores.expiryDays !== null ? { expiryDays: valores.expiryDays } : {}),
        ...(valores.storageTempMinC !== null && valores.storageTempMaxC !== null
          ? { storageTempMinC: valores.storageTempMinC, storageTempMaxC: valores.storageTempMaxC }
          : {}),
        ...(valores.taxRate !== null ? { taxRate: valores.taxRate } : {}),
      },
      {
        onSuccess: (p) => router.replace({ pathname: '/(app)/catalogo/[id]', params: { id: p.id } }),
        onError: (e) => {
          const err = e as unknown as ApiError;
          Alert.alert(err.code?.endsWith('already_exists') ? 'Código repetido' : 'No se pudo crear', err.message);
        },
      },
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Nuevo producto' }} />
      <KeyboardAvoidingView className="flex-1 bg-snow" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="p-5 pb-8" keyboardShouldPersistTaps="handled">
          <Section title="1. Tipo">
            <FilterChips options={TIPOS} value={tipo} onChange={cambiarTipo} small />
          </Section>

          <Section title="2. Nombre y código">
            <View className="gap-3">
              <CampoTexto label="Nombre *" value={nombre} onChange={cambiarNombre} placeholder="Ej.: Arepa de queso x12" maxLength={200} />
              <CampoTexto
                label="Código *"
                value={codigo}
                onChange={(v) => {
                  setCodigo(v);
                  setCodigoTocado(true);
                }}
                mayusculas
                maxLength={50}
                ayuda="Se sugiere con el nombre. Es único y no se puede cambiar después."
              />
            </View>
          </Section>

          <Section title="3. Categoría">
            {cargandoCat ? (
              <ActivityIndicator color="#0B3A53" />
            ) : categorias.length === 0 ? (
              <Text className="text-sm text-danger">No hay categorías activas. Hay que crearlas primero.</Text>
            ) : (
              <View className="gap-2">
                {categorias.map((c) => (
                  <Opcion key={c.id} titulo={c.name} detalle={c.path} sel={c.id === categoria} onPress={() => setCategoria(c.id)} />
                ))}
              </View>
            )}
          </Section>

          <Section title="4. Unidad">
            {cargandoUom ? (
              <ActivityIndicator color="#0B3A53" />
            ) : (
              <FilterChips
                options={unidades.map((u) => ({ key: u.id, label: `${u.name} (${u.symbol})` }))}
                value={unidad ?? ''}
                onChange={setUnidad}
                small
              />
            )}
            <Text className="mt-1 text-xs text-graphite-400">En la que se vende o se mide el inventario.</Text>
          </Section>

          <Section title="5. Conservación y datos">
            <View className="mb-3">
              <FilterChips
                options={[
                  { key: 'si', label: '❄️ Cadena de frío y lote' },
                  { key: 'no', label: 'Sin cadena de frío' },
                ]}
                value={cadenaFrio ? 'si' : 'no'}
                onChange={(k) => setCadenaFrio(k === 'si')}
                small
              />
            </View>
            <DatosProducto datos={datos} onChange={setDatos} cadenaFrio={cadenaFrio} />
          </Section>
        </ScrollView>

        <View className="border-t border-ice-100 bg-white px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 12) + 12 }}>
          {faltan.length > 0 ? <Text className="mb-2 text-xs text-graphite-400">Falta: {faltan.join(', ')}.</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={!listo}
            onPress={enviar}
            className={`min-h-12 items-center justify-center rounded-2xl ${listo ? 'bg-frost-900' : 'bg-graphite-400/40'}`}
          >
            {crear.isPending ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-base font-semibold text-white">Crear en borrador</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

function Opcion({ titulo, detalle, sel, onPress }: { titulo: string; detalle: string; sel: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: sel }}
      onPress={onPress}
      className={`rounded-2xl border bg-white p-3 ${sel ? 'border-frost-700' : 'border-ice-100'}`}
    >
      <Text className={`text-sm font-semibold ${sel ? 'text-frost-900' : 'text-graphite-900'}`}>{titulo}</Text>
      <Text className="text-xs text-graphite-400">{detalle}</Text>
    </Pressable>
  );
}
