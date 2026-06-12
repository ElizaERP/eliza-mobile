import { Text, View } from 'react-native';

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between border-b border-ice-100 py-3">
      <Text className="text-sm text-graphite-600">{label}</Text>
      <Text className="ml-4 flex-1 text-right text-sm font-medium text-graphite-900">{value}</Text>
    </View>
  );
}
