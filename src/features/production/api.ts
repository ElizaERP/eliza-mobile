import { apiClient } from '@/core/http/apiClient';

/**
 * Cliente de Producción — contrato de eliza-foundation
 * (src/contexts/manufacturing/application/dto/manufacturing.views.ts).
 * Sprint 9.4: solo lectura.
 */

export type EstadoOrden = 'Planificada' | 'EnProceso' | 'Completada' | 'Cerrada' | 'Cancelada';
export type PrioridadOrden = 'Alta' | 'Media' | 'Baja';

/** Fila del listado (versión ligera). */
export interface OrdenListItem {
  id: string;
  codigo: string;
  productoTerminadoCode: string;
  productoTerminadoName: string;
  cantidadObjetivo: number;
  cantidadRealProducida: number;
  estado: EstadoOrden;
  prioridad: PrioridadOrden;
  materialesReservados: boolean;
  consumosCount: number;
  lotesProducidosCount: number;
  fechaProgramada: string | null;
  createdAt: string;
}

export interface OrdenPage {
  items: OrdenListItem[];
  total: number;
  limit: number;
  offset: number;
}

/** Componente del BOM copiado en la orden al crearla (cantidades × objetivo). */
export interface ComponenteOrden {
  productId: string;
  productCode: string;
  productName: string;
  cantidadPorUnidad: number;
  cantidadTotalRequerida: number;
  unidadMedida: string;
}

export interface ConsumoMp {
  id: string;
  productId: string;
  productCode: string;
  loteId: string;
  codigoLote: string;
  cantidad: number;
  unidadMedida: string;
  movimientoId: string;
  consumidoEn: string;
}

export interface LoteProducido {
  id: string;
  loteId: string;
  codigoLote: string;
  productId: string;
  cantidad: number;
  locationId: string;
  movimientoId: string;
  producidoEn: string;
}

export interface OrdenDetalle {
  id: string;
  codigo: string;
  productoTerminado: { id: string; code: string; name: string };
  cantidadObjetivo: number;
  cantidadRealProducida: number;
  estado: EstadoOrden;
  prioridad: PrioridadOrden;
  componentes: ComponenteOrden[];
  materialesReservados: boolean;
  consumos: ConsumoMp[];
  lotesProducidos: LoteProducido[];
  notas: string | null;
  canceladoMotivo: string | null;
  canceladoPor: string | null;
  canceladoEn: string | null;
  fechaProgramada: string | null;
  iniciadoEn: string | null;
  completadoEn: string | null;
  cerradoEn: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listOrders(params: {
  estado?: EstadoOrden;
  limit: number;
  offset: number;
}): Promise<OrdenPage> {
  const { data } = await apiClient.get<OrdenPage>('/v1/manufacturing/orders', { params });
  return data;
}

export async function getOrder(id: string): Promise<OrdenDetalle> {
  const { data } = await apiClient.get<OrdenDetalle>(`/v1/manufacturing/orders/${id}`);
  return data;
}
