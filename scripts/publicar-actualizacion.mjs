#!/usr/bin/env node
/**
 * Publica una actualización por aire (EAS Update) para los APK instalados.
 *
 *   npm run actualizar -- "Texto corto de qué cambió"
 *   npm run actualizar -- "Texto" production     (canal, por defecto preview)
 *
 * Por qué este script y no `eas update` directo: la URL de la API se queda
 * "pegada" en el JavaScript al empaquetar. Si se publicara con el .env local
 * (que en desarrollo puede apuntar a la IP de Tailscale), los teléfonos sin
 * Tailscale dejarían de conectar. Aquí se toma la URL del perfil de eas.json,
 * la misma que usan los APK.
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const [mensaje, canal = 'preview'] = process.argv.slice(2);
if (!mensaje || mensaje.trim().length < 3) {
  console.error('Uso: npm run actualizar -- "Qué cambió" [preview|production]');
  process.exit(1);
}

const eas = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));
const perfil = eas.build?.[canal];
const url = perfil?.env?.EXPO_PUBLIC_API_BASE_URL;
if (!perfil || perfil.channel !== canal || !url) {
  console.error(`eas.json no tiene un perfil "${canal}" con channel y EXPO_PUBLIC_API_BASE_URL.`);
  process.exit(1);
}

console.log(`Publicando en el canal "${canal}" con la API ${url}`);
const r = spawnSync('npx', ['eas-cli', 'update', '--channel', canal, '--message', mensaje.trim()], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, EXPO_PUBLIC_API_BASE_URL: url },
});
process.exit(r.status ?? 1);
