import { apiClient } from '@/core/http/apiClient';

/**
 * Cliente de Producción — contrato de eliza-foundation
 * (src/contexts/manufacturing/application/dto/manufacturing.views.ts).
 * Sprint 9.4: lectura. Sprint 12: crear órdenes y ejecutarlas
 * (reservar materiales → iniciar → registrar producción → completar, o cancelar).
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

// ---------------------------------------------------------------------
// Sprint 12: escritura
// ---------------------------------------------------------------------

export interface NuevaOrdenBody {
  codigo: string;
  productoTerminadoId: string;
  cantidadObjetivo: number;
  prioridad?: PrioridadOrden;
  /** AAAA-MM-DD */
  fechaProgramada?: string;
  notas?: string;
}

export async function createOrder(body: NuevaOrdenBody): Promise<OrdenDetalle> {
  const { data } = await apiClient.post<OrdenDetalle>('/v1/manufacturing/orders', body);
  return data;
}

/** Reserva FEFO de todas las materias primas (todo o nada). 409 manufacturing.insufficient_stock si alguna no alcanza. */
export async function reserveMaterials(id: string): Promise<{ componentesReservados: number }> {
  const { data } = await apiClient.post<{ componentesReservados: number }>(`/v1/manufacturing/orders/${id}/reserve-materials`);
  return data;
}

export async function startOrder(id: string): Promise<OrdenDetalle> {
  const { data } = await apiClient.post<OrdenDetalle>(`/v1/manufacturing/orders/${id}/start`);
  return data;
}

export interface RegistrarProduccionBody {
  codigoLote: string;
  cantidad: number;
  /** AAAA-MM-DD */
  fechaVencimiento: string;
  locationId: string;
  notas?: string;
}

/** Crea el lote de producto terminado y lo ingresa al inventario en la ubicación elegida. */
export async function recordProduction(id: string, body: RegistrarProduccionBody): Promise<OrdenDetalle> {
  const { data } = await apiClient.post<OrdenDetalle>(`/v1/manufacturing/orders/${id}/production`, body);
  return data;
}

/** Completa la orden y descuenta del inventario las materias primas reservadas. */
export async function completeOrder(id: string): Promise<OrdenDetalle> {
  const { data } = await apiClient.post<OrdenDetalle>(`/v1/manufacturing/orders/${id}/complete`);
  return data;
}

export async function cancelOrder(id: string, motivo: string): Promise<OrdenDetalle> {
  const { data } = await apiClient.post<OrdenDetalle>(`/v1/manufacturing/orders/${id}/cancel`, { motivo });
  return data;
}

const p2 = (n: number) => String(n).padStart(2, '0');
const sello = (d: Date) =>
  `${String(d.getFullYear()).slice(2)}${p2(d.getMonth() + 1)}${p2(d.getDate())}${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;

/** Código de orden creada desde la app: OP-M-AAMMDDHHMMSS-XXX. */
export function nuevoCodigoOrden(now = new Date()): string {
  const rnd = Math.random().toString(36).slice(2, 5).toUpperCase().padEnd(3, '0');
  return `OP-M-${sello(now)}-${rnd}`;
}

/**
 * Código de lote sugerido: L-AAMMDD-<CÓDIGO PT>-HHMM (solo A-Z, 0-9 y guiones, ≤ 50).
 * Editable en el formulario; el backend exige ^[A-Z0-9][A-Z0-9-]{2,49}$ y que no se repita.
 */
export function sugerirCodigoLote(productCode: string, now = new Date()): string {
  const code = productCode.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 30) || 'PT';
  const dia = `${String(now.getFullYear()).slice(2)}${p2(now.getMonth() + 1)}${p2(now.getDate())}`;
  return `L-${dia}-${code}-${p2(now.getHours())}${p2(now.getMinutes())}`.slice(0, 50);
}

/** Fecha local AAAA-MM-DD sumando días (vencimiento sugerido = hoy + vida útil del producto). */
export function fechaMasDias(dias: number, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dias);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}
