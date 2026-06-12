import { ActivityIndicator, Pressable, Text } from 'react-native';

interface ButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
}

/**
 * Botón con targets grandes (planta: uso con guantes).
 */
export function Button({ label, onPress, loading, disabled, variant = 'primary' }: ButtonProps) {
  const isDisabled = disabled || loading;
  const base = 'min-h-14 items-center justify-center rounded-2xl px-6';
  const styles = {
    primary: 'bg-frost-900 active:bg-frost-700',
    ghost: 'bg-transparent border border-graphite-400 active:bg-ice-50',
    danger: 'bg-danger active:opacity-80',
  }[variant];
  const textStyles = {
    primary: 'text-white',
    ghost: 'text-frost-900',
    danger: 'text-white',
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      className={`${base} ${styles} ${isDisabled ? 'opacity-50' : ''}`}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'ghost' ? '#0B3A53' : '#FFFFFF'} />
      ) : (
        <Text className={`text-base font-semibold ${textStyles}`}>{label}</Text>
      )}
    </Pressable>
  );
}
