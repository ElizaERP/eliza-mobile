import { apiClient } from '@/core/http/apiClient';

/**
 * Cliente de Inventario — contrato de eliza-foundation
 * (src/contexts/inventory/application/dto/inventory.views.ts).
 * Sprint 9.3: lectura. Sprint 13: recibir mercancía, contar, mover y bloquear lotes.
 */

export type EstadoLote = 'Disponible' | 'Bloqueado' | 'Cuarentena' | 'Vencido';
export type TipoMovimiento =
  | 'Entrada'
  | 'Salida'
  | 'TransferenciaSalida'
  | 'TransferenciaEntrada'
  | 'Ajuste'
  | 'Reserva'
  | 'LiberacionReserva';

export interface StockByLot {
  loteId: string;
  codigoLote: string;
  fechaVencimiento: string;
  estado: EstadoLote;
  /** Disponible y sin vencer: los pedidos y órdenes pueden reservar de este lote. */
  reservable: boolean;
  cantidadDisponible: number;
  cantidadReservada: number;
  cantidadBloqueada: number;
  ubicaciones: StockUbicacion[];
}

export interface StockUbicacion {
  existenciaId: string;
  locationId: string;
  cantidadDisponible: number;
  cantidadReservada: number;
  cantidadBloqueada: number;
}

export interface StockSummary {
  productId: string;
  /** Solo lo reservable; el disponible de lotes bloqueados o vencidos va en totalBloqueado. */
  totalDisponible: number;
  totalReservado: number;
  totalBloqueado: number;
  totalFisico: number;
  porLote: StockByLot[];
}

export interface Lote {
  id: string;
  codigoLote: string;
  productId: string;
  fechaProduccion: string;
  fechaVencimiento: string;
  cantidadInicial: number;
  estado: EstadoLote;
  origenTipo: 'Production' | 'Purchase' | 'Manual';
  diasParaVencer: number;
  estaVencido: boolean;
}

export interface Movimiento {
  id: string;
  tipo: TipoMovimiento;
  productId: string;
  loteId: string | null;
  locationId: string;
  locationDestinoId: string | null;
  cantidad: number;
  referenciaTipo: string;
  referenciaId: string;
  motivo: string | null;
  ocurridoEn: string;
}

export interface MovementPage {
  items: Movimiento[];
  total: number;
  limit: number;
  offset: number;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface Location {
  id: string;
  warehouseId: string;
  code: string;
  name: string;
  tipoUbicacion: string;
}

export async function getStockByProduct(productId: string): Promise<StockSummary> {
  const { data } = await apiClient.get<StockSummary>(`/v1/inventory/stock/by-sku/${productId}`);
  return data;
}

export async function listExpiringLots(withinDays: number): Promise<Lote[]> {
  const { data } = await apiClient.get<Lote[]>('/v1/inventory/lots/expiring', {
    params: { withinDays, limit: 200 },
  });
  return data;
}

export async function listMovements(productId: string, limit = 20): Promise<MovementPage> {
  const { data } = await apiClient.get<MovementPage>('/v1/inventory/movements', {
    params: { productId, limit, offset: 0 },
  });
  return data;
}

export async function listWarehouses(): Promise<Warehouse[]> {
  const { data } = await apiClient.get<Warehouse[]>('/v1/inventory/warehouses');
  return data;
}

export async function listLocations(warehouseId: string): Promise<Location[]> {
  const { data } = await apiClient.get<Location[]>(
    `/v1/inventory/warehouses/${warehouseId}/locations`,
  );
  return data;
}

// =====================================================================
// Sprint 13: escritura
// =====================================================================

export type OrigenEntrada = 'Purchase' | 'Manual';

export interface EntradaBody {
  productId: string;
  codigoLote: string;
  cantidad: number;
  locationId: string;
  /** AAAA-MM-DD */
  fechaVencimiento: string;
  origenTipo: OrigenEntrada;
  /** Factura/remisión del proveedor, o referencia de la entrada manual. */
  documento: string;
  notas?: string;
}

/** Recibir mercancía: crea el lote y lo ingresa en la ubicación en un solo paso. */
export async function registrarEntrada(body: EntradaBody): Promise<{ lote: Lote; movimientoId: string }> {
  const { data } = await apiClient.post<{ lote: Lote; movimientoId: string }>('/v1/inventory/stock/receipts', body);
  return data;
}

/** Ajuste por conteo físico: el servidor calcula la diferencia contra el sistema. */
export async function ajustarConteo(existenciaId: string, cantidadContada: number, motivo: string): Promise<void> {
  await apiClient.post(`/v1/inventory/stock/adjust/${existenciaId}`, { cantidadContada, motivo });
}

export interface TransferenciaBody {
  productId: string;
  loteId: string;
  origenLocationId: string;
  destinoLocationId: string;
  cantidad: number;
}

export async function transferir(body: TransferenciaBody): Promise<void> {
  await apiClient.post('/v1/inventory/stock/transfer', body);
}

export async function bloquearLote(loteId: string, reason: string): Promise<void> {
  await apiClient.post(`/v1/inventory/lots/${loteId}/block`, { reason });
}

export async function liberarLote(loteId: string): Promise<void> {
  await apiClient.post(`/v1/inventory/lots/${loteId}/release`);
}
