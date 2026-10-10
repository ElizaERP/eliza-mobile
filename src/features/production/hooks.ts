import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelJornada,
  cancelOrder,
  completeOrder,
  createJornada,
  getJornada,
  listJornadas,
  reserveJornada,
  startJornada,
  type ConsumoReal,
  type NuevaJornadaBody,
  getOrder,
  listOrders,
  recordProduction,
  reserveMaterials,
  startOrder,
  type EstadoOrden,
  type RegistrarProduccionBody,
} from './api';

const PAGE_SIZE = 25;

export const productionKeys = {
  list: (estado: EstadoOrden | 'all') => ['production', 'orders', 'list', estado] as const,
  order: (id: string) => ['production', 'orders', 'detail', id] as const,
  jornadas: ['production', 'jornadas', 'list'] as const,
  jornada: (codigo: string) => ['production', 'jornadas', 'detail', codigo] as const,
};

/** Órdenes de producción (scroll infinito), opcionalmente filtradas por estado. */
export function useOrderList(estado: EstadoOrden | 'all') {
  return useInfiniteQuery({
    queryKey: productionKeys.list(estado),
    queryFn: ({ pageParam }) =>
      listOrders({ estado: estado === 'all' ? undefined : estado, limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) =>
      last.offset + last.items.length < last.total ? last.offset + last.items.length : undefined,
  });
}

export function useOrder(id: string) {
  return useQuery({ queryKey: productionKeys.order(id), queryFn: () => getOrder(id) });
}

// =====================================================================
// Sprint 12: escritura. Toda acción refresca órdenes e inventario (las
// reservas, los lotes nuevos y el consumo cambian el stock).
// =====================================================================

function useRefrescar() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['production'] });
    void qc.invalidateQueries({ queryKey: ['inventory'] });
  };
}

export type AccionOrden = 'reservar' | 'iniciar' | 'cancelar';

export function useAccionOrden(id: string) {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: async ({ accion, motivo }: { accion: AccionOrden; motivo?: string }): Promise<void> => {
      if (accion === 'reservar') await reserveMaterials(id);
      else if (accion === 'iniciar') await startOrder(id);
      else await cancelOrder(id, (motivo ?? '').trim());
    },
    onSettled: refrescar,
  });
}

export function useRegistrarProduccion(id: string) {
  const refrescar = useRefrescar();
  return useMutation({ mutationFn: (body: RegistrarProduccionBody) => recordProduction(id, body), onSettled: refrescar });
}

/** Completar con el consumo real de cada materia prima (Sprint 15). */
export function useCompletarOrden(id: string) {
  const refrescar = useRefrescar();
  return useMutation({ mutationFn: (consumos: ConsumoReal[]) => completeOrder(id, consumos), onSettled: refrescar });
}

// ---------------------------------------------------------------------
// Sprint 15: jornadas
// ---------------------------------------------------------------------

export function useJornadaList() {
  return useQuery({ queryKey: productionKeys.jornadas, queryFn: () => listJornadas(30) });
}

export function useJornada(codigo: string) {
  return useQuery({ queryKey: productionKeys.jornada(codigo), queryFn: () => getJornada(codigo), enabled: codigo.length > 0 });
}

export function useCrearJornada() {
  const refrescar = useRefrescar();
  return useMutation({ mutationFn: (body: NuevaJornadaBody) => createJornada(body), onSettled: refrescar });
}

export type AccionJornada = 'reservar' | 'iniciar' | 'cancelar';

export function useAccionJornada(codigo: string) {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: async ({ accion, motivo }: { accion: AccionJornada; motivo?: string }): Promise<void> => {
      if (accion === 'reservar') await reserveJornada(codigo);
      else if (accion === 'iniciar') await startJornada(codigo);
      else await cancelJornada(codigo, (motivo ?? '').trim());
    },
    onSettled: refrescar,
  });
}
