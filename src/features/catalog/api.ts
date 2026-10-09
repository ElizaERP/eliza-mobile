import { apiClient } from '@/core/http/apiClient';

/**
 * Cliente del Catálogo — contrato de eliza-foundation
 * (src/contexts/catalog/interface/http/dto/catalog.dto.ts).
 * Sprint 9.2: solo lectura. Rutas relativas a EXPO_PUBLIC_API_BASE_URL (…/api).
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
