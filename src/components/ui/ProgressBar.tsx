import { View } from 'react-native';

/** Barra de avance (value entre 0 y 1). */
export function ProgressBar({ value, muted }: { value: number; muted?: boolean }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      className="h-2 overflow-hidden rounded-full bg-ice-100"
    >
      <View
        className={`h-2 rounded-full ${muted ? 'bg-graphite-400' : pct >= 100 ? 'bg-ok' : 'bg-frost-700'}`}
        style={{ width: `${pct}%` }}
      />
    </View>
  );
}
