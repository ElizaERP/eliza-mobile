import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiError } from '@/core/http/apiClient';
import {
  addSalesOrderLine,
  createSalesOrder,
  getCustomer,
  getSalesOrder,
  listCustomers,
  listSalesOrders,
  nuevoCodigoPedido,
  type EstadoPedido,
  type Page,
  type Pedido,
} from './api';

const PAGE_SIZE = 25;

const nextOffset = <T,>(last: Page<T>) =>
  last.offset + last.items.length < last.total ? last.offset + last.items.length : undefined;

export const salesKeys = {
  orders: (estado: EstadoPedido | 'all', clienteId?: string, creadoDesde?: string) =>
    ['sales', 'orders', 'list', estado, clienteId ?? null, creadoDesde ?? null] as const,
  order: (id: string) => ['sales', 'orders', 'detail', id] as const,
  customers: (search: string) => ['sales', 'customers', 'list', search] as const,
  customer: (id: string) => ['sales', 'customers', 'detail', id] as const,
};

/** Pedidos (scroll infinito), por estado, desde una fecha y opcionalmente de un cliente. */
export function useSalesOrderList(estado: EstadoPedido | 'all', clienteId?: string, creadoDesde?: string) {
  return useInfiniteQuery({
    queryKey: salesKeys.orders(estado, clienteId, creadoDesde),
    queryFn: ({ pageParam }) =>
      listSalesOrders({
        estado: estado === 'all' ? undefined : estado,
        clienteId,
        creadoDesde,
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

export interface NuevoPedidoInput {
  clienteId: string;
  notas?: string;
  lineas: { productId: string; productName: string; cantidad: number }[];
}

export interface NuevoPedidoResult {
  pedido: Pedido;
  /** Líneas que el backend rechazó (el pedido queda creado en Borrador con las demás). */
  fallidas: { productName: string; mensaje: string }[];
}

/**
 * Crea el pedido en Borrador y agrega las líneas una por una (el backend no tiene un
 * endpoint de alta en lote). Si una línea falla, el pedido igual existe: se informa
 * cuál falló en vez de reintentar a ciegas y duplicar el pedido.
 */
export function useCrearPedido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NuevoPedidoInput): Promise<NuevoPedidoResult> => {
      let pedido = await createSalesOrder({
        codigo: nuevoCodigoPedido(),
        clienteId: input.clienteId,
        notas: input.notas?.trim() || undefined,
      });
      const fallidas: NuevoPedidoResult['fallidas'] = [];
      for (const l of input.lineas) {
        try {
          pedido = await addSalesOrderLine(pedido.id, { productId: l.productId, cantidad: l.cantidad });
        } catch (e) {
          fallidas.push({ productName: l.productName, mensaje: (e as ApiError).message ?? 'Error' });
        }
      }
      return { pedido, fallidas };
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['sales', 'orders'] }),
  });
}
