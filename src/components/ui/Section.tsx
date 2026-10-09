import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

/** Bloque con título en versalitas (pantallas de detalle). */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="mt-6">
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-graphite-400">{title}</Text>
      {children}
    </View>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <View className={`rounded-2xl border border-ice-100 bg-white p-4 ${className}`}>{children}</View>;
}

/** Fila etiqueta / valor dentro de una Card. */
export function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-4 py-1">
      <Text className="text-sm text-graphite-600">{label}</Text>
      <Text className="flex-shrink text-right text-sm font-medium text-graphite-900">{value}</Text>
    </View>
  );
}
