import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelOrder,
  completeOrder,
  createOrder,
  getOrder,
  listOrders,
  recordProduction,
  reserveMaterials,
  startOrder,
  type EstadoOrden,
  type NuevaOrdenBody,
  type RegistrarProduccionBody,
} from './api';

const PAGE_SIZE = 25;

export const productionKeys = {
  list: (estado: EstadoOrden | 'all') => ['production', 'orders', 'list', estado] as const,
  order: (id: string) => ['production', 'orders', 'detail', id] as const,
};

/** Órdenes de producción (scroll infinito), opcionalmente filtradas por estado. */
export function useOrderList(estado: EstadoOrden | 'all') {
  return useInfiniteQuery({
    queryKey: productionKeys.list(estado),
    queryFn: ({ pageParam }) =>
      listOrders({ estado: estado === 'all' ? undefined : estado, limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) =>
      last.offset + last.items.length < last.total ? last.offset + last.items.length : undefined,
  });
}

export function useOrder(id: string) {
  return useQuery({ queryKey: productionKeys.order(id), queryFn: () => getOrder(id) });
}

// =====================================================================
// Sprint 12: escritura. Toda acción refresca órdenes e inventario (las
// reservas, los lotes nuevos y el consumo cambian el stock).
// =====================================================================

function useRefrescar() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['production', 'orders'] });
    void qc.invalidateQueries({ queryKey: ['inventory'] });
  };
}

export function useCrearOrden() {
  const refrescar = useRefrescar();
  return useMutation({ mutationFn: (body: NuevaOrdenBody) => createOrder(body), onSettled: refrescar });
}

export type AccionOrden = 'reservar' | 'iniciar' | 'completar' | 'cancelar';

export function useAccionOrden(id: string) {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: async ({ accion, motivo }: { accion: AccionOrden; motivo?: string }): Promise<void> => {
      if (accion === 'reservar') await reserveMaterials(id);
      else if (accion === 'iniciar') await startOrder(id);
      else if (accion === 'completar') await completeOrder(id);
      else await cancelOrder(id, (motivo ?? '').trim());
    },
    onSettled: refrescar,
  });
}

export function useRegistrarProduccion(id: string) {
  const refrescar = useRefrescar();
  return useMutation({ mutationFn: (body: RegistrarProduccionBody) => recordProduction(id, body), onSettled: refrescar });
}
