import { Text, View } from 'react-native';
import type { Tone } from '@/features/catalog/labels';

const TONES: Record<Tone, { box: string; text: string }> = {
  ok: { box: 'bg-ok/10', text: 'text-ok' },
  warn: { box: 'bg-warn/10', text: 'text-warn' },
  neutral: { box: 'bg-graphite-400/15', text: 'text-graphite-600' },
  info: { box: 'bg-ice-100', text: 'text-frost-700' },
};

/** Etiqueta pequeña de estado o atributo. */
export function Badge({ label, tone = 'info' }: { label: string; tone?: Tone }) {
  const t = TONES[tone];
  return (
    <View className={`self-start rounded-full px-2.5 py-1 ${t.box}`}>
      <Text className={`text-xs font-semibold ${t.text}`}>{label}</Text>
    </View>
  );
}
