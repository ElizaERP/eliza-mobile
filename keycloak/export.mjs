#!/usr/bin/env node
/**
 * Exporta la configuración del realm "eliza" (clients, roles, scopes)
 * vía Admin API (partial export) a keycloak/eliza-realm-export.json.
 * Los usuarios NO se exportan (se recrean con provision.mjs).
 *
 * Uso: npm run kc:export   (mismas variables KC_* que provision.mjs)
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE_URL = (process.env.KC_BASE_URL ?? 'http://localhost:8080').replace(/\/+$/, '');
const REALM = process.env.KC_REALM ?? 'eliza';
const ADMIN_USER = process.env.KC_ADMIN_USER ?? 'admin';
const ADMIN_PASSWORD = process.env.KC_ADMIN_PASSWORD ?? 'admin';

async function main() {
  const tokenRes = await fetch(`${BASE_URL}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: ADMIN_USER,
      password: ADMIN_PASSWORD,
    }),
  });
  if (!tokenRes.ok) throw new Error(`Login admin falló (${tokenRes.status})`);
  const { access_token } = await tokenRes.json();

  const exportRes = await fetch(
    `${BASE_URL}/admin/realms/${REALM}/partial-export?exportClients=true&exportGroupsAndRoles=true`,
    { method: 'POST', headers: { Authorization: `Bearer ${access_token}` } },
  );
  if (!exportRes.ok) throw new Error(`Export falló (${exportRes.status})`);
  const realm = await exportRes.json();

  const outPath = join(dirname(fileURLToPath(import.meta.url)), 'eliza-realm-export.json');
  writeFileSync(outPath, JSON.stringify(realm, null, 2));
  console.log(`✅ Realm exportado a ${outPath}`);
  console.log('   Para un ambiente nuevo: montalo en Keycloak con --import-realm');
  console.log('   (ver keycloak/docker-compose.keycloak.example.yml)');
}

main().catch((err) => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
