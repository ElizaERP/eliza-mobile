import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  getCustomer,
  getSalesOrder,
  listCustomers,
  listSalesOrders,
  type EstadoPedido,
  type Page,
} from './api';

const PAGE_SIZE = 25;

const nextOffset = <T,>(last: Page<T>) =>
  last.offset + last.items.length < last.total ? last.offset + last.items.length : undefined;

export const salesKeys = {
  orders: (estado: EstadoPedido | 'all', clienteId?: string) =>
    ['sales', 'orders', 'list', estado, clienteId ?? null] as const,
  order: (id: string) => ['sales', 'orders', 'detail', id] as const,
  customers: (search: string) => ['sales', 'customers', 'list', search] as const,
  customer: (id: string) => ['sales', 'customers', 'detail', id] as const,
};

/** Pedidos (scroll infinito), por estado y opcionalmente de un cliente. */
export function useSalesOrderList(estado: EstadoPedido | 'all', clienteId?: string) {
  return useInfiniteQuery({
    queryKey: salesKeys.orders(estado, clienteId),
    queryFn: ({ pageParam }) =>
      listSalesOrders({
        estado: estado === 'all' ? undefined : estado,
        clienteId,
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: nextOffset,
  });
}

export function useSalesOrder(id: string) {
  return useQuery({ queryKey: salesKeys.order(id), queryFn: () => getSalesOrder(id) });
}

/** Clientes (scroll infinito) con búsqueda por razón social, NIT, nombre comercial o código. */
export function useCustomerList(search: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: salesKeys.customers(search),
    queryFn: ({ pageParam }) =>
      listCustomers({ search: search || undefined, limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: nextOffset,
    enabled,
  });
}

export function useCustomer(id: string) {
  return useQuery({ queryKey: salesKeys.customer(id), queryFn: () => getCustomer(id) });
}
