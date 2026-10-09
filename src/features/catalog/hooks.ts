import { useMemo } from 'react';
import { useInfiniteQuery, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  activateProduct,
  createProduct,
  discontinueProduct,
  getProduct,
  setBOM,
  setProductPrice,
  updateProductDetails,
  type ComponenteReceta,
  type EditarProductoBody,
  type NuevoProductoBody,
  listCategoryTree,
  listProducts,
  listUnitsOfMeasure,
  searchProducts,
  type CategoryNode,
  type ProductStatus,
  type ProductType,
} from './api';

const PAGE_SIZE = 25;
/** Categorías y unidades cambian poco: se cachean 10 minutos. */
const REFERENCE_STALE_MS = 10 * 60_000;

export const catalogKeys = {
  all: ['catalog'] as const,
  list: (status: ProductStatus[], type: ProductType[]) => ['catalog', 'products', 'list', status, type] as const,
  search: (q: string) => ['catalog', 'products', 'search', q] as const,
  product: (id: string) => ['catalog', 'products', 'detail', id] as const,
  categories: ['catalog', 'categories'] as const,
  uoms: ['catalog', 'uoms'] as const,
};

/** Lista paginada (scroll infinito) filtrada por estado y tipo. */
export function useProductList(status: ProductStatus[], enabled: boolean, type: ProductType[] = []) {
  return useInfiniteQuery({
    queryKey: catalogKeys.list(status, type),
    queryFn: ({ pageParam }) => listProducts({ status, type, page: pageParam, pageSize: PAGE_SIZE }),
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
  return useQuery({ queryKey: catalogKeys.product(id), queryFn: () => getProduct(id), enabled: id.length > 0 });
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

/** Categorías activas, aplanadas y ordenadas por ruta (para elegir al crear). */
export function useCategoryOptions() {
  const query = useQuery({ queryKey: catalogKeys.categories, queryFn: listCategoryTree, staleTime: REFERENCE_STALE_MS });
  const options = useMemo(() => {
    const out: { id: string; name: string; path: string }[] = [];
    const walk = (nodes: CategoryNode[]) => {
      for (const n of nodes) {
        if (n.isActive) out.push({ id: n.id, name: n.name, path: n.path });
        walk(n.children ?? []);
      }
    };
    walk(query.data ?? []);
    return out.sort((a, b) => a.path.localeCompare(b.path));
  }, [query.data]);
  return { options, isLoading: query.isLoading };
}

/** Unidades de medida completas (con dimensión) para elegir. */
export function useUomList() {
  const query = useQuery({ queryKey: catalogKeys.uoms, queryFn: listUnitsOfMeasure, staleTime: REFERENCE_STALE_MS });
  const list = useMemo(() => (query.data ?? []).filter((u) => u.isActive), [query.data]);
  return { list, isLoading: query.isLoading };
}

// =====================================================================
// Sprint 14: escritura. Toda acción refresca el catálogo (lista, búsqueda y
// detalle). expectedVersion = la versión que se vio al abrir el producto: si
// otro usuario lo cambió, el backend responde 412 product.version_conflict.
// =====================================================================

function useRefrescar() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: catalogKeys.all });
  };
}

export function useCrearProducto() {
  const refrescar = useRefrescar();
  return useMutation({ mutationFn: (body: NuevoProductoBody) => createProduct(body), onSettled: refrescar });
}

export function useEditarProducto(id: string) {
  const refrescar = useRefrescar();
  return useMutation({ mutationFn: (body: EditarProductoBody) => updateProductDetails(id, body), onSettled: refrescar });
}

export type AccionProducto =
  | { accion: 'activar'; version: number }
  | { accion: 'descontinuar'; version: number; motivo: string }
  | { accion: 'precio'; version: number; precio: number | null };

export function useAccionProducto(id: string) {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (a: AccionProducto) =>
      a.accion === 'activar'
        ? activateProduct(id, a.version)
        : a.accion === 'descontinuar'
          ? discontinueProduct(id, a.motivo.trim(), a.version)
          : setProductPrice(id, a.precio, a.version),
    onSettled: refrescar,
  });
}

export function useGuardarReceta(id: string) {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: ({ components, version }: { components: ComponenteReceta[]; version: number }) => setBOM(id, components, version),
    onSettled: refrescar,
  });
}
