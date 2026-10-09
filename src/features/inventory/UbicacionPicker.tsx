import { useEffect, useMemo } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useLocationMap } from './hooks';

/**
 * Elegir una ubicación de bodega (Sprint 13: recibir y mover).
 * Solo lista ubicaciones activas; si queda una sola, la elige sola.
 */
export function UbicacionPicker({
  value,
  onChange,
  excluir,
}: {
  value: string | null;
  onChange: (id: string) => void;
  /** Ubicación que no se ofrece (el origen al mover). */
  excluir?: string;
}) {
  const { map, isLoading } = useLocationMap();
  const ubicaciones = useMemo(() => Array.from(map.values()).filter((u) => u.id !== excluir), [map, excluir]);

  useEffect(() => {
    if (!value && ubicaciones.length === 1) onChange(ubicaciones[0]!.id);
  }, [ubicaciones, value, onChange]);

  if (isLoading) return <ActivityIndicator color="#0B3A53" />;
  if (ubicaciones.length === 0) {
    return (
      <Text className="text-sm text-danger">
        {excluir ? 'No hay otra ubicación activa a donde mover.' : 'No hay ubicaciones de bodega configuradas.'}
      </Text>
    );
  }
  return (
    <View className="gap-2">
      {ubicaciones.map((u) => {
        const sel = u.id === value;
        return (
          <Pressable
            key={u.id}
            accessibilityRole="button"
            accessibilityState={{ selected: sel }}
            onPress={() => onChange(u.id)}
            className={`rounded-2xl border bg-white p-3 ${sel ? 'border-frost-700' : 'border-ice-100'}`}
          >
            <Text className={`text-sm font-semibold ${sel ? 'text-frost-900' : 'text-graphite-900'}`}>{u.label}</Text>
            <Text className="text-xs text-graphite-400">{u.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
