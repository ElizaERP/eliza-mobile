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

// ---------------------------------------------------------------------
// Período del listado de pedidos (la jornada de hoy primero)
// ---------------------------------------------------------------------
export type Periodo = 'hoy' | 'semana' | 'mes' | 'todo';

export const PERIODO_FILTERS: { key: Periodo; label: string }[] = [
  { key: 'hoy', label: 'Hoy' },
  { key: 'semana', label: '7 días' },
  { key: 'mes', label: 'Este mes' },
  { key: 'todo', label: 'Todo' },
];

const startOfLocalDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Inicio del período en hora local del teléfono, como ISO 8601 (undefined = sin límite). */
export function periodoDesde(periodo: Periodo, now = new Date()): string | undefined {
  const hoy = startOfLocalDay(now);
  if (periodo === 'hoy') return hoy.toISOString();
  if (periodo === 'semana') return new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 6).toISOString();
  if (periodo === 'mes') return new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString();
  return undefined;
}

/** Clave de día local (AAAA-MM-DD) de un instante ISO, para agrupar. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const fmtDia = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });

/** "Hoy", "Ayer" o "lun, 6 de oct". */
export function dayLabel(key: string, now = new Date()): string {
  const [y, m, d] = key.split('-').map(Number);
  const day = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  const diff = Math.round((startOfLocalDay(now).getTime() - day.getTime()) / 86_400_000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  return fmtDia.format(day);
}
