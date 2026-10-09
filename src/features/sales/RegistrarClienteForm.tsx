import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import type { ApiError } from '@/core/http/apiClient';
import { useAuthStore } from '@/core/auth';
import { canGrantCredit } from '@/core/rbac/menu';
import { FilterChips } from '@/components/ui/FilterChips';
import type { ClienteListItem, CondicionesPago } from './api';
import { useRegistrarCliente } from './hooks';
import { CONDICIONES_PAGO } from './labels';

const CONDICIONES = (Object.keys(CONDICIONES_PAGO) as CondicionesPago[]).map((k) => ({ key: k, label: CONDICIONES_PAGO[k] }));

/**
 * Registro rápido de un cliente nuevo desde Nuevo pedido (Sprint 10).
 * El vendedor lo registra a Contado; solo gerente/admin eligen crédito (lo valida el backend).
 */
export function RegistrarClienteForm({
  onCreated,
  onCancel,
}: {
  onCreated: (c: ClienteListItem) => void;
  onCancel: () => void;
}) {
  const roles = useAuthStore((s) => s.user?.roles);
  const puedeCredito = canGrantCredit(roles ?? []);
  const registrar = useRegistrarCliente();
  const [f, setF] = useState({
    razonSocial: '', nit: '', nombreComercial: '', direccion: '', ciudad: '', departamento: '',
    contactoNombre: '', contactoTelefono: '', contactoEmail: '',
  });
  const [condiciones, setCondiciones] = useState<CondicionesPago>('Contado');
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const faltan: string[] = [];
  if (f.razonSocial.trim().length < 3) faltan.push('razón social');
  if (!/^\d{6,12}(-\d)?$/.test(f.nit.replace(/[.\s]/g, ''))) faltan.push('NIT válido (ej. 900123456-7)');
  if (f.direccion.trim().length < 5) faltan.push('dirección');
  if (f.ciudad.trim().length < 2) faltan.push('ciudad');
  if (f.departamento.trim().length < 2) faltan.push('departamento');
  const email = f.contactoEmail.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) faltan.push('correo válido');

  const guardar = () => {
    setError(null);
    const opt = (v: string) => v.trim() || undefined;
    registrar.mutate(
      {
        nit: f.nit.replace(/[.\s]/g, ''),
        razonSocial: f.razonSocial.trim(),
        nombreComercial: opt(f.nombreComercial),
        condicionesPago: puedeCredito ? condiciones : undefined,
        direccionFiscal: { direccion: f.direccion.trim(), ciudad: f.ciudad.trim(), departamento: f.departamento.trim() },
        contactoNombre: opt(f.contactoNombre),
        contactoTelefono: opt(f.contactoTelefono),
        contactoEmail: opt(email),
      },
      {
        onSuccess: (c) =>
          onCreated({
            id: c.id, codigo: c.codigo, nit: c.nit, razonSocial: c.razonSocial, nombreComercial: c.nombreComercial,
            estado: c.estado, condicionesPago: c.condicionesPago, ciudad: c.direccionFiscal.ciudad, createdAt: c.createdAt,
          }),
        onError: (e) => {
          const err = e as unknown as ApiError;
          setError(
            err.status === 409
              ? 'Ya existe un cliente con ese NIT. Búscalo en la lista.'
              : `${err.status ? `HTTP ${err.status} · ` : ''}${err.message}`,
          );
        },
      },
    );
  };

  return (
    <View className="gap-3 rounded-2xl border border-frost-700 bg-white p-4">
      <Text className="text-base font-semibold text-graphite-900">Registrar cliente nuevo</Text>
      <Campo label="Razón social *" value={f.razonSocial} onChange={set('razonSocial')} placeholder="Distribuidora La Nevera S.A.S." />
      <Campo label="NIT *" value={f.nit} onChange={set('nit')} placeholder="900123456-7" keyboard="numbers-and-punctuation" />
      <Campo label="Nombre comercial" value={f.nombreComercial} onChange={set('nombreComercial')} placeholder="La Nevera" />
      <Campo label="Dirección *" value={f.direccion} onChange={set('direccion')} placeholder="Carrera 27 # 36-65" />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Campo label="Ciudad *" value={f.ciudad} onChange={set('ciudad')} placeholder="Bogotá" />
        </View>
        <View className="flex-1">
          <Campo label="Departamento *" value={f.departamento} onChange={set('departamento')} placeholder="Cundinamarca" />
        </View>
      </View>
      <Campo label="Contacto" value={f.contactoNombre} onChange={set('contactoNombre')} placeholder="Nombre de quien recibe" />
      <Campo label="Teléfono" value={f.contactoTelefono} onChange={set('contactoTelefono')} placeholder="+57 316 123 4567" keyboard="phone-pad" />
      <Campo label="Correo" value={f.contactoEmail} onChange={set('contactoEmail')} placeholder="compras@cliente.com" keyboard="email-address" />

      <View>
        <Text className="mb-1 text-xs font-medium text-graphite-600">Condiciones de pago</Text>
        {puedeCredito ? (
          <FilterChips options={CONDICIONES} value={condiciones} onChange={setCondiciones} small />
        ) : (
          <Text className="text-sm text-graphite-600">
            Contado. Para darle crédito, el gerente de ventas lo cambia después.
          </Text>
        )}
      </View>

      {faltan.length > 0 ? <Text className="text-xs text-graphite-400">Falta: {faltan.join(', ')}.</Text> : null}
      {error ? <Text className="text-sm text-danger">{error}</Text> : null}

      <View className="flex-row gap-3">
        <Pressable
          accessibilityRole="button"
          onPress={onCancel}
          disabled={registrar.isPending}
          className="min-h-11 flex-1 items-center justify-center rounded-2xl border border-ice-100 bg-white"
        >
          <Text className="text-sm font-semibold text-graphite-600">Cancelar</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={guardar}
          disabled={faltan.length > 0 || registrar.isPending}
          className={`min-h-11 flex-1 items-center justify-center rounded-2xl ${faltan.length > 0 ? 'bg-graphite-400/40' : 'bg-frost-900'}`}
        >
          {registrar.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-sm font-semibold text-white">Registrar y usar</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function Campo({
  label,
  value,
  onChange,
  placeholder,
  keyboard,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboard?: 'default' | 'phone-pad' | 'email-address' | 'numbers-and-punctuation';
}) {
  return (
    <View>
      <Text className="mb-1 text-xs font-medium text-graphite-600">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#8295A3"
        keyboardType={keyboard ?? 'default'}
        autoCapitalize={keyboard === 'email-address' ? 'none' : 'sentences'}
        autoCorrect={false}
        className="min-h-11 rounded-xl border border-ice-100 bg-snow px-3 text-base text-graphite-900"
      />
    </View>
  );
}
