import { apiClient } from '@/core/http/apiClient';

/**
 * Cliente del Catálogo — contrato de eliza-foundation
 * (src/contexts/catalog/interface/http/dto/catalog.dto.ts).
 * Sprint 9.2: lectura. Sprint 14: crear, editar, activar, descontinuar, precio y receta.
 * Rutas relativas a EXPO_PUBLIC_API_BASE_URL (…/api).
 */

export type ProductType = 'RawMaterial' | 'SemiFinished' | 'FinishedGood' | 'Service';
export type ProductStatus = 'Draft' | 'Active' | 'Discontinued';

export interface BOMComponent {
  componentProductId: string;
  quantity: number;
  uomId: string;
  position: number;
  notes: string | null;
}

export interface Product {
  id: string;
  code: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  type: ProductType;
  status: ProductStatus;
  categoryId: string;
  unitOfSaleId: string;
  packSize: number | null;
  netWeightGrams: number | null;
  grossWeightGrams: number | null;
  expiryDays: number | null;
  storageTempMinC: number | null;
  storageTempMaxC: number | null;
  taxRate: number | null;
  /** Precio de lista en COP, sin IVA (null = sin precio). Backend 839022b. */
  salePrice: number | null;
  imageUrl: string | null;
  isControlled: boolean;
  components: BOMComponent[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductPage {
  items: Product[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CategoryNode {
  id: string;
  code: string;
  name: string;
  path: string;
  parentId: string | null;
  isActive: boolean;
  children: CategoryNode[];
}

export interface UnitOfMeasure {
  id: string;
  code: string;
  name: string;
  symbol: string;
  dimension: string;
  isActive: boolean;
}

export interface ListProductsParams {
  status?: ProductStatus[];
  type?: ProductType[];
  page?: number;
  pageSize?: number;
}

export async function listProducts(params: ListProductsParams): Promise<ProductPage> {
  const { data } = await apiClient.get<ProductPage>('/v1/catalog/products', {
    params: {
      status: params.status?.length ? params.status.join(',') : undefined,
      type: params.type?.length ? params.type.join(',') : undefined,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 25,
    },
  });
  return data;
}

export async function searchProducts(q: string, limit = 50): Promise<Product[]> {
  const { data } = await apiClient.get<Product[]>('/v1/catalog/products/search', {
    params: { q, limit },
  });
  return data;
}

export async function getProduct(id: string): Promise<Product> {
  const { data } = await apiClient.get<Product>(`/v1/catalog/products/${id}`);
  return data;
}

export async function listCategoryTree(): Promise<CategoryNode[]> {
  const { data } = await apiClient.get<CategoryNode[]>('/v1/catalog/categories');
  return data;
}

export async function listUnitsOfMeasure(): Promise<UnitOfMeasure[]> {
  const { data } = await apiClient.get<UnitOfMeasure[]>('/v1/catalog/units-of-measure');
  return data;
}

// =====================================================================
// Sprint 14: escritura
// =====================================================================

export interface NuevoProductoBody {
  code: string;
  sku: string;
  name: string;
  description?: string;
  barcode?: string;
  type: Exclude<ProductType, 'Service'>;
  categoryId: string;
  unitOfSaleId: string;
  packSize?: number;
  expiryDays?: number;
  storageTempMinC?: number;
  storageTempMaxC?: number;
  taxRate?: number;
  isControlled: boolean;
}

/** Crea el producto en Borrador. */
export async function createProduct(body: NuevoProductoBody): Promise<Product> {
  const { data } = await apiClient.post<Product>('/v1/catalog/products', body);
  return data;
}

/** Campo omitido = no cambia; null = se borra. */
export interface EditarProductoBody {
  name?: string;
  description?: string | null;
  barcode?: string | null;
  packSize?: number | null;
  expiryDays?: number | null;
  storageTempMinC?: number | null;
  storageTempMaxC?: number | null;
  taxRate?: number | null;
  expectedVersion: number;
}

export async function updateProductDetails(id: string, body: EditarProductoBody): Promise<Product> {
  const { data } = await apiClient.patch<Product>(`/v1/catalog/products/${id}/details`, body);
  return data;
}

export async function activateProduct(id: string, expectedVersion: number): Promise<Product> {
  const { data } = await apiClient.post<Product>(`/v1/catalog/products/${id}/activate`, { expectedVersion });
  return data;
}

export async function discontinueProduct(id: string, reason: string, expectedVersion: number): Promise<Product> {
  const { data } = await apiClient.post<Product>(`/v1/catalog/products/${id}/discontinue`, { reason, expectedVersion });
  return data;
}

/** Precio de lista en COP sin IVA; null lo quita. */
export async function setProductPrice(id: string, salePrice: number | null, expectedVersion: number): Promise<Product> {
  const { data } = await apiClient.put<Product>(`/v1/catalog/products/${id}/price`, { salePrice, expectedVersion });
  return data;
}

export interface ComponenteReceta {
  componentProductId: string;
  quantity: number;
  uomId: string;
  position: number;
}

/** Reemplaza la receta completa. */
export async function setBOM(id: string, components: ComponenteReceta[], expectedVersion: number): Promise<Product> {
  const { data } = await apiClient.put<Product>(`/v1/catalog/products/${id}/bom`, { components, expectedVersion });
  return data;
}
