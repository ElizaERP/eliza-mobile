import { Pressable, ScrollView, Text } from 'react-native';

/** Fila de chips de filtro con selección única (se desplaza en horizontal si no cabe). */
export function FilterChips<K extends string>({
  options,
  value,
  onChange,
  small,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
  small?: boolean;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
      {options.map((o) => {
        const selected = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.key)}
            className={`justify-center rounded-full ${small ? 'min-h-8 px-3' : 'min-h-9 px-4'} ${selected ? 'bg-frost-900' : 'border border-ice-100 bg-white'}`}
          >
            <Text className={`${small ? 'text-xs' : 'text-sm'} font-medium ${selected ? 'text-white' : 'text-graphite-600'}`}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
