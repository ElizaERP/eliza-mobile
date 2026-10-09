import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { getOrder, listOrders, type EstadoOrden } from './api';

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
