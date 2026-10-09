import { useMemo } from 'react';
import { useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query';
import {
  getProduct,
  listCategoryTree,
  listProducts,
  listUnitsOfMeasure,
  searchProducts,
  type CategoryNode,
  type ProductStatus,
} from './api';

const PAGE_SIZE = 25;
/** Categorías y unidades cambian poco: se cachean 10 minutos. */
const REFERENCE_STALE_MS = 10 * 60_000;

export const catalogKeys = {
  all: ['catalog'] as const,
  list: (status: ProductStatus[]) => ['catalog', 'products', 'list', status] as const,
  search: (q: string) => ['catalog', 'products', 'search', q] as const,
  product: (id: string) => ['catalog', 'products', 'detail', id] as const,
  categories: ['catalog', 'categories'] as const,
  uoms: ['catalog', 'uoms'] as const,
};

/** Lista paginada (scroll infinito) filtrada por estado. */
export function useProductList(status: ProductStatus[], enabled: boolean) {
  return useInfiniteQuery({
    queryKey: catalogKeys.list(status),
    queryFn: ({ pageParam }) => listProducts({ status, page: pageParam, pageSize: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    enabled,
  });
}

/** Búsqueda en nombre / código / SKU / código de barras (mínimo 2 caracteres). */
export function useProductSearch(q: string) {
  return useQuery({
    queryKey: catalogKeys.search(q),
    queryFn: () => searchProducts(q),
    enabled: q.length >= 2,
  });
}

export function useProduct(id: string) {
  return useQuery({ queryKey: catalogKeys.product(id), queryFn: () => getProduct(id) });
}

/** Varios productos por id (los componentes del BOM). */
export function useProductsByIds(ids: string[]) {
  return useQueries({
    queries: ids.map((id) => ({ queryKey: catalogKeys.product(id), queryFn: () => getProduct(id) })),
  });
}

/** id de categoría → { name, path } (aplana el árbol). */
export function useCategoryMap() {
  const query = useQuery({
    queryKey: catalogKeys.categories,
    queryFn: listCategoryTree,
    staleTime: REFERENCE_STALE_MS,
  });
  const map = useMemo(() => {
    const out = new Map<string, { name: string; path: string }>();
    const walk = (nodes: CategoryNode[]) => {
      for (const n of nodes) {
        out.set(n.id, { name: n.name, path: n.path });
        walk(n.children ?? []);
      }
    };
    walk(query.data ?? []);
    return out;
  }, [query.data]);
  return { map, isLoading: query.isLoading };
}

/** id de unidad de medida → { symbol, name }. */
export function useUomMap() {
  const query = useQuery({
    queryKey: catalogKeys.uoms,
    queryFn: listUnitsOfMeasure,
    staleTime: REFERENCE_STALE_MS,
  });
  const map = useMemo(
    () => new Map((query.data ?? []).map((u) => [u.id, { symbol: u.symbol, name: u.name }])),
    [query.data],
  );
  return { map, isLoading: query.isLoading };
}
