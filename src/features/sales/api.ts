import { apiClient } from '@/core/http/apiClient';

/**
 * Cliente de Ventas — contrato de eliza-foundation
 * (src/contexts/sales/application/dto/sales.views.ts).
 * Sprint 9.5: solo lectura.
 */

export type EstadoCliente = 'Activo' | 'Inactivo' | 'Suspendido';
export type EstadoPedido = 'Borrador' | 'Confirmada' | 'Reservada' | 'Despachada' | 'Cerrada' | 'Cancelada';
export type CondicionesPago = 'Contado' | 'Credito15' | 'Credito30' | 'Credito60' | 'Credito90';

export interface Direccion {
  direccion: string;
  ciudad: string;
  departamento: string;
  telefono: string | null;
  notas: string | null;
}

export interface ClienteListItem {
  id: string;
  codigo: string;
  nit: string;
  razonSocial: string;
  nombreComercial: string | null;
  estado: EstadoCliente;
  condicionesPago: CondicionesPago;
  ciudad: string;
  createdAt: string;
}

export interface Cliente {
  id: string;
  codigo: string;
  nit: string;
  razonSocial: string;
  nombreComercial: string | null;
  estado: EstadoCliente;
  condicionesPago: CondicionesPago;
  direccionFiscal: Direccion;
  direccionEntrega: Direccion | null;
  contactoNombre: string | null;
  contactoTelefono: string | null;
  contactoEmail: string | null;
  notas: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PedidoListItem {
  id: string;
  codigo: string;
  clienteCodigo: string;
  clienteRazonSocial: string;
  estado: EstadoPedido;
  lineasCount: number;
  total: number;
  confirmadoEn: string | null;
  createdAt: string;
}

export interface LineaPedido {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  cantidad: number;
  precioUnitario: number;
  tasaIva: number;
  subtotal: number;
  iva: number;
  total: number;
  notas: string | null;
}

export interface Pedido {
  id: string;
  codigo: string;
  cliente: { id: string; codigo: string; razonSocial: string };
  estado: EstadoPedido;
  condicionesPago: CondicionesPago;
  direccionEntrega: Direccion;
  lineas: LineaPedido[];
  subtotal: number;
  ivaTotal: number;
  total: number;
  notas: string | null;
  canceladoMotivo: string | null;
  canceladoPor: string | null;
  canceladoEn: string | null;
  confirmadoEn: string | null;
  reservadoEn: string | null;
  despachadoEn: string | null;
  cerradoEn: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export async function listCustomers(params: {
  search?: string;
  estado?: EstadoCliente;
  limit: number;
  offset: number;
}): Promise<Page<ClienteListItem>> {
  const { data } = await apiClient.get<Page<ClienteListItem>>('/v1/sales/customers', { params });
  return data;
}

export async function getCustomer(id: string): Promise<Cliente> {
  const { data } = await apiClient.get<Cliente>(`/v1/sales/customers/${id}`);
  return data;
}

export async function listSalesOrders(params: {
  estado?: EstadoPedido;
  clienteId?: string;
  limit: number;
  offset: number;
}): Promise<Page<PedidoListItem>> {
  const { data } = await apiClient.get<Page<PedidoListItem>>('/v1/sales/orders', { params });
  return data;
}

export async function getSalesOrder(id: string): Promise<Pedido> {
  const { data } = await apiClient.get<Pedido>(`/v1/sales/orders/${id}`);
  return data;
}
