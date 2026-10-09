import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiError } from '@/core/http/apiClient';
import {
  activateCustomer,
  addSalesOrderLine,
  cancelSalesOrder,
  closeSalesOrder,
  confirmSalesOrder,
  dispatchSalesOrder,
  removeSalesOrderLine,
  reserveSalesOrder,
  suspendCustomer,
  updateCustomer,
  type EditarClienteBody,
  createCustomer,
  createSalesOrder,
  getCustomer,
  getSalesOrder,
  listCustomers,
  listSalesOrders,
  nuevoCodigoCliente,
  nuevoCodigoPedido,
  type Cliente,
  type EstadoPedido,
  type NuevoClienteBody,
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

/** Registra un cliente (el código lo genera la app) y refresca las listas de clientes. */
export function useRegistrarCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<NuevoClienteBody, 'codigo'>): Promise<Cliente> =>
      createCustomer({ ...body, codigo: nuevoCodigoCliente() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sales', 'customers'] }),
  });
}

// =====================================================================
// Sprint 11: acciones sobre pedidos y clientes
// =====================================================================

export type AccionPedido = 'confirmar' | 'reservar' | 'despachar' | 'cerrar' | 'cancelar';

/**
 * Avanza o cancela un pedido. Al terminar (bien o mal) refresca el detalle y los
 * listados: si falló porque otro usuario ya lo movió, la pantalla muestra el estado real.
 */
export function useAccionPedido(ordenId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ accion, motivo }: { accion: AccionPedido; motivo?: string }): Promise<void> => {
      if (accion === 'confirmar') await confirmSalesOrder(ordenId);
      else if (accion === 'reservar') await reserveSalesOrder(ordenId);
      else if (accion === 'despachar') await dispatchSalesOrder(ordenId);
      else if (accion === 'cerrar') await closeSalesOrder(ordenId);
      else await cancelSalesOrder(ordenId, (motivo ?? '').trim());
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['sales', 'orders'] }),
  });
}

export function useQuitarLinea(ordenId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lineaId: string) => removeSalesOrderLine(ordenId, lineaId),
    onSuccess: (pedido) => qc.setQueryData(salesKeys.order(ordenId), pedido),
    onSettled: () => qc.invalidateQueries({ queryKey: ['sales', 'orders'] }),
  });
}

/** Agrega productos a un pedido en Borrador, uno por uno; informa los que fallen. */
export function useAgregarLineas(ordenId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      lineas: { productId: string; productName: string; cantidad: number }[],
    ): Promise<{ agregadas: number; fallidas: { productName: string; mensaje: string }[] }> => {
      let agregadas = 0;
      const fallidas: { productName: string; mensaje: string }[] = [];
      for (const l of lineas) {
        try {
          await addSalesOrderLine(ordenId, { productId: l.productId, cantidad: l.cantidad });
          agregadas++;
        } catch (e) {
          fallidas.push({ productName: l.productName, mensaje: (e as ApiError).message ?? 'Error' });
        }
      }
      return { agregadas, fallidas };
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['sales', 'orders'] }),
  });
}

export function useEditarCliente(clienteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: EditarClienteBody) => updateCustomer(clienteId, body),
    onSuccess: (c) => qc.setQueryData(salesKeys.customer(clienteId), c),
    onSettled: () => qc.invalidateQueries({ queryKey: ['sales', 'customers'] }),
  });
}

export function useEstadoCliente(clienteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accion: 'suspender' | 'activar') =>
      accion === 'suspender' ? suspendCustomer(clienteId) : activateCustomer(clienteId),
    onSuccess: (c) => qc.setQueryData(salesKeys.customer(clienteId), c),
    onSettled: () => qc.invalidateQueries({ queryKey: ['sales', 'customers'] }),
  });
}
