import type { Tone } from '@/features/catalog/labels';
import type { EstadoOrden, PrioridadOrden } from './api';

export const ESTADO_ORDEN: Record<EstadoOrden, { label: string; tone: Tone }> = {
  Planificada: { label: 'Planificada', tone: 'info' },
  EnProceso: { label: 'En proceso', tone: 'warn' },
  Completada: { label: 'Completada', tone: 'ok' },
  Cerrada: { label: 'Cerrada', tone: 'neutral' },
  Cancelada: { label: 'Cancelada', tone: 'neutral' },
};

export const PRIORIDAD: Record<PrioridadOrden, { label: string; tone: Tone }> = {
  Alta: { label: 'Prioridad alta', tone: 'warn' },
  Media: { label: 'Prioridad media', tone: 'info' },
  Baja: { label: 'Prioridad baja', tone: 'neutral' },
};

/** Filtros del listado, en el orden del ciclo de vida de una orden. */
export const ESTADO_FILTERS: { key: EstadoOrden | 'all'; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'Planificada', label: 'Planificadas' },
  { key: 'EnProceso', label: 'En proceso' },
  { key: 'Completada', label: 'Completadas' },
  { key: 'Cerrada', label: 'Cerradas' },
  { key: 'Cancelada', label: 'Canceladas' },
];

/** Avance producido / objetivo, entre 0 y 1. */
export function progress(producido: number, objetivo: number): number {
  if (objetivo <= 0) return 0;
  return Math.min(1, Math.max(0, producido / objetivo));
}

export function num(n: number): string {
  return n.toLocaleString('es-CO', { maximumFractionDigits: 3 });
}
