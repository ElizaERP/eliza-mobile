import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';

/**
 * Ventana para cancelar con motivo obligatorio (mínimo 3 caracteres).
 * La usan pedidos de venta (Sprint 11) y órdenes de producción (Sprint 12).
 * Se monta solo cuando se abre, así el motivo empieza vacío cada vez.
 */
export function CancelarModal({
  titulo,
  aviso,
  placeholder,
  boton,
  enviando,
  onClose,
  onConfirm,
}: {
  titulo: string;
  aviso: string;
  placeholder: string;
  boton: string;
  enviando: boolean;
  onClose: () => void;
  onConfirm: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState('');
  const valido = motivo.trim().length >= 3;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-center bg-black/40 px-6">
        <View className="rounded-2xl bg-white p-5">
          <Text className="text-lg font-bold text-graphite-900">{titulo}</Text>
          <Text className="mt-1 text-sm text-graphite-600">{aviso}</Text>
          <Text className="mb-1 mt-4 text-xs font-medium text-graphite-600">Motivo *</Text>
          <TextInput
            value={motivo}
            onChangeText={setMotivo}
            placeholder={placeholder}
            placeholderTextColor="#8295A3"
            multiline
            maxLength={500}
            editable={!enviando}
            autoFocus
            className="min-h-20 rounded-xl border border-ice-100 bg-snow px-3 py-2 text-base text-graphite-900"
          />
          <View className="mt-4 flex-row gap-3">
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              disabled={enviando}
              className="min-h-11 flex-1 items-center justify-center rounded-2xl border border-ice-100"
            >
              <Text className="text-sm font-semibold text-graphite-600">Volver</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => onConfirm(motivo.trim())}
              disabled={!valido || enviando}
              className={`min-h-11 flex-1 items-center justify-center rounded-2xl ${valido && !enviando ? 'bg-danger' : 'bg-graphite-400/40'}`}
            >
              {enviando ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-sm font-semibold text-white">{boton}</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
