#!/usr/bin/env node
/**
 * ELIZA — Fase 0: Provisioning de Keycloak (idempotente).
 *
 * Crea/asegura en el realm "eliza":
 *   1. Roles de realm operativos
 *   2. Client scope "eliza-claims" con mappers (tenant_id, plant_id,
 *      warehouse_id, roles planos)
 *   3. Client público "eliza-mobile" (Authorization Code + PKCE S256)
 *   4. Adjunta "eliza-claims" como default scope a eliza-mobile y,
 *      si existe, a eliza-api
 *   5. Usuarios de prueba con atributo tenant_id y roles asignados
 *
 * Es seguro re-ejecutarlo: solo crea lo que falta, no borra nada.
 *
 * Uso (desde la raíz del proyecto):
 *   set KC_BASE_URL=http://localhost:8080
 *   set KC_ADMIN_USER=admin
 *   set KC_ADMIN_PASSWORD=admin
 *   set KC_TENANT_ID=<uuid del tenant seed en Postgres>
 *   npm run kc:provision
 *
 * (en PowerShell usá $env:KC_BASE_URL="..." etc.)
 */

const BASE_URL = (process.env.KC_BASE_URL ?? 'http://localhost:8080').replace(/\/+$/, '');
const REALM = process.env.KC_REALM ?? 'eliza';
const ADMIN_USER = process.env.KC_ADMIN_USER ?? 'admin';
const ADMIN_PASSWORD = process.env.KC_ADMIN_PASSWORD ?? 'admin';
const TENANT_ID = process.env.KC_TENANT_ID ?? '00000000-0000-0000-0000-000000000000';
const TEST_PASSWORD = process.env.KC_TEST_PASSWORD ?? 'Eliza2026*';

const REALM_ROLES = [
  'tenant-admin',
  'jefe-produccion',
  'jefe-inventario',
  'jefe-calidad',
  'jefe-ventas',
  'operario-planta',
  'operario-logistica',
  'vendedor',
];

const TEST_USERS = [
  { username: 'admin.demo', firstName: 'Admin', lastName: 'Demo', roles: ['tenant-admin'] },
  { username: 'operario.demo', firstName: 'Operario', lastName: 'Planta', roles: ['operario-planta'] },
  { username: 'vendedor.demo', firstName: 'Vendedor', lastName: 'Demo', roles: ['vendedor'] },
];

const REDIRECT_URIS = ['eliza://*', 'exp://*', 'http://localhost:8081/*'];

let adminToken = '';

async function api(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 409) return { conflict: true };
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  const contentType = res.headers.get('content-type') ?? '';
  return contentType.includes('application/json') ? res.json() : null;
}

async function login() {
  const res = await fetch(`${BASE_URL}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: ADMIN_USER,
      password: ADMIN_PASSWORD,
    }),
  });
  if (!res.ok) {
    throw new Error(
      `No pude autenticarme como admin (${res.status}). Verificá KC_ADMIN_USER/KC_ADMIN_PASSWORD.`,
    );
  }
  adminToken = (await res.json()).access_token;
  console.log('✓ Autenticado contra Keycloak admin');
}

async function ensureRealmRoles() {
  const existing = await api('GET', `/admin/realms/${REALM}/roles`);
  const existingNames = new Set(existing.map((r) => r.name));
  for (const name of REALM_ROLES) {
    if (existingNames.has(name)) {
      console.log(`  · rol "${name}" ya existe`);
    } else {
      await api('POST', `/admin/realms/${REALM}/roles`, {
        name,
        description: `ELIZA — rol operativo ${name}`,
      });
      console.log(`  ✓ rol "${name}" creado`);
    }
  }
}

const MAPPERS = [
  ...['tenant_id', 'plant_id', 'warehouse_id'].map((attr) => ({
    name: attr,
    protocol: 'openid-connect',
    protocolMapper: 'oidc-usermodel-attribute-mapper',
    config: {
      'user.attribute': attr,
      'claim.name': attr,
      'jsonType.label': 'String',
      'id.token.claim': 'true',
      'access.token.claim': 'true',
      'userinfo.token.claim': 'true',
    },
  })),
  {
    name: 'roles-flat',
    protocol: 'openid-connect',
    protocolMapper: 'oidc-usermodel-realm-role-mapper',
    config: {
      'claim.name': 'roles',
      'jsonType.label': 'String',
      multivalued: 'true',
      'access.token.claim': 'true',
      'id.token.claim': 'false',
    },
  },
];

async function ensureClientScope() {
  const scopes = await api('GET', `/admin/realms/${REALM}/client-scopes`);
  let scope = scopes.find((s) => s.name === 'eliza-claims');
  if (!scope) {
    await api('POST', `/admin/realms/${REALM}/client-scopes`, {
      name: 'eliza-claims',
      description: 'Claims multi-tenant de ELIZA (tenant_id, plant_id, warehouse_id, roles)',
      protocol: 'openid-connect',
      attributes: { 'include.in.token.scope': 'true', 'display.on.consent.screen': 'false' },
    });
    const refreshed = await api('GET', `/admin/realms/${REALM}/client-scopes`);
    scope = refreshed.find((s) => s.name === 'eliza-claims');
    console.log('  ✓ client scope "eliza-claims" creado');
  } else {
    console.log('  · client scope "eliza-claims" ya existe');
  }

  const existingMappers = scope.protocolMappers ?? [];
  const existingNames = new Set(existingMappers.map((m) => m.name));
  for (const mapper of MAPPERS) {
    if (existingNames.has(mapper.name)) {
      console.log(`  · mapper "${mapper.name}" ya existe`);
    } else {
      await api(
        'POST',
        `/admin/realms/${REALM}/client-scopes/${scope.id}/protocol-mappers/models`,
        mapper,
      );
      console.log(`  ✓ mapper "${mapper.name}" creado`);
    }
  }
  return scope.id;
}

async function ensureMobileClient(scopeId) {
  const clients = await api('GET', `/admin/realms/${REALM}/clients?clientId=eliza-mobile`);
  let client = clients[0];
  if (!client) {
    await api('POST', `/admin/realms/${REALM}/clients`, {
      clientId: 'eliza-mobile',
      name: 'ELIZA Mobile App',
      protocol: 'openid-connect',
      publicClient: true,
      standardFlowEnabled: true,
      implicitFlowEnabled: false,
      directAccessGrantsEnabled: false,
      serviceAccountsEnabled: false,
      redirectUris: REDIRECT_URIS,
      webOrigins: ['+'],
      attributes: {
        'pkce.code.challenge.method': 'S256',
        'post.logout.redirect.uris': 'eliza://*##exp://*',
      },
    });
    const refreshed = await api('GET', `/admin/realms/${REALM}/clients?clientId=eliza-mobile`);
    client = refreshed[0];
    console.log('  ✓ client "eliza-mobile" creado (público, PKCE S256)');
  } else {
    console.log('  · client "eliza-mobile" ya existe');
  }

  await api(
    'PUT',
    `/admin/realms/${REALM}/clients/${client.id}/default-client-scopes/${scopeId}`,
  );
  console.log('  ✓ scope "eliza-claims" adjuntado a eliza-mobile');

  // Si existe eliza-api, adjuntarle el mismo scope (mismos claims para el backend)
  const apiClients = await api('GET', `/admin/realms/${REALM}/clients?clientId=eliza-api`);
  if (apiClients[0]) {
    await api(
      'PUT',
      `/admin/realms/${REALM}/clients/${apiClients[0].id}/default-client-scopes/${scopeId}`,
    );
    console.log('  ✓ scope "eliza-claims" adjuntado a eliza-api');
  } else {
    console.log('  · client "eliza-api" no existe aún (ok, se omite)');
  }
}

async function ensureUsers() {
  const allRoles = await api('GET', `/admin/realms/${REALM}/roles`);
  const roleByName = Object.fromEntries(allRoles.map((r) => [r.name, r]));

  for (const def of TEST_USERS) {
    const found = await api(
      'GET',
      `/admin/realms/${REALM}/users?username=${encodeURIComponent(def.username)}&exact=true`,
    );
    let user = found[0];
    if (!user) {
      await api('POST', `/admin/realms/${REALM}/users`, {
        username: def.username,
        enabled: true,
        emailVerified: true,
        firstName: def.firstName,
        lastName: def.lastName,
        email: `${def.username}@bcmcongelados.test`,
        attributes: { tenant_id: [TENANT_ID] },
        credentials: [{ type: 'password', value: TEST_PASSWORD, temporary: false }],
      });
      const refreshed = await api(
        'GET',
        `/admin/realms/${REALM}/users?username=${encodeURIComponent(def.username)}&exact=true`,
      );
      user = refreshed[0];
      console.log(`  ✓ usuario "${def.username}" creado (password: ${TEST_PASSWORD})`);
    } else {
      console.log(`  · usuario "${def.username}" ya existe`);
    }

    const rolesToAssign = def.roles.map((r) => roleByName[r]).filter(Boolean);
    await api('POST', `/admin/realms/${REALM}/users/${user.id}/role-mappings/realm`, rolesToAssign);
    console.log(`  ✓ roles [${def.roles.join(', ')}] asignados a "${def.username}"`);
  }
}

async function main() {
  console.log(`\nELIZA — Provisioning de Keycloak\nRealm: ${REALM} · ${BASE_URL}\n`);
  if (TENANT_ID.startsWith('00000000')) {
    console.warn(
      '⚠️  KC_TENANT_ID no definido — usando placeholder. Tomá el UUID real del tenant seed:\n' +
        '    SELECT id, name FROM tenants;  (en tu Postgres de ELIZA)\n',
    );
  }
  await login();
  console.log('\n[1/4] Roles de realm');
  await ensureRealmRoles();
  console.log('\n[2/4] Client scope eliza-claims + mappers');
  const scopeId = await ensureClientScope();
  console.log('\n[3/4] Client eliza-mobile');
  await ensureMobileClient(scopeId);
  console.log('\n[4/4] Usuarios de prueba');
  await ensureUsers();
  console.log(
    `\n✅ Provisioning completo.\n` +
      `   Probá el login en la app con: operario.demo / ${TEST_PASSWORD}\n` +
      `   Luego corré "npm run kc:export" para versionar la config del realm.\n`,
  );
}

main().catch((err) => {
  console.error(`\n❌ ${err.message}`);
  process.exit(1);
});
