import { Text, TextInput, View } from 'react-native';
import { FilterChips } from '@/components/ui/FilterChips';
import type { Product } from './api';

/**
 * Piezas compartidas de los formularios de producto (Sprint 14: crear y editar).
 * Los números se guardan como texto mientras se escriben y se leen al enviar.
 */

export function CampoTexto({
  label,
  value,
  onChange,
  placeholder,
  numerico,
  negativo,
  mayusculas,
  multiline,
  maxLength,
  editable = true,
  ayuda,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Solo dígitos (y coma/punto si no es entero). */
  numerico?: 'entero' | 'decimal';
  /** Permite el signo menos (temperaturas). */
  negativo?: boolean;
  mayusculas?: boolean;
  multiline?: boolean;
  maxLength?: number;
  editable?: boolean;
  ayuda?: string;
}) {
  const limpiar = (t: string) => {
    if (mayusculas) return t.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (numerico === 'entero') return t.replace(/[^0-9]/g, '');
    if (numerico === 'decimal') return t.replace(negativo ? /[^0-9.,-]/g : /[^0-9.,]/g, '');
    return t;
  };
  return (
    <View>
      <Text className="mb-1 text-xs font-medium text-graphite-600">{label}</Text>
      <TextInput
        value={value}
        onChangeText={(t) => onChange(limpiar(t))}
        placeholder={placeholder}
        placeholderTextColor="#8295A3"
        keyboardType={numerico ? (negativo ? 'numbers-and-punctuation' : numerico === 'entero' ? 'number-pad' : 'decimal-pad') : 'default'}
        autoCapitalize={mayusculas ? 'characters' : 'sentences'}
        autoCorrect={false}
        multiline={multiline}
        maxLength={maxLength}
        editable={editable}
        className={`rounded-xl border border-ice-100 bg-white px-3 text-base text-graphite-900 ${multiline ? 'min-h-16 py-2' : 'min-h-11'}`}
      />
      {ayuda ? <Text className="mt-1 text-xs text-graphite-400">{ayuda}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------
// Datos físicos y comerciales (vida útil, temperatura, IVA, código de barras, paquete)
// ---------------------------------------------------------------------

export interface DatosForm {
  description: string;
  barcode: string;
  packSize: string;
  expiryDays: string;
  tempMin: string;
  tempMax: string;
  /** '' = sin definir */
  taxRate: string;
}

export const DATOS_VACIOS: DatosForm = {
  description: '', barcode: '', packSize: '', expiryDays: '', tempMin: '', tempMax: '', taxRate: '',
};

export function datosDe(p: Product): DatosForm {
  const s = (n: number | null) => (n === null ? '' : String(n));
  return {
    description: p.description ?? '',
    barcode: p.barcode ?? '',
    packSize: s(p.packSize),
    expiryDays: s(p.expiryDays),
    tempMin: s(p.storageTempMinC),
    tempMax: s(p.storageTempMaxC),
    taxRate: s(p.taxRate),
  };
}

export interface DatosLeidos {
  description: string | null;
  barcode: string | null;
  packSize: number | null;
  expiryDays: number | null;
  storageTempMinC: number | null;
  storageTempMaxC: number | null;
  taxRate: number | null;
}

const num = (t: string): number | null => {
  const v = t.trim().replace(',', '.');
  if (v === '' || v === '-') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

/**
 * Valida con las mismas reglas del backend y devuelve lo que falta (para el pie
 * del formulario) y los valores ya convertidos.
 * Cadena de frío = vida útil y temperatura obligatorias.
 */
export function leerDatos(d: DatosForm, cadenaFrio: boolean): { faltan: string[]; valores: DatosLeidos } {
  const faltan: string[] = [];
  const expiryDays = num(d.expiryDays);
  const packSize = num(d.packSize);
  const tempMin = num(d.tempMin);
  const tempMax = num(d.tempMax);
  const taxRate = num(d.taxRate);
  const barcode = d.barcode.trim();

  if (expiryDays !== null && !(Number.isInteger(expiryDays) && expiryDays > 0)) faltan.push('vida útil en días enteros');
  if (cadenaFrio && expiryDays === null) faltan.push('vida útil (cadena de frío)');
  if (packSize !== null && !(Number.isInteger(packSize) && packSize > 0)) faltan.push('unidades por paquete enteras');
  if (Number.isNaN(tempMin) || Number.isNaN(tempMax)) faltan.push('temperatura válida');
  else if ((tempMin === null) !== (tempMax === null)) faltan.push('temperatura mínima y máxima');
  else if (tempMin !== null && tempMax !== null && tempMin > tempMax) faltan.push('temperatura mínima ≤ máxima');
  if (cadenaFrio && (tempMin === null || tempMax === null)) faltan.push('temperatura (cadena de frío)');
  if (barcode && !/^[0-9]{8,14}$/.test(barcode)) faltan.push('código de barras de 8 a 14 dígitos');
  if (taxRate !== null && (Number.isNaN(taxRate) || taxRate < 0 || taxRate > 100)) faltan.push('IVA entre 0 y 100');

  return {
    faltan,
    valores: {
      description: d.description.trim() || null,
      barcode: barcode || null,
      packSize,
      expiryDays,
      storageTempMinC: tempMin,
      storageTempMaxC: tempMax,
      taxRate,
    },
  };
}

const IVA_BASE = ['', '0', '5', '19'];

export function DatosProducto({
  datos,
  onChange,
  cadenaFrio,
  editable = true,
}: {
  datos: DatosForm;
  onChange: (d: DatosForm) => void;
  cadenaFrio: boolean;
  editable?: boolean;
}) {
  const set = (k: keyof DatosForm) => (v: string) => onChange({ ...datos, [k]: v });
  const ivas = IVA_BASE.includes(datos.taxRate) ? IVA_BASE : [...IVA_BASE, datos.taxRate];
  return (
    <View className="gap-3">
      <View className="flex-row gap-3">
        <View className="flex-1">
          <CampoTexto
            label={cadenaFrio ? 'Vida útil (días) *' : 'Vida útil (días)'}
            value={datos.expiryDays}
            onChange={set('expiryDays')}
            numerico="entero"
            placeholder="Ej.: 180"
            editable={editable}
          />
        </View>
        <View className="flex-1">
          <CampoTexto label="Unidades por paquete" value={datos.packSize} onChange={set('packSize')} numerico="entero" placeholder="Ej.: 12" editable={editable} />
        </View>
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <CampoTexto label={cadenaFrio ? 'Temp. mínima °C *' : 'Temp. mínima °C'} value={datos.tempMin} onChange={set('tempMin')} numerico="decimal" negativo placeholder="-25" editable={editable} />
        </View>
        <View className="flex-1">
          <CampoTexto label={cadenaFrio ? 'Temp. máxima °C *' : 'Temp. máxima °C'} value={datos.tempMax} onChange={set('tempMax')} numerico="decimal" negativo placeholder="-18" editable={editable} />
        </View>
      </View>
      <View>
        <Text className="mb-1 text-xs font-medium text-graphite-600">IVA</Text>
        <FilterChips options={ivas.map((v) => ({ key: v, label: v === '' ? 'Sin definir' : `${v} %` }))} value={datos.taxRate} onChange={set('taxRate')} small />
      </View>
      <CampoTexto label="Código de barras" value={datos.barcode} onChange={set('barcode')} numerico="entero" placeholder="8 a 14 dígitos" maxLength={14} editable={editable} />
      <CampoTexto label="Descripción" value={datos.description} onChange={set('description')} multiline maxLength={2000} editable={editable} />
    </View>
  );
}
