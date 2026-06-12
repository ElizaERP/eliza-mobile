/**
 * Menú por rol — el JWT trae los roles del usuario (claim "roles" /
 * realm_access.roles) y este mapping decide qué módulos del MVP ve.
 *
 * Módulos del MVP móvil (Sprint 9): los 4 BCs operativos + Auth.
 * La administración de tenants/usuarios NO vive aquí (panel web, Sprint 11).
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
 * rol (Keycloak realm role) → módulos visibles.
 * Roles desconocidos no aportan módulos; el resultado es la unión
 * de todos los roles del usuario.
 */
const ROLE_MODULES: Record<string, ModuleId[]> = {
  'tenant-admin': ALL,
  'jefe-produccion': ['produccion', 'inventario', 'catalogo'],
  'jefe-inventario': ['inventario', 'catalogo'],
  'jefe-calidad': ['inventario', 'produccion', 'catalogo'],
  'jefe-ventas': ['ventas', 'catalogo'],
  'operario-planta': ['produccion', 'inventario'],
  'operario-logistica': ['inventario'],
  vendedor: ['ventas', 'catalogo'],
};

export function getVisibleModules(roles: string[]): ModuleDef[] {
  const ids = new Set<ModuleId>();
  for (const role of roles) {
    for (const moduleId of ROLE_MODULES[role] ?? []) {
      ids.add(moduleId);
    }
  }
  // Orden estable según definición del MVP
  return ALL.filter((id) => ids.has(id)).map((id) => MODULES[id]);
}
