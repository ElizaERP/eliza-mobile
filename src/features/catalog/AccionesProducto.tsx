import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { ApiError } from '@/core/http/apiClient';
import { canManageCatalog, canSetPrices } from '@/core/rbac/menu';
import { CancelarModal } from '@/components/ui/CancelarModal';
import { Card } from '@/components/ui/Section';
import type { Product } from './api';
import { useAccionProducto, type AccionProducto } from './hooks';
import { formatSalePrice } from './labels';

/**
 * Acciones de un producto (Sprint 14): Activar (borrador), Editar, Receta,
 * Precio de lista y Descontinuar. Cada acción manda la versión que se está
 * viendo; si otro usuario cambió el producto, el backend responde 412.
 * Los botones se ocultan según el rol; la autorización real la hace el backend.
 */
export function AccionesProducto({ producto: p, roles }: { producto: Product; roles: string[] }) {
  const router = useRouter();
  const accion = useAccionProducto(p.id);
  const [descontinuando, setDescontinuando] = useState(false);
  const [preciando, setPreciando] = useState(false);
  const gestiona = canManageCatalog(roles);
  const precios = canSetPrices(roles);

  if (p.status === 'Discontinued' || (!gestiona && !precios)) return null;

  const tieneReceta = p.type === 'FinishedGood' || p.type === 'SemiFinished';
  const avisos: string[] = [];
  if (p.type === 'FinishedGood' && p.components.length === 0) avisos.push('Sin receta no se puede producir.');
  if (p.type === 'FinishedGood' && p.salePrice === null) avisos.push('Sin precio de lista no se puede vender.');

  const ejecutar = (a: AccionProducto, hecho: string, alTerminar?: () => void) =>
    accion.mutate(a, {
      onSuccess: () => {
        alTerminar?.();
        Alert.alert('Listo', hecho);
      },
      onError: (e) => {
        const err = e as unknown as ApiError;
        Alert.alert(err.code === 'product.version_conflict' ? 'El producto cambió' : 'No se pudo completar', err.message);
      },
    });

  return (
    <Card className="mt-4">
      <Text className="text-xs font-semibold uppercase tracking-wide text-graphite-400">Acciones</Text>
      {avisos.length ? <Text className="mt-1 text-sm text-warn">{avisos.join(' ')}</Text> : null}

      {gestiona && p.status === 'Draft' ? (
        <>
          <Text className="mt-1 text-sm text-graphite-600">En borrador no aparece para recibir, producir ni vender.</Text>
          <Pressable
            accessibilityRole="button"
            disabled={accion.isPending}
            onPress={() =>
              Alert.alert('Activar producto', `${p.name} quedará disponible en inventario, producción y ventas.`, [
                { text: 'Volver', style: 'cancel' },
                { text: 'Activar', onPress: () => ejecutar({ accion: 'activar', version: p.version }, 'Producto activado.') },
              ])
            }
            className={`mt-3 min-h-12 items-center justify-center rounded-2xl ${accion.isPending ? 'bg-graphite-400/40' : 'bg-frost-900'}`}
          >
            {accion.isPending && !descontinuando && !preciando ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-base font-semibold text-white">Activar</Text>}
          </Pressable>
        </>
      ) : null}

      <View className="mt-3 flex-row flex-wrap gap-2">
        {gestiona ? <Boton label="Editar datos" onPress={() => router.push({ pathname: '/(app)/catalogo/editar/[id]', params: { id: p.id } })} /> : null}
        {gestiona && tieneReceta ? (
          <Boton label={p.components.length ? 'Editar receta' : 'Definir receta'} onPress={() => router.push({ pathname: '/(app)/catalogo/receta/[id]', params: { id: p.id } })} />
        ) : null}
        {precios && p.type !== 'RawMaterial' ? <Boton label={p.salePrice === null ? 'Poner precio' : 'Cambiar precio'} onPress={() => setPreciando(true)} /> : null}
      </View>

      {gestiona ? (
        <Pressable
          accessibilityRole="button"
          disabled={accion.isPending}
          onPress={() => setDescontinuando(true)}
          className="mt-3 min-h-11 items-center justify-center rounded-2xl border border-danger/40 bg-white"
        >
          <Text className="text-sm font-semibold text-danger">Descontinuar</Text>
        </Pressable>
      ) : null}

      {descontinuando ? (
        <CancelarModal
          titulo={`Descontinuar ${p.name}`}
          aviso="No se podrán registrar lotes nuevos, ni cambiar su precio o receta. Es definitivo: no se puede reactivar."
          placeholder="Ej.: ya no se fabrica"
          boton="Descontinuar"
          enviando={accion.isPending}
          onClose={() => setDescontinuando(false)}
          onConfirm={(motivo) => ejecutar({ accion: 'descontinuar', version: p.version, motivo }, 'Producto descontinuado.', () => setDescontinuando(false))}
        />
      ) : null}

      {preciando ? (
        <PrecioModal
          producto={p}
          enviando={accion.isPending}
          onClose={() => setPreciando(false)}
          onConfirm={(precio) =>
            ejecutar(
              { accion: 'precio', version: p.version, precio },
              precio === null ? 'Precio de lista quitado.' : `Precio de lista: ${formatSalePrice(precio)}.`,
              () => setPreciando(false),
            )
          }
        />
      ) : null}
    </Card>
  );
}

function Boton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-10 justify-center rounded-full border border-frost-700 bg-white px-4"
    >
      <Text className="text-sm font-semibold text-frost-900">{label}</Text>
    </Pressable>
  );
}

/** Precio de lista en COP sin IVA. Los pedidos nuevos toman este precio; los existentes no cambian. */
function PrecioModal({
  producto,
  enviando,
  onClose,
  onConfirm,
}: {
  producto: Product;
  enviando: boolean;
  onClose: () => void;
  onConfirm: (precio: number | null) => void;
}) {
  const [texto, setTexto] = useState(producto.salePrice !== null ? String(producto.salePrice).replace('.', ',') : '');
  const n = Number(texto.replace(/\./g, '').replace(',', '.'));
  const valido = texto.trim() !== '' && Number.isFinite(n) && n > 0;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-center bg-black/40 px-6">
        <View className="rounded-2xl bg-white p-5">
          <Text className="text-lg font-bold text-graphite-900">Precio de lista</Text>
          <Text className="mt-1 text-sm text-graphite-600">{producto.name} · en pesos, sin IVA. Los pedidos nuevos toman este precio; los ya armados no cambian.</Text>
          <TextInput
            value={texto}
            onChangeText={(t) => setTexto(t.replace(/[^0-9,]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="Ej.: 4500"
            placeholderTextColor="#8295A3"
            autoFocus
            editable={!enviando}
            className="mt-4 min-h-12 rounded-xl border border-ice-100 bg-snow px-3 text-lg font-semibold text-graphite-900"
          />
          {valido ? <Text className="mt-1 text-xs text-graphite-400">{formatSalePrice(n)}</Text> : null}
          <View className="mt-4 flex-row gap-3">
            <Pressable accessibilityRole="button" onPress={onClose} disabled={enviando} className="min-h-11 flex-1 items-center justify-center rounded-2xl border border-ice-100">
              <Text className="text-sm font-semibold text-graphite-600">Volver</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => onConfirm(n)}
              disabled={!valido || enviando}
              className={`min-h-11 flex-1 items-center justify-center rounded-2xl ${valido && !enviando ? 'bg-frost-900' : 'bg-graphite-400/40'}`}
            >
              {enviando ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-sm font-semibold text-white">Guardar</Text>}
            </Pressable>
          </View>
          {producto.salePrice !== null ? (
            <Pressable accessibilityRole="button" onPress={() => onConfirm(null)} disabled={enviando} className="mt-3 min-h-10 items-center justify-center">
              <Text className="text-sm font-medium text-danger">Quitar precio de lista</Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
