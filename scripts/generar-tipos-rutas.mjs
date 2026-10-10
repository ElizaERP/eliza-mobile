#!/usr/bin/env node
/**
 * Genera .expo/types/router.d.ts (rutas tipadas de expo-router) sin abrir Metro.
 *
 *   npm run tipos:rutas
 *
 * Sin este archivo, `tsc` acepta cualquier texto en router.push('/…'): una ruta
 * mal escrita o una pantalla borrada solo se descubren al tocar el botón en el
 * teléfono. Con él, tsc marca el error. Normalmente lo genera `expo start`; en
 * el CI (y antes de `npm run verificar`) no hay Metro corriendo, así que se usa
 * el mismo generador que usa el CLI de Expo, resuelto desde @expo/cli.
 */
import { mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(raiz, 'package.json'));

// Mismo valor que fija el CLI de Expo antes de generar (las rutas viven en app/).
process.env.EXPO_ROUTER_APP_ROOT = path.join(raiz, 'app');

const dirExpo = path.dirname(require.resolve('expo/package.json'));
const dirCli = path.dirname(require.resolve('@expo/cli/package.json', { paths: [dirExpo] }));
const generador = require(require.resolve('@expo/router-server/build/typed-routes', { paths: [dirCli] }));

const destino = path.join(raiz, '.expo', 'types');
mkdirSync(destino, { recursive: true });
generador.regenerateDeclarations(destino, {});

// regenerateDeclarations escribe con un pequeño retraso: esperar el archivo.
const archivo = path.join(destino, 'router.d.ts');
const limite = Date.now() + 10_000;
const esperar = () => {
  try {
    if (statSync(archivo).size > 0) {
      console.log(`Rutas tipadas generadas: ${path.relative(raiz, archivo)}`);
      return;
    }
  } catch {
    /* todavía no existe */
  }
  if (Date.now() > limite) {
    console.error('No se generó .expo/types/router.d.ts');
    process.exit(1);
  }
  setTimeout(esperar, 100);
};
esperar();
