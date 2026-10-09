import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Badge } from '@/components/ui/Badge';
import { formatDateTime } from '@/features/inventory/labels';
import type { PedidoListItem } from './api';
import { ESTADO_PEDIDO, money } from './labels';

/** Fila de pedido (lista de Ventas y pedidos de un cliente). */
export function PedidoRow({ pedido, showCliente = true }: { pedido: PedidoListItem; showCliente?: boolean }) {
  const router = useRouter();
  const estado = ESTADO_PEDIDO[pedido.estado];
  const muted = pedido.estado === 'Cancelada';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/(app)/ventas/pedido/[id]', params: { id: pedido.id } })}
      className="rounded-2xl border border-ice-100 bg-white p-4 active:bg-ice-50"
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className={`text-base font-semibold ${muted ? 'text-graphite-400' : 'text-graphite-900'}`} numberOfLines={2}>
            {showCliente ? pedido.clienteRazonSocial : pedido.codigo}
          </Text>
          <Text className="mt-1 text-xs text-graphite-400">
            {showCliente ? `${pedido.codigo} · ` : ''}
            {formatDateTime(pedido.createdAt)}
          </Text>
        </View>
        <Badge label={estado.label} tone={estado.tone} />
      </View>
      <View className="mt-3 flex-row items-end justify-between">
        <Text className="text-xs text-graphite-600">
          {pedido.lineasCount === 1 ? '1 línea' : `${pedido.lineasCount} líneas`}
        </Text>
        <Text className={`text-lg font-bold ${muted ? 'text-graphite-400' : 'text-frost-900'}`}>{money(pedido.total)}</Text>
      </View>
    </Pressable>
  );
}
