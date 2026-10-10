import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '@/core/auth';
import type { ApiError } from '@/core/http/apiClient';
import { canCancelProduction, canManageProduction } from '@/core/rbac/menu';
import { Badge } from '@/components/ui/Badge';
import { CancelarModal } from '@/components/ui/CancelarModal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Card } from '@/components/ui/Section';
import type { OrdenDetalle } from '@/features/production/api';
import { useAccionJornada, useJornada, type AccionJornada } from '@/features/production/hooks';
import { ESTADO_JORNADA, ESTADO_ORDEN, num, progress } from '@/features/production/labels';
import { formatDate } from '@/features/inventory/labels';

/**
 * Jornada de producción (Sprint 15): varios productos del mismo día.
 *   Reservar todo (todo o nada) → Iniciar todo → por producto: Registrar lote y
 *   Completar (consumo real) · Cancelar jornada devuelve las reservas.
 */
export default function JornadaScreen() {
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  const router = useRouter();
  const roles = useAuthStore((s) => s.user?.roles) ?? [];
  const gestiona = canManageProduction(roles);
  const jornada = useJornada(codigo ?? '');
  const accion = useAccionJornada(codigo ?? '');
  const [cancelando, setCancelando] = useState(false);
  const j = jornada.data;
  const err = jornada.error as ApiError | null;

  const planificadas = (j?.ordenes ?? []).filter((o) => o.estado === 'Planificada');
  const porReservar = planificadas.filter((o) => !o.materialesReservados);
  const activas = (j?.ordenes ?? []).filter((o) => o.estado === 'Planificada' || o.estado === 'EnProceso');

  const ejecutar = (a: AccionJornada, hecho: string, motivo?: string) =>
    accion.mutate(
      { accion: a, motivo },
      {
        onSuccess: () => {
          if (a === 'cancelar') setCancelando(false);
          Alert.alert('Listo', hecho);
        },
        onError: (e) => {
          const er = e as unknown as ApiError;
          Alert.alert(er.code === 'manufacturing.insufficient_stock' ? 'Materia prima insuficiente' : 'No se pudo completar', er.message);
        },
      },
    );

  return (
    <>
      <Stack.Screen options={{ title: 'Jornada' }} />
      <ScrollView
        className="flex-1 bg-snow"
        contentContainerClassName="p-5 pb-10"
        refreshControl={<RefreshControl refreshing={jornada.isRefetching} onRefresh={() => void jornada.refetch()} />}
      >
        {jornada.isLoading ? <ActivityIndicator className="mt-10" color="#0B3A53" /> : null}
        {err ? (
          <View className="rounded-2xl bg-danger/10 p-4">
            <Text className="text-sm font-semibold text-danger">No se pudo cargar la jornada</Text>
            <Text className="mt-1 text-sm text-graphite-600">{err.message}</Text>
          </View>
        ) : null}

        {j ? (
          <>
            <Text className="text-xl font-bold text-graphite-900">
              Jornada {j.fechaProgramada ? formatDate(j.fechaProgramada) : ''}
            </Text>
            <Text className="mt-1 text-xs text-graphite-400">
              {j.codigo} · {j.ordenes.length} producto(s)
            </Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              <Badge label={ESTADO_JORNADA[j.estado].label} tone={ESTADO_JORNADA[j.estado].tone} />
              {planificadas.length > 0 ? (
                <Badge label={porReservar.length === 0 ? 'Materiales reservados' : 'Sin reservar materiales'} tone={porReservar.length === 0 ? 'ok' : 'neutral'} />
              ) : null}
            </View>
            {j.notas ? <Text className="mt-3 text-sm text-graphite-600">{j.notas}</Text> : null}

            {gestiona && planificadas.length > 0 ? (
              <Card className="mt-4">
                <Text className="text-xs font-semibold uppercase tracking-wide text-graphite-400">Siguiente paso</Text>
                {porReservar.length > 0 ? (
                  <>
                    <Text className="mt-1 text-sm text-graphite-600">
                      Aparta las materias primas de todos los productos. Si alguna no alcanza, no se reserva nada.
                    </Text>
                    <Boton
                      label={`Reservar todo (${porReservar.length})`}
                      cargando={accion.isPending && !cancelando}
                      disabled={accion.isPending}
                      onPress={() =>
                        Alert.alert('Reservar materiales', `Se reservan las materias primas de ${porReservar.length} producto(s).`, [
                          { text: 'Volver', style: 'cancel' },
                          { text: 'Reservar', onPress: () => ejecutar('reservar', 'Materiales de la jornada reservados.') },
                        ])
                      }
                    />
                  </>
                ) : (
                  <>
                    <Text className="mt-1 text-sm text-graphite-600">Materiales apartados. Inicia la jornada cuando empiece la producción.</Text>
                    <Boton
                      label="Iniciar jornada"
                      cargando={accion.isPending && !cancelando}
                      disabled={accion.isPending}
                      onPress={() =>
                        Alert.alert('Iniciar jornada', `Se inician ${planificadas.length} producto(s).`, [
                          { text: 'Volver', style: 'cancel' },
                          { text: 'Iniciar', onPress: () => ejecutar('iniciar', 'Jornada iniciada.') },
                        ])
                      }
                    />
                  </>
                )}
              </Card>
            ) : null}

            <Text className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-graphite-400">Productos</Text>
            <View className="gap-3">
              {j.ordenes.map((o) => (
                <Producto key={o.id} orden={o} gestiona={gestiona} onVer={() => router.push({ pathname: '/(app)/produccion/[id]', params: { id: o.id } })} />
              ))}
            </View>

            {canCancelProduction(roles) && activas.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                disabled={accion.isPending}
                onPress={() => setCancelando(true)}
                className="mt-6 min-h-11 items-center justify-center rounded-2xl border border-danger/40 bg-white"
              >
                <Text className="text-sm font-semibold text-danger">Cancelar jornada</Text>
              </Pressable>
            ) : null}

            {cancelando ? (
              <CancelarModal
                titulo="Cancelar jornada"
                aviso={`Se cancelan ${activas.length} producto(s) y vuelven al inventario sus materias primas reservadas. Los productos ya completados y los lotes registrados se quedan. No se puede deshacer.`}
                placeholder="Ej.: se dañó el molino"
                boton="Cancelar jornada"
                enviando={accion.isPending}
                onClose={() => setCancelando(false)}
                onConfirm={(motivo) => ejecutar('cancelar', 'Jornada cancelada.', motivo)}
              />
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

function Producto({ orden: o, gestiona, onVer }: { orden: OrdenDetalle; gestiona: boolean; onVer: () => void }) {
  const router = useRouter();
  const p = progress(o.cantidadRealProducida, o.cantidadObjetivo);
  const muted = o.estado === 'Cancelada';
  const enProceso = o.estado === 'EnProceso';
  const conLotes = o.lotesProducidos.length > 0;
  return (
    <Pressable accessibilityRole="button" onPress={onVer} className="rounded-2xl border border-ice-100 bg-white p-4 active:bg-ice-50">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className={`text-base font-semibold ${muted ? 'text-graphite-400' : 'text-graphite-900'}`}>{o.productoTerminado.name}</Text>
          <Text className="mt-1 text-xs text-graphite-400">{o.codigo}</Text>
        </View>
        <Badge label={ESTADO_ORDEN[o.estado].label} tone={ESTADO_ORDEN[o.estado].tone} />
      </View>
      <View className="mb-1 mt-3 flex-row justify-between">
        <Text className="text-xs text-graphite-600">
          Producido <Text className="font-bold text-graphite-900">{num(o.cantidadRealProducida)}</Text> de {num(o.cantidadObjetivo)}
          {conLotes ? ` · ${o.lotesProducidos.length} lote(s)` : ''}
        </Text>
        <Text className="text-xs text-graphite-400">{Math.round(p * 100)} %</Text>
      </View>
      <ProgressBar value={p} muted={muted} />
      {gestiona && enProceso ? (
        <View className="mt-3 flex-row gap-2">
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/(app)/produccion/producir/[id]', params: { id: o.id } })}
            className="min-h-10 flex-1 items-center justify-center rounded-xl bg-frost-900"
          >
            <Text className="text-sm font-semibold text-white">Registrar lote</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!conLotes}
            onPress={() => router.push({ pathname: '/(app)/produccion/completar/[id]', params: { id: o.id } })}
            className={`min-h-10 flex-1 items-center justify-center rounded-xl border ${conLotes ? 'border-frost-700 bg-white' : 'border-ice-100 bg-white'}`}
          >
            <Text className={`text-sm font-semibold ${conLotes ? 'text-frost-900' : 'text-graphite-400'}`}>Completar</Text>
          </Pressable>
        </View>
      ) : null}
    </Pressable>
  );
}

function Boton({ label, onPress, disabled, cargando }: { label: string; onPress: () => void; disabled?: boolean; cargando?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className={`mt-3 min-h-12 items-center justify-center rounded-2xl ${disabled ? 'bg-graphite-400/40' : 'bg-frost-900'}`}
    >
      {cargando ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-base font-semibold text-white">{label}</Text>}
    </Pressable>
  );
}
