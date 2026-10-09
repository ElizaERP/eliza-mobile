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
  return { ...data, componentes: (data.componentes ?? []).map(normalizeComponente) };
}

/**
 * Las órdenes creadas antes del fix del backend (eliza-foundation 9be9cb5) guardaron el
 * snapshot del BOM con ids como objetos ({ value }) y cantidades nulas (NaN serializado).
 * Se normaliza aquí para que la pantalla nunca reciba objetos ni nulos en esos campos.
 */
function normalizeComponente(raw: ComponenteOrden): ComponenteOrden {
  const r = raw as unknown as Record<string, unknown>;
  const text = (v: unknown): string =>
    typeof v === 'string' ? v : typeof (v as { value?: unknown })?.value === 'string' ? (v as { value: string }).value : '—';
  const qty = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number.NaN);
  return {
    productId: text(r.productId),
    productCode: text(r.productCode),
    productName: text(r.productName),
    cantidadPorUnidad: qty(r.cantidadPorUnidad),
    cantidadTotalRequerida: qty(r.cantidadTotalRequerida),
    unidadMedida: text(r.unidadMedida),
  };
}
