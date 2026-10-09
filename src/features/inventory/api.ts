import { apiClient } from '@/core/http/apiClient';

/**
 * Cliente de Inventario — contrato de eliza-foundation
 * (src/contexts/inventory/application/dto/inventory.views.ts).
 * Sprint 9.3: solo lectura.
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
  cantidadDisponible: number;
  cantidadReservada: number;
  cantidadBloqueada: number;
  ubicaciones: { locationId: string; cantidadDisponible: number; cantidadReservada: number }[];
}

export interface StockSummary {
  productId: string;
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
