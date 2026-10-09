import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import type { ApiError } from '@/core/http/apiClient';
import { canCloseSalesOrders, canManageSalesOrders } from '@/core/rbac/menu';
import { Card } from '@/components/ui/Section';
import type { Pedido } from './api';
import { useAccionPedido, type AccionPedido } from './hooks';

interface Paso {
  accion: Exclude<AccionPedido, 'cancelar'>;
  boton: string;
  explicacion: string;
  /** Pregunta de confirmación; las acciones que no se pueden deshacer la llevan siempre. */
  confirmar: { titulo: string; mensaje: string; ok: string };
  hecho: string;
}

/** Siguiente paso del ciclo Borrador → Confirmada → Reservada → Despachada → Cerrada. */
function siguientePaso(p: Pedido): Paso | null {
  switch (p.estado) {
    case 'Borrador':
      return {
        accion: 'confirmar',
        boton: 'Confirmar pedido',
        explicacion: 'Al confirmar, las líneas quedan cerradas y el pedido pasa a reserva de stock.',
        confirmar: {
          titulo: 'Confirmar pedido',
          mensaje: `${p.codigo} · ${p.lineas.length} línea(s). Después de confirmar ya no se pueden cambiar los productos.`,
          ok: 'Confirmar',
        },
        hecho: 'Pedido confirmado.',
      };
    case 'Confirmada':
      return {
        accion: 'reservar',
        boton: 'Reservar stock',
        explicacion: 'Aparta el stock de cada producto, empezando por los lotes que vencen primero (FEFO). Si un producto no alcanza, no se reserva nada.',
        confirmar: { titulo: 'Reservar stock', mensaje: `¿Reservar el stock de las ${p.lineas.length} línea(s) de ${p.codigo}?`, ok: 'Reservar' },
        hecho: 'Stock reservado.',
      };
    case 'Reservada':
      return {
        accion: 'despachar',
        boton: 'Despachar',
        explicacion: 'Descuenta del inventario el stock reservado. Hazlo cuando el pedido sale de la bodega.',
        confirmar: {
          titulo: 'Despachar pedido',
          mensaje: `Se descontará del inventario el stock de ${p.codigo}. Esta acción no se puede deshacer.`,
          ok: 'Despachar',
        },
        hecho: 'Pedido despachado.',
      };
    case 'Despachada':
      return {
        accion: 'cerrar',
        boton: 'Cerrar pedido',
        explicacion: 'Archiva el pedido una vez entregado y conciliado.',
        confirmar: { titulo: 'Cerrar pedido', mensaje: `¿Cerrar ${p.codigo}? Queda archivado.`, ok: 'Cerrar' },
        hecho: 'Pedido cerrado.',
      };
    default:
      return null;
  }
}

/**
 * Acciones del pedido según su estado y los roles (Sprint 11).
 * La autorización real la hace el backend; aquí solo se ocultan los botones que no aplican.
 */
export function AccionesPedido({ pedido, roles }: { pedido: Pedido; roles: string[] }) {
  const accion = useAccionPedido(pedido.id);
  const [cancelando, setCancelando] = useState(false);
  const gestiona = canManageSalesOrders(roles);
  const paso = siguientePaso(pedido);
  const puedePaso = !!paso && (paso.accion === 'cerrar' ? canCloseSalesOrders(roles) : gestiona);
  const puedeCancelar = gestiona && ['Borrador', 'Confirmada', 'Reservada'].includes(pedido.estado);
  const sinLineas = pedido.estado === 'Borrador' && pedido.lineas.length === 0;

  if (!paso && !puedeCancelar) return null;

  const ejecutar = (a: AccionPedido, opciones: { motivo?: string; hecho: string; onDone?: () => void }) =>
    accion.mutate(
      { accion: a, motivo: opciones.motivo },
      {
        onSuccess: () => {
          opciones.onDone?.();
          Alert.alert('Listo', opciones.hecho);
        },
        onError: (e) => {
          const err = e as unknown as ApiError;
          Alert.alert(
            err.code === 'sales.insufficient_stock' ? 'Stock insuficiente' : 'No se pudo completar',
            err.message,
          );
        },
      },
    );

  const pedirConfirmacion = (p: Paso) =>
    Alert.alert(p.confirmar.titulo, p.confirmar.mensaje, [
      { text: 'Volver', style: 'cancel' },
      { text: p.confirmar.ok, style: p.accion === 'despachar' ? 'destructive' : 'default', onPress: () => ejecutar(p.accion, { hecho: p.hecho }) },
    ]);

  return (
    <Card className="mt-4">
      <Text className="text-xs font-semibold uppercase tracking-wide text-graphite-400">Siguiente paso</Text>
      {paso ? <Text className="mt-1 text-sm text-graphite-600">{paso.explicacion}</Text> : null}

      {paso && puedePaso ? (
        <Pressable
          accessibilityRole="button"
          disabled={accion.isPending || sinLineas}
          onPress={() => pedirConfirmacion(paso)}
          className={`mt-3 min-h-12 items-center justify-center rounded-2xl ${accion.isPending || sinLineas ? 'bg-graphite-400/40' : 'bg-frost-900'}`}
        >
          {accion.isPending && !cancelando ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-base font-semibold text-white">{sinLineas ? 'Agrega productos para confirmar' : paso.boton}</Text>
          )}
        </Pressable>
      ) : paso ? (
        <Text className="mt-2 text-sm text-graphite-400">
          {paso.accion === 'confirmar' ? 'El gerente de ventas confirma el pedido.' : 'Este paso lo hace el gerente de ventas.'}
        </Text>
      ) : null}

      {puedeCancelar ? (
        <Pressable
          accessibilityRole="button"
          disabled={accion.isPending}
          onPress={() => setCancelando(true)}
          className="mt-2 min-h-11 items-center justify-center rounded-2xl border border-danger/40 bg-white"
        >
          <Text className="text-sm font-semibold text-danger">Cancelar pedido</Text>
        </Pressable>
      ) : null}

      {cancelando ? (
      <CancelarModal
        visible
        codigo={pedido.codigo}
        reservado={pedido.estado === 'Reservada'}
        enviando={accion.isPending}
        onClose={() => setCancelando(false)}
        onConfirm={(motivo) =>
          ejecutar('cancelar', {
            motivo,
            hecho: pedido.estado === 'Reservada' ? 'Pedido cancelado y stock liberado.' : 'Pedido cancelado.',
            onDone: () => setCancelando(false),
          })
        }
      />
      ) : null}
    </Card>
  );
}

function CancelarModal({
  visible,
  codigo,
  reservado,
  enviando,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  codigo: string;
  reservado: boolean;
  enviando: boolean;
  onClose: () => void;
  onConfirm: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState('');
  const valido = motivo.trim().length >= 3;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-center bg-black/40 px-6">
        <View className="rounded-2xl bg-white p-5">
          <Text className="text-lg font-bold text-graphite-900">Cancelar {codigo}</Text>
          <Text className="mt-1 text-sm text-graphite-600">
            {reservado ? 'Se libera el stock reservado. ' : ''}La cancelación no se puede deshacer.
          </Text>
          <Text className="mb-1 mt-4 text-xs font-medium text-graphite-600">Motivo *</Text>
          <TextInput
            value={motivo}
            onChangeText={setMotivo}
            placeholder="Ej.: el cliente cambió el pedido"
            placeholderTextColor="#8295A3"
            multiline
            maxLength={500}
            editable={!enviando}
            autoFocus
            className="min-h-20 rounded-xl border border-ice-100 bg-snow px-3 py-2 text-base text-graphite-900"
          />
          <View className="mt-4 flex-row gap-3">
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              disabled={enviando}
              className="min-h-11 flex-1 items-center justify-center rounded-2xl border border-ice-100"
            >
              <Text className="text-sm font-semibold text-graphite-600">Volver</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => onConfirm(motivo)}
              disabled={!valido || enviando}
              className={`min-h-11 flex-1 items-center justify-center rounded-2xl ${valido && !enviando ? 'bg-danger' : 'bg-graphite-400/40'}`}
            >
              {enviando ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-sm font-semibold text-white">Cancelar pedido</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
