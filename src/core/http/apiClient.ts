import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { env } from '@/core/config/env';
import { getValidAccessToken } from '@/core/auth/tokenManager';
import { signOut } from '@/core/auth/authService';

/**
 * Cliente HTTP hacia el backend NestJS de ELIZA.
 *  - Inyecta Bearer token (renovado proactivamente por el tokenManager)
 *  - Ante 401 reintenta UNA vez con token fresco; si persiste → signOut
 *  - Normaliza el shape de error del backend
 */
export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getValidAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    if (error.response?.status === 401 && config && !config._retried) {
      config._retried = true;
      const token = await getValidAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        return apiClient.request(config);
      }
      await signOut();
    }
    return Promise.reject(normalizeApiError(error));
  },
);

export interface ApiError {
  status: number | null;
  code: string;
  message: string;
}

function normalizeApiError(error: AxiosError): ApiError {
  const data = error.response?.data as
    | { message?: string | string[]; error?: string; code?: string }
    | undefined;
  const rawMessage = Array.isArray(data?.message)
    ? data.message.join(' · ')
    : (data?.message ?? error.message);
  return {
    status: error.response?.status ?? null,
    code: data?.code ?? data?.error ?? 'UNKNOWN',
    message: rawMessage || 'Error de comunicación con el servidor',
  };
}
