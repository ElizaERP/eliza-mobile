import type { Tone } from '@/features/catalog/labels';
import type { EstadoLote, TipoMovimiento } from './api';

export const LOTE_ESTADO: Record<EstadoLote, { label: string; tone: Tone }> = {
  Disponible: { label: 'Disponible', tone: 'ok' },
  Bloqueado: { label: 'Bloqueado', tone: 'warn' },
  Cuarentena: { label: 'Cuarentena', tone: 'warn' },
  Vencido: { label: 'Vencido', tone: 'neutral' },
};

/** sign: +1 suma al físico, -1 resta, 0 no cambia el físico (reservas). */
export const MOVIMIENTO: Record<TipoMovimiento, { label: string; sign: 1 | -1 | 0 }> = {
  Entrada: { label: 'Entrada', sign: 1 },
  Salida: { label: 'Salida', sign: -1 },
  TransferenciaEntrada: { label: 'Transferencia (entra)', sign: 1 },
  TransferenciaSalida: { label: 'Transferencia (sale)', sign: -1 },
  Ajuste: { label: 'Ajuste', sign: 0 },
  Reserva: { label: 'Reserva', sign: 0 },
  LiberacionReserva: { label: 'Liberación de reserva', sign: 0 },
};

export const EXPIRY_WINDOWS = [7, 30, 90] as const;

const fmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtTime = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** Fechas de vencimiento: "YYYY-MM-DD" (sin hora) → se muestran sin corrimiento de zona. */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  return fmt.format(new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

export function formatDateTime(iso: string): string {
  return fmtTime.format(new Date(iso));
}

/** Días hasta una fecha "YYYY-MM-DD" contados en fechas locales. */
export function daysUntil(isoDate: string): number {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  const target = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target - today) / 86_400_000);
}

export function expiryText(days: number): { text: string; tone: Tone } {
  if (days < 0) return { text: `venció hace ${-days} d`, tone: 'neutral' };
  if (days === 0) return { text: 'vence hoy', tone: 'warn' };
  if (days <= 30) return { text: `vence en ${days} d`, tone: 'warn' };
  return { text: `vence en ${days} d`, tone: 'ok' };
}

export function qty(n: number): string {
  return n.toLocaleString('es-CO');
}
