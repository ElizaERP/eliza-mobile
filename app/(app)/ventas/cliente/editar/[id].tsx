import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ApiError } from '@/core/http/apiClient';
import { FilterChips } from '@/components/ui/FilterChips';
import { Section } from '@/components/ui/Section';
import type { CondicionesPago, EditarClienteBody } from '@/features/sales/api';
import { useCustomer, useEditarCliente } from '@/features/sales/hooks';
import { CONDICIONES_PAGO } from '@/features/sales/labels';
import { Campo } from '@/features/sales/RegistrarClienteForm';

const CONDICIONES = (Object.keys(CONDICIONES_PAGO) as CondicionesPago[]).map((k) => ({ key: k, label: CONDICIONES_PAGO[k] }));

/**
 * Editar cliente (Sprint 11, gerente de ventas / admin): datos, dirección fiscal,
 * contacto, notas y condiciones de pago (aquí se le da o quita crédito).
 * El NIT y el código no se editan.
 */
export default function EditarClienteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const customer = useCustomer(id ?? '');
  const editar = useEditarCliente(id ?? '');
  const c = customer.data;

  const [f, setF] = useState({
    razonSocial: '', nombreComercial: '', direccion: '', ciudad: '', departamento: '',
    contactoNombre: '', contactoTelefono: '', contactoEmail: '', notas: '',
  });
  const [condiciones, setCondiciones] = useState<CondicionesPago>('Contado');
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    if (!c || cargado) return;
    setF({
      razonSocial: c.razonSocial, nombreComercial: c.nombreComercial ?? '',
      direccion: c.direccionFiscal.direccion, ciudad: c.direccionFiscal.ciudad, departamento: c.direccionFiscal.departamento,
      contactoNombre: c.contactoNombre ?? '', contactoTelefono: c.contactoTelefono ?? '', contactoEmail: c.contactoEmail ?? '',
      notas: c.notas ?? '',
    });
    setCondiciones(c.condicionesPago);
    setCargado(true);
  }, [c, cargado]);

  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const faltan: string[] = [];
  if (f.razonSocial.trim().length < 3) faltan.push('razón social');
  if (f.direccion.trim().length < 5) faltan.push('dirección');
  if (f.ciudad.trim().length < 2) faltan.push('ciudad');
  if (f.departamento.trim().length < 2) faltan.push('departamento');
  const email = f.contactoEmail.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) faltan.push('correo válido');
  const listo = cargado && faltan.length === 0 && !editar.isPending;

  const guardar = () => {
    if (!c) return;
    const body: EditarClienteBody = {
      razonSocial: f.razonSocial.trim(),
      nombreComercial: f.nombreComercial.trim(),
      condicionesPago: condiciones,
      direccionFiscal: {
        direccion: f.direccion.trim(),
        ciudad: f.ciudad.trim(),
        departamento: f.departamento.trim(),
        ...(c.direccionFiscal.telefono ? { telefono: c.direccionFiscal.telefono } : {}),
        ...(c.direccionFiscal.notas ? { notas: c.direccionFiscal.notas } : {}),
      },
      contactoNombre: f.contactoNombre.trim(),
      contactoTelefono: f.contactoTelefono.trim(),
      notas: f.notas.trim(),
      // El backend valida el formato del correo: solo se envía si hay uno
      ...(email ? { contactoEmail: email } : {}),
    };
    const pasaACredito = c.condicionesPago === 'Contado' && condiciones !== 'Contado';
    const hacer = () =>
      editar.mutate(body, {
        onSuccess: () => router.back(),
        onError: (e) => Alert.alert('No se pudo guardar', (e as unknown as ApiError).message),
      });
    if (pasaACredito) {
      Alert.alert('Dar crédito', `${c.razonSocial} pasará a ${CONDICIONES_PAGO[condiciones]}.`, [
        { text: 'Volver', style: 'cancel' },
        { text: 'Guardar', onPress: hacer },
      ]);
    } else {
      hacer();
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Editar cliente' }} />
      <KeyboardAvoidingView className="flex-1 bg-snow" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="p-5 pb-8" keyboardShouldPersistTaps="handled">
          {customer.isLoading ? <ActivityIndicator className="mt-10" color="#0B3A53" /> : null}
          {c ? (
            <>
              <Text className="text-xs text-graphite-400">
                NIT {c.nit} · {c.codigo} (no se editan)
              </Text>
              <Section title="Datos">
                <View className="gap-3">
                  <Campo label="Razón social *" value={f.razonSocial} onChange={set('razonSocial')} />
                  <Campo label="Nombre comercial" value={f.nombreComercial} onChange={set('nombreComercial')} />
                </View>
              </Section>
              <Section title="Condiciones de pago">
                <FilterChips options={CONDICIONES} value={condiciones} onChange={setCondiciones} small />
              </Section>
              <Section title="Dirección fiscal">
                <View className="gap-3">
                  <Campo label="Dirección *" value={f.direccion} onChange={set('direccion')} />
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Campo label="Ciudad *" value={f.ciudad} onChange={set('ciudad')} />
                    </View>
                    <View className="flex-1">
                      <Campo label="Departamento *" value={f.departamento} onChange={set('departamento')} />
                    </View>
                  </View>
                </View>
              </Section>
              <Section title="Contacto">
                <View className="gap-3">
                  <Campo label="Nombre" value={f.contactoNombre} onChange={set('contactoNombre')} />
                  <Campo label="Teléfono" value={f.contactoTelefono} onChange={set('contactoTelefono')} keyboard="phone-pad" />
                  <Campo label="Correo" value={f.contactoEmail} onChange={set('contactoEmail')} keyboard="email-address" />
                </View>
              </Section>
              <Section title="Notas">
                <Campo label="Notas internas" value={f.notas} onChange={set('notas')} />
              </Section>
            </>
          ) : null}
        </ScrollView>

        <View className="border-t border-ice-100 bg-white px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 12) + 12 }}>
          {faltan.length > 0 && cargado ? <Text className="mb-2 text-xs text-graphite-400">Falta: {faltan.join(', ')}.</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={!listo}
            onPress={guardar}
            className={`min-h-12 items-center justify-center rounded-2xl ${listo ? 'bg-frost-900' : 'bg-graphite-400/40'}`}
          >
            {editar.isPending ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-base font-semibold text-white">Guardar cambios</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
