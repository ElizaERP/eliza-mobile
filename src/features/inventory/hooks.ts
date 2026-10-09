import { useMemo } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ajustarConteo,
  bloquearLote,
  getStockByProduct,
  liberarLote,
  registrarEntrada,
  transferir,
  type EntradaBody,
  type TransferenciaBody,
  listExpiringLots,
  listLocations,
  listMovements,
  listWarehouses,
} from './api';

const REFERENCE_STALE_MS = 10 * 60_000;

export const inventoryKeys = {
  stock: (productId: string) => ['inventory', 'stock', productId] as const,
  expiring: (days: number) => ['inventory', 'lots', 'expiring', days] as const,
  movements: (productId: string) => ['inventory', 'movements', productId] as const,
  locations: ['inventory', 'locations'] as const,
};

export function useStock(productId: string) {
  return useQuery({
    queryKey: inventoryKeys.stock(productId),
    queryFn: () => getStockByProduct(productId),
  });
}

/** Existencias de varios productos (una consulta por producto visible). */
export function useStocks(productIds: string[]) {
  return useQueries({
    queries: productIds.map((id) => ({
      queryKey: inventoryKeys.stock(id),
      queryFn: () => getStockByProduct(id),
    })),
  });
}

export function useExpiringLots(days: number) {
  return useQuery({
    queryKey: inventoryKeys.expiring(days),
    queryFn: () => listExpiringLots(days),
  });
}

export function useMovements(productId: string) {
  return useQuery({
    queryKey: inventoryKeys.movements(productId),
    queryFn: () => listMovements(productId),
  });
}

/** id de ubicación → "BODEGA · UBICACIÓN" (todas las bodegas del tenant). */
export function useLocationMap() {
  const query = useQuery({
    queryKey: inventoryKeys.locations,
    staleTime: REFERENCE_STALE_MS,
    queryFn: async () => {
      const warehouses = await listWarehouses();
      const perWarehouse = await Promise.all(
        warehouses.map(async (w) => ({ w, locs: await listLocations(w.id) })),
      );
      return perWarehouse.flatMap(({ w, locs }) =>
        locs.map((l) => ({ id: l.id, label: `${w.code} · ${l.code}`, name: l.name })),
      );
    },
  });
  const map = useMemo(() => new Map((query.data ?? []).map((l) => [l.id, l])), [query.data]);
  return { map, isLoading: query.isLoading };
}

// =====================================================================
// Sprint 13: escritura. Toda acción refresca el inventario completo
// (existencias, lotes por vencer y movimientos).
// =====================================================================

function useRefrescar() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['inventory'] });
  };
}

export function useRegistrarEntrada() {
  const refrescar = useRefrescar();
  return useMutation({ mutationFn: (body: EntradaBody) => registrarEntrada(body), onSettled: refrescar });
}

export function useAjustarConteo() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: ({ existenciaId, cantidadContada, motivo }: { existenciaId: string; cantidadContada: number; motivo: string }) =>
      ajustarConteo(existenciaId, cantidadContada, motivo),
    onSettled: refrescar,
  });
}

export function useTransferir() {
  const refrescar = useRefrescar();
  return useMutation({ mutationFn: (body: TransferenciaBody) => transferir(body), onSettled: refrescar });
}

export function useEstadoLote() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: ({ loteId, accion, motivo }: { loteId: string; accion: 'bloquear' | 'liberar'; motivo?: string }) =>
      accion === 'bloquear' ? bloquearLote(loteId, (motivo ?? '').trim()) : liberarLote(loteId),
    onSettled: refrescar,
  });
}
