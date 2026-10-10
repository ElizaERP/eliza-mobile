import { useCallback, useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import * as Updates from 'expo-updates';

/** No buscar más de una vez cada 15 minutos al volver a la app. */
const INTERVALO_MS = 15 * 60_000;

/**
 * Actualizaciones por aire (EAS Update). Al abrir la app y al volver a ella
 * (como mucho cada 15 min) busca una versión nueva del JavaScript; si la hay,
 * la descarga y pregunta si reiniciar ya. Si dicen "Más tarde", se aplica sola
 * la próxima vez que se abra la app.
 * En desarrollo (Expo Go / Metro) no hace nada.
 */
export function useActualizaciones() {
  const ultima = useRef(0);
  const preguntando = useRef(false);

  const buscar = useCallback(async () => {
    if (__DEV__ || !Updates.isEnabled || preguntando.current) return;
    const ahora = Date.now();
    if (ahora - ultima.current < INTERVALO_MS) return;
    ultima.current = ahora;
    try {
      const check = await Updates.checkForUpdateAsync();
      if (!check.isAvailable) return;
      const fetched = await Updates.fetchUpdateAsync();
      if (!fetched.isNew) return;
      preguntando.current = true;
      Alert.alert('Actualización lista', 'Hay una versión nueva de ELIZA. Reinicia para usarla.', [
        { text: 'Más tarde', style: 'cancel', onPress: () => { preguntando.current = false; } },
        { text: 'Reiniciar', onPress: () => void Updates.reloadAsync() },
      ]);
    } catch {
      // Sin red o servidor de actualizaciones caído: se intenta en la próxima apertura.
    }
  }, []);

  useEffect(() => {
    void buscar();
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') void buscar();
    });
    return () => sub.remove();
  }, [buscar]);
}

/** Datos de la versión en uso (para Perfil). */
export function infoVersion() {
  const embebida = !Updates.isEnabled || Updates.isEmbeddedLaunch;
  return {
    canal: Updates.channel ?? (__DEV__ ? 'desarrollo' : '—'),
    runtime: Updates.runtimeVersion ?? '—',
    actualizacion: embebida ? null : { id: (Updates.updateId ?? '').slice(0, 8), fecha: Updates.createdAt },
  };
}

/** Buscar a mano (botón de Perfil). Devuelve qué pasó para mostrarlo. */
export async function buscarActualizacionAhora(): Promise<'desarrollo' | 'al_dia' | 'descargada' | 'error'> {
  if (__DEV__ || !Updates.isEnabled) return 'desarrollo';
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return 'al_dia';
    const fetched = await Updates.fetchUpdateAsync();
    return fetched.isNew ? 'descargada' : 'al_dia';
  } catch {
    return 'error';
  }
}
