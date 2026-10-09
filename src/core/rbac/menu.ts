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
 *  - ventas     → sales-orders.controller.ts (clientes: customers.controller.ts)
 */
const MODULE_READER_ROLES: Record<ModuleId, readonly string[]> = {
  catalogo: [
    'Tenant.Admin', 'Tenant.Viewer',
    'Manufacturing.Manager', 'Manufacturing.Supervisor', 'Manufacturing.Operator',
    'Inventory.Manager', 'Inventory.Operator', 'Inventory.Reader',
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
    'Sales.Manager', 'Sales.Salesperson', 'Sales.Operator', 'Sales.Reader',
    'Inventory.Manager', 'Billing.Manager', 'Logistics.Manager',
  ],
};

/**
 * Dentro de Ventas, los clientes los leen menos roles que los pedidos
 * (customers.controller.ts no incluye Inventory.Manager): la pestaña Clientes
 * solo se muestra a quien puede leerlos.
 */
const CUSTOMER_READER_ROLES: readonly string[] = [
  'Tenant.Admin',
  'Sales.Manager', 'Sales.Salesperson', 'Sales.Operator', 'Sales.Reader',
  'Billing.Manager', 'Logistics.Manager',
];

/** Pueden armar pedidos en Borrador (ORDER_AUTHOR_ROLES de sales-orders.controller.ts). */
const ORDER_AUTHOR_ROLES: readonly string[] = [
  'Tenant.Admin', 'Sales.Manager', 'Sales.Operator', 'Sales.Salesperson',
];

export function canCreateSalesOrders(roles: string[]): boolean {
  return roles.some((r) => ORDER_AUTHOR_ROLES.includes(r));
}

/** Pueden registrar clientes con crédito (CREDIT_GRANTER_ROLES de customers.controller.ts). */
const CREDIT_GRANTER_ROLES: readonly string[] = ['Tenant.Admin', 'Sales.Manager'];

export function canGrantCredit(roles: string[]): boolean {
  return roles.some((r) => CREDIT_GRANTER_ROLES.includes(r));
}

/**
 * Avanzan el pedido (confirmar, reservar, despachar, cancelar) y editan clientes:
 * WRITER_ROLES de sales-orders.controller.ts y customers.controller.ts.
 */
const SALES_WRITER_ROLES: readonly string[] = ['Tenant.Admin', 'Sales.Manager', 'Sales.Operator'];

export function canManageSalesOrders(roles: string[]): boolean {
  return roles.some((r) => SALES_WRITER_ROLES.includes(r));
}

export function canEditCustomers(roles: string[]): boolean {
  return roles.some((r) => SALES_WRITER_ROLES.includes(r));
}

/** Cerrar pedidos y suspender/activar clientes: solo gerente de ventas y admin. */
const SALES_MANAGER_ROLES: readonly string[] = ['Tenant.Admin', 'Sales.Manager'];

export function canCloseSalesOrders(roles: string[]): boolean {
  return roles.some((r) => SALES_MANAGER_ROLES.includes(r));
}

export function canSuspendCustomers(roles: string[]): boolean {
  return roles.some((r) => SALES_MANAGER_ROLES.includes(r));
}

/** Crean y ejecutan órdenes de producción (WRITER_ROLES de production-orders.controller.ts). */
const PRODUCTION_WRITER_ROLES: readonly string[] = ['Tenant.Admin', 'Manufacturing.Manager', 'Manufacturing.Operator'];

export function canManageProduction(roles: string[]): boolean {
  return roles.some((r) => PRODUCTION_WRITER_ROLES.includes(r));
}

/** Cancelar una orden: los mismos más Quality.Manager. */
export function canCancelProduction(roles: string[]): boolean {
  return roles.some((r) => PRODUCTION_WRITER_ROLES.includes(r) || r === 'Quality.Manager');
}

export function canReadCustomers(roles: string[]): boolean {
  return roles.some((r) => CUSTOMER_READER_ROLES.includes(r));
}

export function getVisibleModules(roles: string[]): ModuleDef[] {
  const userRoles = new Set(roles);
  // Orden estable según definición del MVP
  return ALL.filter((id) => MODULE_READER_ROLES[id].some((r) => userRoles.has(r))).map(
    (id) => MODULES[id],
  );
}
