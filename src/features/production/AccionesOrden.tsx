import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import type { ApiError } from '@/core/http/apiClient';
import { canCancelProduction, canManageProduction } from '@/core/rbac/menu';
import { CancelarModal } from '@/components/ui/CancelarModal';
import { Card } from '@/components/ui/Section';
import type { OrdenDetalle } from './api';
import { useAccionOrden, type AccionOrden } from './hooks';
import { num } from './labels';

/**
 * Acciones de una orden de producción según su estado (Sprint 12):
 *   Planificada → Reservar materiales → Iniciar → Registrar producción (lotes) → Completar
 *   y Cancelar en Planificada / En proceso (devuelve el stock reservado).
 * Sprint 15: Completar abre la pantalla de consumo real (receta × producido, editable).
 * La autorización real la hace el backend; aquí solo se ocultan los botones que no aplican.
 */
export function AccionesOrden({ orden, roles }: { orden: OrdenDetalle; roles: string[] }) {
  const router = useRouter();
  const accion = useAccionOrden(orden.id);
  const [cancelando, setCancelando] = useState(false);
  const gestiona = canManageProduction(roles);
  const puedeCancelar = canCancelProduction(roles) && (orden.estado === 'Planificada' || orden.estado === 'EnProceso');
  const activa = orden.estado === 'Planificada' || orden.estado === 'EnProceso';

  if (!activa) return null;

  const ejecutar = (a: AccionOrden, hecho: string, motivo?: string) =>
    accion.mutate(
      { accion: a, motivo },
      {
        onSuccess: () => {
          if (a === 'cancelar') setCancelando(false);
          Alert.alert('Listo', hecho);
        },
        onError: (e) => {
          const err = e as unknown as ApiError;
          Alert.alert(err.code === 'manufacturing.insufficient_stock' ? 'Materia prima insuficiente' : 'No se pudo completar', err.message);
        },
      },
    );

  const confirmar = (titulo: string, mensaje: string, ok: string, a: AccionOrden, hecho: string, destructiva = false) =>
    Alert.alert(titulo, mensaje, [
      { text: 'Volver', style: 'cancel' },
      { text: ok, style: destructiva ? 'destructive' : 'default', onPress: () => ejecutar(a, hecho) },
    ]);

  const materiales = orden.componentes
    .filter((c) => Number.isFinite(c.cantidadTotalRequerida))
    .map((c) => `• ${c.productName}: ${num(c.cantidadTotalRequerida)} ${c.unidadMedida}`)
    .join('\n');

  let explicacion = '';
  let principal: { label: string; onPress: () => void; disabled?: boolean } | null = null;
  let secundaria: { label: string; onPress: () => void; disabled?: boolean } | null = null;

  if (orden.estado === 'Planificada' && !orden.materialesReservados) {
    explicacion = 'Aparta las materias primas de la receta, empezando por los lotes que vencen primero. Si una no alcanza, no se reserva nada.';
    principal = {
      label: 'Reservar materiales',
      onPress: () => confirmar('Reservar materiales', `Para ${num(orden.cantidadObjetivo)} unidades se necesitan:\n\n${materiales}`, 'Reservar', 'reservar', 'Materiales reservados.'),
    };
  } else if (orden.estado === 'Planificada') {
    explicacion = 'Los materiales ya están apartados. Inicia la orden cuando empiece la producción en planta.';
    principal = {
      label: 'Iniciar producción',
      onPress: () => confirmar('Iniciar producción', `¿Iniciar ${orden.codigo}?`, 'Iniciar', 'iniciar', 'Producción iniciada.'),
    };
  } else {
    const sinLotes = orden.lotesProducidos.length === 0;
    explicacion = sinLotes
      ? 'Registra cada lote que sale de producción. Al completar se descuentan las materias primas del inventario.'
      : `${orden.lotesProducidos.length} lote(s) registrados. Cuando termines, completa la orden: se descuenta lo que de verdad se gastó.`;
    principal = {
      label: 'Registrar producción',
      onPress: () => router.push({ pathname: '/(app)/produccion/producir/[id]', params: { id: orden.id } }),
    };
    secundaria = {
      label: sinLotes ? 'Completar (registra un lote primero)' : 'Completar orden',
      disabled: sinLotes,
      onPress: () => router.push({ pathname: '/(app)/produccion/completar/[id]', params: { id: orden.id } }),
    };
  }

  return (
    <Card className="mt-4">
      <Text className="text-xs font-semibold uppercase tracking-wide text-graphite-400">Siguiente paso</Text>
      <Text className="mt-1 text-sm text-graphite-600">{explicacion}</Text>

      {gestiona && principal ? (
        <Pressable
          accessibilityRole="button"
          disabled={accion.isPending || principal.disabled}
          onPress={principal.onPress}
          className={`mt-3 min-h-12 items-center justify-center rounded-2xl ${accion.isPending ? 'bg-graphite-400/40' : 'bg-frost-900'}`}
        >
          {accion.isPending && !cancelando ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-base font-semibold text-white">{principal.label}</Text>}
        </Pressable>
      ) : null}

      {gestiona && secundaria ? (
        <Pressable
          accessibilityRole="button"
          disabled={accion.isPending || secundaria.disabled}
          onPress={secundaria.onPress}
          className={`mt-2 min-h-11 items-center justify-center rounded-2xl border bg-white ${secundaria.disabled ? 'border-ice-100' : 'border-frost-700'}`}
        >
          <Text className={`text-sm font-semibold ${secundaria.disabled ? 'text-graphite-400' : 'text-frost-900'}`}>{secundaria.label}</Text>
        </Pressable>
      ) : null}

      {!gestiona ? <Text className="mt-2 text-sm text-graphite-400">Este paso lo hace el equipo de producción.</Text> : null}

      {puedeCancelar ? (
        <Pressable
          accessibilityRole="button"
          disabled={accion.isPending}
          onPress={() => setCancelando(true)}
          className="mt-2 min-h-11 items-center justify-center rounded-2xl border border-danger/40 bg-white"
        >
          <Text className="text-sm font-semibold text-danger">Cancelar orden</Text>
        </Pressable>
      ) : null}

      {cancelando ? (
        <CancelarModal
          titulo={`Cancelar ${orden.codigo}`}
          aviso={`${orden.materialesReservados ? 'Se devuelven al inventario las materias primas reservadas. ' : ''}${orden.lotesProducidos.length > 0 ? 'Los lotes ya registrados se quedan en el inventario. ' : ''}La cancelación no se puede deshacer.`}
          placeholder="Ej.: falla en la máquina"
          boton="Cancelar orden"
          enviando={accion.isPending}
          onClose={() => setCancelando(false)}
          onConfirm={(motivo) => ejecutar('cancelar', 'Orden cancelada.', motivo)}
        />
      ) : null}
    </Card>
  );
}
