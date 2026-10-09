import type { Tone } from '@/features/catalog/labels';
import type { CondicionesPago, EstadoCliente, EstadoPedido } from './api';

export const ESTADO_PEDIDO: Record<EstadoPedido, { label: string; tone: Tone }> = {
  Borrador: { label: 'Borrador', tone: 'neutral' },
  Confirmada: { label: 'Confirmado', tone: 'info' },
  Reservada: { label: 'Reservado', tone: 'warn' },
  Despachada: { label: 'Despachado', tone: 'ok' },
  Cerrada: { label: 'Cerrado', tone: 'neutral' },
  Cancelada: { label: 'Cancelado', tone: 'neutral' },
};

/** Filtros del listado, en el orden del ciclo de vida de un pedido. */
export const ESTADO_PEDIDO_FILTERS: { key: EstadoPedido | 'all'; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'Borrador', label: 'Borrador' },
  { key: 'Confirmada', label: 'Confirmados' },
  { key: 'Reservada', label: 'Reservados' },
  { key: 'Despachada', label: 'Despachados' },
  { key: 'Cerrada', label: 'Cerrados' },
  { key: 'Cancelada', label: 'Cancelados' },
];

export const ESTADO_CLIENTE: Record<EstadoCliente, { label: string; tone: Tone }> = {
  Activo: { label: 'Activo', tone: 'ok' },
  Inactivo: { label: 'Inactivo', tone: 'neutral' },
  Suspendido: { label: 'Suspendido', tone: 'warn' },
};

export const CONDICIONES_PAGO: Record<CondicionesPago, string> = {
  Contado: 'Contado',
  Credito15: 'Crédito 15 días',
  Credito30: 'Crédito 30 días',
  Credito60: 'Crédito 60 días',
  Credito90: 'Crédito 90 días',
};

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

/** Pesos colombianos sin decimales: $ 64.260 */
export function money(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return cop.format(n);
}

export function direccionTexto(d: { direccion: string; ciudad: string; departamento: string }): string {
  return [d.direccion, d.ciudad, d.departamento].filter(Boolean).join(', ');
}
