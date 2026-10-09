import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import type { ApiError } from '@/core/http/apiClient';
import { Card, Section } from '@/components/ui/Section';
import type { Product } from '@/features/catalog/api';
import { useProductList } from '@/features/catalog/hooks';
import { formatSalePrice } from '@/features/catalog/labels';
import type { ClienteListItem } from '@/features/sales/api';
import { useCrearPedido, useCustomerList } from '@/features/sales/hooks';
import { CONDICIONES_PAGO, money } from '@/features/sales/labels';

/**
 * Nuevo pedido (Sprint 10). El vendedor elige el cliente y las cantidades; el precio sale
 * de la lista del catálogo (el backend lo aplica y no deja que el vendedor lo cambie).
 * El pedido queda en Borrador: confirmarlo sigue siendo del gerente de ventas.
 */
export default function NuevoPedidoScreen() {
  const router = useRouter();
  const [cliente, setCliente] = useState<ClienteListItem | null>(null);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [notas, setNotas] = useState('');
  const crear = useCrearPedido();

  const products = useProductList(['Active'], true, ['FinishedGood']);
  const catalogo: Product[] = useMemo(() => products.data?.pages.flatMap((p) => p.items) ?? [], [products.data]);
  const elegidos = catalogo.filter((p) => (cantidades[p.id] ?? 0) > 0);

  // Estimado en pantalla con el precio de lista e IVA del catálogo; el total oficial lo calcula el backend
  const subtotal = elegidos.reduce((a, p) => a + (p.salePrice ?? 0) * (cantidades[p.id] ?? 0), 0);
  const iva = elegidos.reduce(
    (a, p) => a + Math.round((p.salePrice ?? 0) * (cantidades[p.id] ?? 0) * ((p.taxRate ?? 0) / 100) * 100) / 100,
    0,
  );
  const unidades = elegidos.reduce((a, p) => a + (cantidades[p.id] ?? 0), 0);
  const listo = !!cliente && elegidos.length > 0 && !crear.isPending;

  const setCantidad = (id: string, n: number) =>
    setCantidades((prev) => ({ ...prev, [id]: Math.max(0, Math.min(99_999, Math.floor(n) || 0)) }));

  const enviar = () => {
    if (!cliente) return;
    crear.mutate(
      {
        clienteId: cliente.id,
        notas,
        lineas: elegidos.map((p) => ({ productId: p.id, productName: p.name, cantidad: cantidades[p.id] ?? 0 })),
      },
      {
        onSuccess: ({ pedido, fallidas }) => {
          if (fallidas.length > 0) {
            Alert.alert(
              'Pedido creado con avisos',
              `El pedido ${pedido.codigo} quedó en Borrador, pero estas líneas no se agregaron:\n\n` +
                fallidas.map((f) => `• ${f.productName}: ${f.mensaje}`).join('\n'),
            );
          }
          router.replace({ pathname: '/(app)/ventas/pedido/[id]', params: { id: pedido.id } });
        },
        onError: (e) => {
          const err = e as unknown as ApiError;
          Alert.alert('No se pudo crear el pedido', `${err.status ? `HTTP ${err.status} · ` : ''}${err.message}`);
        },
      },
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Nuevo pedido' }} />
      <KeyboardAvoidingView className="flex-1 bg-snow" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="p-5 pb-8" keyboardShouldPersistTaps="handled">
          {/* 1. Cliente */}
          <Section title="1. Cliente">
            {cliente ? (
              <Card>
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-graphite-900">{cliente.razonSocial}</Text>
                    <Text className="mt-1 text-xs text-graphite-400">
                      NIT {cliente.nit} · {cliente.ciudad} · {CONDICIONES_PAGO[cliente.condicionesPago]}
                    </Text>
                  </View>
                  <Pressable accessibilityRole="button" onPress={() => setCliente(null)} disabled={crear.isPending}>
                    <Text className="text-sm font-medium text-frost-700">Cambiar</Text>
                  </Pressable>
                </View>
              </Card>
            ) : (
              <SelectorCliente onSelect={setCliente} />
            )}
          </Section>

          {/* 2. Productos */}
          <Section title="2. Productos">
            {products.isLoading ? (
              <ActivityIndicator color="#0B3A53" />
            ) : products.error ? (
              <Text className="text-sm text-danger">No se pudo cargar el catálogo.</Text>
            ) : catalogo.length === 0 ? (
              <Text className="text-sm text-graphite-600">No hay productos terminados activos para vender.</Text>
            ) : (
              <View className="gap-3">
                {catalogo.map((p) => (
                  <FilaProducto
                    key={p.id}
                    product={p}
                    cantidad={cantidades[p.id] ?? 0}
                    onChange={(n) => setCantidad(p.id, n)}
                    disabled={crear.isPending}
                  />
                ))}
                {products.hasNextPage ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void products.fetchNextPage()}
                    className="min-h-10 items-center justify-center rounded-full border border-ice-100 bg-white"
                  >
                    <Text className="text-sm font-medium text-frost-900">
                      {products.isFetchingNextPage ? 'Cargando…' : 'Ver más productos'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </Section>

          {/* 3. Notas */}
          <Section title="3. Notas (opcional)">
            <TextInput
              value={notas}
              onChangeText={setNotas}
              placeholder="Ej.: entregar antes de las 10 a. m."
              placeholderTextColor="#8295A3"
              multiline
              maxLength={1000}
              editable={!crear.isPending}
              className="min-h-20 rounded-2xl border border-ice-100 bg-white px-4 py-3 text-base text-graphite-900"
            />
          </Section>
        </ScrollView>

        {/* Resumen y botón fijo abajo */}
        <View className="border-t border-ice-100 bg-white px-5 pb-6 pt-3">
          <View className="flex-row items-end justify-between">
            <View>
              <Text className="text-xs text-graphite-400">
                {elegidos.length === 0
                  ? 'Sin productos'
                  : `${elegidos.length} producto${elegidos.length === 1 ? '' : 's'} · ${unidades.toLocaleString('es-CO')} und · IVA ${money(iva)}`}
              </Text>
              <Text className="text-2xl font-bold text-frost-900">{money(subtotal + iva)}</Text>
            </View>
            <Text className="text-xs text-graphite-400">total estimado</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !listo }}
            disabled={!listo}
            onPress={enviar}
            className={`mt-3 min-h-12 items-center justify-center rounded-2xl ${listo ? 'bg-frost-900' : 'bg-graphite-400/40'}`}
          >
            {crear.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-base font-semibold text-white">
                {!cliente ? 'Elige un cliente' : elegidos.length === 0 ? 'Agrega productos' : 'Crear pedido en borrador'}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

function SelectorCliente({ onSelect }: { onSelect: (c: ClienteListItem) => void }) {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 350);
    return () => clearTimeout(t);
  }, [text]);
  const list = useCustomerList(q, q.length === 0 || q.length >= 2);
  const clientes = (list.data?.pages.flatMap((p) => p.items) ?? []).filter((c) => c.estado === 'Activo').slice(0, 15);

  return (
    <View className="gap-2">
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Buscar cliente por razón social, NIT o código"
        placeholderTextColor="#8295A3"
        autoCorrect={false}
        autoCapitalize="none"
        className="min-h-12 rounded-2xl border border-ice-100 bg-white px-4 text-base text-graphite-900"
      />
      {list.isLoading ? (
        <ActivityIndicator color="#0B3A53" />
      ) : clientes.length === 0 ? (
        <Text className="text-sm text-graphite-600">{q ? `Ningún cliente activo coincide con “${q}”.` : 'No hay clientes activos.'}</Text>
      ) : (
        clientes.map((c) => (
          <Pressable
            key={c.id}
            accessibilityRole="button"
            onPress={() => onSelect(c)}
            className="rounded-2xl border border-ice-100 bg-white p-4 active:bg-ice-50"
          >
            <Text className="text-base font-semibold text-graphite-900">{c.razonSocial}</Text>
            <Text className="mt-1 text-xs text-graphite-400">
              NIT {c.nit} · {c.codigo} · {c.ciudad}
            </Text>
          </Pressable>
        ))
      )}
    </View>
  );
}

function FilaProducto({
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
              className="h-10 w-14 rounded-xl border border-ice-100 text-center text-base font-semibold text-graphite-900"
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
