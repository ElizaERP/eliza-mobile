/**
 * Menú por rol — el JWT trae los roles del usuario (claim "roles" /
 * realm_access.roles) y este mapping decide qué módulos del MVP ve.
 *
 * Los nombres son los del catálogo del backend (formato `<Scope>.<Function>`,
 * eliza-foundation: src/contexts/iam/domain/role-catalog.ts). Cada módulo se
 * muestra si el usuario tiene AL MENOS UN rol de LECTURA del controller que lo
 * respalda; la autorización real la sigue haciendo el backend en cada endpoint.
 *
 * Los roles Platform.* NO dan módulos aquí: la administración de la plataforma
 * vive en el panel web (Sprint 11), no en la app móvil.
 */

export type ModuleId = 'catalogo' | 'inventario' | 'produccion' | 'ventas';

export interface ModuleDef {
  id: ModuleId;
  label: string;
  description: string;
  /** Emoji como ícono provisional del MVP (sin dependencia de íconos aún) */
  icon: string;
  /** Sprint en el que se habilita la funcionalidad real */
  sprint: string;
}

export const MODULES: Record<ModuleId, ModuleDef> = {
  catalogo: {
    id: 'catalogo',
    label: 'Catálogo',
    description: 'Productos, presentaciones y BOM',
    icon: '🧾',
    sprint: '9.2',
  },
  inventario: {
    id: 'inventario',
    label: 'Inventario',
    description: 'Lotes, existencias, recepción y despacho FEFO',
    icon: '🧊',
    sprint: '9.3',
  },
  produccion: {
    id: 'produccion',
    label: 'Producción',
    description: 'Órdenes, consumos y lotes producidos',
    icon: '🏭',
    sprint: '9.4',
  },
  ventas: {
    id: 'ventas',
    label: 'Ventas',
    description: 'Clientes y pedidos',
    icon: '🛒',
    sprint: '9.5',
  },
};

const ALL: ModuleId[] = ['catalogo', 'inventario', 'produccion', 'ventas'];

/**
 * módulo → roles que pueden VER ese módulo (lectura en el backend).
 * Fuente: READER_ROLES de cada controller, sin los Platform.*:
 *  - catalogo   → catalog.controllers.ts
 *  - inventario → stock.controller.ts
 *  - produccion → production-orders.controller.ts
 *  - ventas     → sales-orders.controller.ts
 */
const MODULE_READER_ROLES: Record<ModuleId, readonly string[]> = {
  catalogo: [
    'Tenant.Admin', 'Tenant.Viewer',
    'Manufacturing.Manager', 'Manufacturing.Supervisor',
    'Inventory.Manager',
    'Sales.Manager', 'Sales.Salesperson',
    'Quality.Manager', 'Quality.Inspector',
    'Procurement.Manager', 'Procurement.Buyer',
  ],
  inventario: [
    'Tenant.Admin',
    'Inventory.Manager', 'Inventory.Operator', 'Inventory.Reader',
    'Manufacturing.Manager', 'Sales.Manager',
  ],
  produccion: [
    'Tenant.Admin',
    'Manufacturing.Manager', 'Manufacturing.Operator', 'Manufacturing.Reader',
    'Inventory.Manager', 'Quality.Manager', 'Planning.Manager',
  ],
  ventas: [
    'Tenant.Admin',
    'Sales.Manager', 'Sales.Operator', 'Sales.Reader',
    'Inventory.Manager', 'Billing.Manager', 'Logistics.Manager',
  ],
};

export function getVisibleModules(roles: string[]): ModuleDef[] {
  const userRoles = new Set(roles);
  // Orden estable según definición del MVP
  return ALL.filter((id) => MODULE_READER_ROLES[id].some((r) => userRoles.has(r))).map(
    (id) => MODULES[id],
  );
}
