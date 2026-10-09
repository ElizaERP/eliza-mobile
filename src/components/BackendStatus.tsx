import { Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { backendHost, env } from '@/core/config/env';
import { getValidAccessToken } from '@/core/auth/tokenManager';
import { Button } from '@/components/ui/Button';
import { InfoRow } from '@/components/ui/InfoRow';

/**
 * Tarjeta de diagnóstico: prueba la cadena completa contra el backend.
 *  1. GET /health/ready  → la API responde y tiene base de datos
 *  2. GET /v1/me         → la API acepta el token de Keycloak de esta sesión
 * Usa axios directo (no apiClient) para que un 401 se MUESTRE aquí en vez de
 * cerrar la sesión: es una pantalla de diagnóstico.
 */
interface Probe {
  status: number | null;
  ms: number;
  error: string | null;
}

async function probe(path: string): Promise<Probe> {
  const started = Date.now();
  const token = await getValidAccessToken();
  try {
    const res = await axios.get(`${env.apiBaseUrl}${path}`, {
      timeout: 15_000,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return { status: res.status, ms: Date.now() - started, error: null };
  } catch (e) {
    const err = e as AxiosError<{ message?: string | string[] }>;
    const msg = err.response?.data?.message;
    return {
      status: err.response?.status ?? null,
      ms: Date.now() - started,
      error: (Array.isArray(msg) ? msg.join(' · ') : msg) ?? err.message,
    };
  }
}

function describe(p: Probe | undefined, okLabel: string): string {
  if (!p) return '…';
  if (p.status !== null && p.status >= 200 && p.status < 300) return `✅ ${okLabel} · ${p.ms} ms`;
  if (p.status === null) return `❌ sin conexión (${p.error ?? 'red'})`;
  return `❌ HTTP ${p.status} · ${p.error ?? ''}`.trim();
}

export function BackendStatus() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['backend-status'],
    queryFn: async () => {
      const [ready, me] = await Promise.all([probe('/health/ready'), probe('/v1/me')]);
      return { ready, me };
    },
    staleTime: 0,
    retry: 0,
  });

  return (
    <View className="mt-4 rounded-2xl border border-ice-100 bg-white p-5">
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-graphite-400">
        Conexión con el backend
      </Text>
      <InfoRow label="Servidor" value={backendHost || '—'} />
      <InfoRow label="API lista" value={isFetching ? 'probando…' : describe(data?.ready, 'OK')} />
      <InfoRow label="Sesión en la API" value={isFetching ? 'probando…' : describe(data?.me, 'token aceptado')} />
      <View className="mt-3">
        <Button label="Probar de nuevo" variant="ghost" onPress={() => void refetch()} loading={isFetching} />
      </View>
    </View>
  );
}
