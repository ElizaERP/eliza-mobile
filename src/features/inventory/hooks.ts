import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  getStockByProduct,
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
