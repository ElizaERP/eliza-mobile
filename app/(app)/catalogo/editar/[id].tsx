import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ApiError } from '@/core/http/apiClient';
import { Section } from '@/components/ui/Section';
import type { EditarProductoBody } from '@/features/catalog/api';
import { useEditarProducto, useProduct } from '@/features/catalog/hooks';
import { TYPE_LABEL } from '@/features/catalog/labels';
import { CampoTexto, DATOS_VACIOS, DatosProducto, datosDe, leerDatos, type DatosForm } from '@/features/catalog/ProductoForm';

/**
 * Editar producto (Sprint 14): nombre y datos en una sola llamada. Solo se envía
 * lo que cambió; si otro usuario lo modificó mientras tanto, el backend responde
 * 412 y se pide volver a abrirlo. Código, SKU, tipo, categoría y unidad no se editan.
 */
export default function EditarProductoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const product = useProduct(id ?? '');
  const editar = useEditarProducto(id ?? '');
  const p = product.data;

  const [nombre, setNombre] = useState('');
  const [datos, setDatos] = useState<DatosForm>(DATOS_VACIOS);
  const [version, setVersion] = useState<number | null>(null);

  // Se carga una sola vez: un refresco en segundo plano no borra lo que se está escribiendo
  useEffect(() => {
    if (!p || version !== null) return;
    setNombre(p.name);
    setDatos(datosDe(p));
    setVersion(p.version);
  }, [p, version]);

  const cargado = !!p && version !== null;
  const { faltan: faltanDatos, valores } = leerDatos(datos, p?.isControlled ?? false);
  const faltan = [...(nombre.trim() ? [] : ['nombre']), ...faltanDatos];

  // Solo lo que cambió
  const cambios: Omit<EditarProductoBody, 'expectedVersion'> = {};
  if (p && cargado) {
    if (nombre.trim() !== p.name) cambios.name = nombre.trim();
    if (valores.description !== (p.description ?? null)) cambios.description = valores.description;
    if (valores.barcode !== (p.barcode ?? null)) cambios.barcode = valores.barcode;
    if (valores.packSize !== p.packSize) cambios.packSize = valores.packSize;
    if (valores.expiryDays !== p.expiryDays) cambios.expiryDays = valores.expiryDays;
    if (valores.storageTempMinC !== p.storageTempMinC || valores.storageTempMaxC !== p.storageTempMaxC) {
      cambios.storageTempMinC = valores.storageTempMinC;
      cambios.storageTempMaxC = valores.storageTempMaxC;
    }
    if (valores.taxRate !== p.taxRate) cambios.taxRate = valores.taxRate;
  }
  const hayCambios = Object.keys(cambios).length > 0;
  const listo = cargado && hayCambios && faltan.length === 0 && !editar.isPending;

  const guardar = () => {
    if (version === null) return;
    editar.mutate(
      { ...cambios, expectedVersion: version },
      {
        onSuccess: () => router.back(),
        onError: (e) => {
          const err = e as unknown as ApiError;
          Alert.alert(err.code === 'product.version_conflict' ? 'El producto cambió' : 'No se pudo guardar', err.message);
        },
      },
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Editar producto' }} />
      <KeyboardAvoidingView className="flex-1 bg-snow" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="p-5 pb-8" keyboardShouldPersistTaps="handled">
          {product.isLoading ? <ActivityIndicator className="mt-10" color="#0B3A53" /> : null}
          {p ? (
            <>
              <Text className="text-xs text-graphite-400">
                {p.code} · {TYPE_LABEL[p.type]} (no se editan)
              </Text>
              <Section title="Nombre">
                <CampoTexto label="Nombre *" value={nombre} onChange={setNombre} maxLength={200} editable={!editar.isPending} />
              </Section>
              <Section title={p.isControlled ? 'Conservación y datos (❄️ cadena de frío)' : 'Conservación y datos'}>
                <DatosProducto datos={datos} onChange={setDatos} cadenaFrio={p.isControlled} editable={!editar.isPending} />
              </Section>
            </>
          ) : null}
        </ScrollView>

        <View className="border-t border-ice-100 bg-white px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 12) + 12 }}>
          {cargado && faltan.length > 0 ? <Text className="mb-2 text-xs text-graphite-400">Falta: {faltan.join(', ')}.</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={!listo}
            onPress={guardar}
            className={`min-h-12 items-center justify-center rounded-2xl ${listo ? 'bg-frost-900' : 'bg-graphite-400/40'}`}
          >
            {editar.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-base font-semibold text-white">{hayCambios || !cargado ? 'Guardar cambios' : 'Sin cambios'}</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
