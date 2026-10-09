import type { ProductStatus, ProductType } from './api';

/** Textos y tonos de presentación del Catálogo (en un solo lugar). */

export const TYPE_LABEL: Record<ProductType, string> = {
  RawMaterial: 'Materia prima',
  SemiFinished: 'Semielaborado',
  FinishedGood: 'Producto terminado',
  Service: 'Servicio',
};

export type Tone = 'ok' | 'warn' | 'neutral' | 'info';

export const STATUS_LABEL: Record<ProductStatus, { label: string; tone: Tone }> = {
  Active: { label: 'Activo', tone: 'ok' },
  Draft: { label: 'Borrador', tone: 'warn' },
  Discontinued: { label: 'Descontinuado', tone: 'neutral' },
};

export const STATUS_FILTERS: { key: string; label: string; status: ProductStatus[] }[] = [
  { key: 'all', label: 'Todos', status: [] },
  { key: 'active', label: 'Activos', status: ['Active'] },
  { key: 'draft', label: 'Borrador', status: ['Draft'] },
  { key: 'discontinued', label: 'Descontinuados', status: ['Discontinued'] },
];

/** Filtro por tipo: separa producto terminado de materia prima (Catálogo e Inventario). */
export const TYPE_FILTERS: { key: string; label: string; types: ProductType[] }[] = [
  { key: 'all', label: 'Todos los tipos', types: [] },
  { key: 'finished', label: 'Producto terminado', types: ['FinishedGood'] },
  { key: 'raw', label: 'Materia prima', types: ['RawMaterial'] },
  { key: 'semi', label: 'Semielaborado', types: ['SemiFinished'] },
];

const copFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

/** Precio de lista para mostrar: "$ 4.500 + IVA" o null si no tiene. */
export function formatSalePrice(price: number | null | undefined): string | null {
  if (typeof price !== 'number' || !Number.isFinite(price)) return null;
  return `${copFmt.format(price)} + IVA`;
}

export function formatGrams(g: number | null): string | null {
  if (g === null) return null;
  return g >= 1000 ? `${(g / 1000).toLocaleString('es-CO')} kg` : `${g.toLocaleString('es-CO')} g`;
}

export function formatTempRange(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null;
  if (min !== null && max !== null) return `${min} °C a ${max} °C`;
  return min !== null ? `desde ${min} °C` : `hasta ${max} °C`;
}
