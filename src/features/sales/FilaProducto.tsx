import { Pressable, Text, TextInput, View } from 'react-native';
import type { Product } from '@/features/catalog/api';
import { formatSalePrice } from '@/features/catalog/labels';
import { money } from './labels';

/**
 * Fila de producto con su precio de lista y la cantidad (− / campo / +).
 * La usan Nuevo pedido (Sprint 10) y Agregar productos a un pedido en Borrador (Sprint 11).
 */
export function FilaProducto({
  product,
  cantidad,
  onChange,
  disabled,
}: {
  product: Product;
  cantidad: number;
  onChange: (n: number) => void;
  disabled: boolean;
}) {
  const precio = formatSalePrice(product.salePrice);
  const sinPrecio = precio === null;
  return (
    <View className={`rounded-2xl border bg-white p-4 ${cantidad > 0 ? 'border-frost-700' : 'border-ice-100'}`}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className={`text-base font-semibold ${sinPrecio ? 'text-graphite-400' : 'text-graphite-900'}`}>{product.name}</Text>
          <Text className="mt-1 text-xs text-graphite-400">{product.code}</Text>
          <Text className={`mt-1 text-sm ${sinPrecio ? 'text-graphite-400' : 'text-graphite-600'}`}>
            {precio ?? 'Sin precio de lista: pídeselo al gerente de ventas'}
          </Text>
        </View>
        {sinPrecio ? null : (
          <View className="flex-row items-center gap-2">
            <Paso label="−" onPress={() => onChange(cantidad - 1)} disabled={disabled || cantidad === 0} />
            <TextInput
              value={cantidad > 0 ? String(cantidad) : ''}
              onChangeText={(t) => onChange(Number(t.replace(/\D/g, '')))}
              placeholder="0"
              placeholderTextColor="#8295A3"
              keyboardType="number-pad"
              editable={!disabled}
              accessibilityLabel={`Cantidad de ${product.name}`}
              style={{ paddingVertical: 0, textAlignVertical: 'center', includeFontPadding: false }}
              className="h-11 w-16 rounded-xl border border-ice-100 text-center text-lg font-semibold text-graphite-900"
            />
            <Paso label="+" onPress={() => onChange(cantidad + 1)} disabled={disabled} />
          </View>
        )}
      </View>
      {cantidad > 0 && product.salePrice ? (
        <Text className="mt-2 text-right text-xs text-graphite-600">
          {cantidad.toLocaleString('es-CO')} × {money(product.salePrice)} = {money(cantidad * product.salePrice)} + IVA
        </Text>
      ) : null}
    </View>
  );
}

function Paso({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === '+' ? 'Sumar uno' : 'Restar uno'}
      onPress={onPress}
      disabled={disabled}
      className={`h-10 w-10 items-center justify-center rounded-full ${disabled ? 'bg-ice-100' : 'bg-frost-900'}`}
    >
      <Text className={`text-lg font-bold ${disabled ? 'text-graphite-400' : 'text-white'}`}>{label}</Text>
    </Pressable>
  );
}
