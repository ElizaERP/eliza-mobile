# TESTING — Sprint 9.1 · ELIZA Mobile (Fundación)

Guía de pruebas end-to-end del sprint: Fase 0 (Keycloak) + app Expo con
login PKCE, menú por rol y cierre de sesión.

---

## 0. Prerrequisitos

- Node.js 20+, npm
- Docker con `eliza-keycloak` corriendo (puerto 8080) — ya lo tenés
- Backend ELIZA corriendo en el puerto 3000 (opcional para este sprint;
  la app aún no consume endpoints de negocio)
- Para probar en teléfono físico: app **Expo Go** instalada y el teléfono
  en la **misma red WiFi** que tu PC

### 0.1 Averiguá tu IP LAN (Windows)
```cmd
ipconfig
```
Buscá "Dirección IPv4" del adaptador WiFi/Ethernet (ej: `192.168.1.10`).
**Esta IP se usa en TODO lo que sigue.**

> ⚠️ **El gotcha del issuer:** el token que emite Keycloak lleva el `iss`
> de la URL por la que se le habló. Si la app habla con `10.0.2.2:8080` y
> tu backend valida contra `localhost:8080`, el backend rechazará el token.
> **Solución para desarrollo:** usá la IP LAN en la app **y** en la
> configuración del backend (issuer/JWKS) mientras pruebes móvil.

---

## 1. Fase 0 — Provisioning de Keycloak (una sola vez)

Obtené primero el `tenant_id` real de tu seed:
```sql
SELECT id, name FROM tenants;   -- en tu Postgres de ELIZA
```

Desde la raíz del proyecto (CMD):
```cmd
npm install
set KC_BASE_URL=http://localhost:8080
set KC_ADMIN_USER=admin
set KC_ADMIN_PASSWORD=<tu password de admin>
set KC_TENANT_ID=<uuid del tenant seed>
npm run kc:provision
```
(en PowerShell: `$env:KC_BASE_URL="http://localhost:8080"` etc.)

**Resultado esperado:** el script reporta ✓ en roles, client scope
`eliza-claims` con sus 4 mappers, client `eliza-mobile` y 3 usuarios:

| Usuario | Password | Rol | Módulos que debe ver |
|---|---|---|---|
| `admin.demo` | `Eliza2026*` | tenant-admin | los 4 |
| `operario.demo` | `Eliza2026*` | operario-planta | Producción + Inventario |
| `vendedor.demo` | `Eliza2026*` | vendedor | Ventas + Catálogo |

Es **idempotente**: si lo corrés dos veces, reporta "ya existe" y sigue.

### 1.1 Verificación del token (sin la app)
Habilitá temporalmente *Direct access grants* en `eliza-mobile`
(consola admin → Clients → eliza-mobile → Capability config) **o** verificá
directo desde la app en el paso 3.4. Si lo habilitaste:
```cmd
curl -X POST http://localhost:8080/realms/eliza/protocol/openid-connect/token -d "grant_type=password&client_id=eliza-mobile&username=operario.demo&password=Eliza2026*"
```
Pegá el `access_token` en https://jwt.io y verificá que el payload tenga
`tenant_id` y `roles: ["operario-planta", ...]`. Después **deshabilitá**
Direct access grants de nuevo.

### 1.2 Versionar la config del realm
```cmd
npm run kc:export
```
Genera `keycloak/eliza-realm-export.json`. Está en `.gitignore` por defecto
porque puede contener secrets de clients confidenciales — revisalo y decidí
si lo versionás tal cual o saneado.

---

## 2. Configuración y arranque de la app

```cmd
copy .env.example .env
```
Editá `.env` con tu IP LAN:
```
EXPO_PUBLIC_KEYCLOAK_BASE_URL=http://192.168.1.10:8080
EXPO_PUBLIC_KEYCLOAK_REALM=eliza
EXPO_PUBLIC_KEYCLOAK_CLIENT_ID=eliza-mobile
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:3000
```
| Dónde corre la app | KEYCLOAK_BASE_URL |
|---|---|
| Teléfono físico (Expo Go) — **recomendado** | `http://<IP-LAN>:8080` |
| Android Emulator | `http://10.0.2.2:8080` |
| iOS Simulator | `http://localhost:8080` |

Luego:
```cmd
npx expo install --fix
npm run start:clear
```
Escaneá el QR con Expo Go (Android) o la cámara (iOS).

> Si Expo Go no conecta, probá `npx expo start --tunnel`.
> Si cambiás el `.env`, reiniciá siempre con `npm run start:clear`
> (las EXPO_PUBLIC_* se inyectan en build).

---

## 3. Matriz de pruebas

### 3.1 Splash y bootstrap
- [ ] Al abrir, splash azul "ELIZA / BCM Congelados" → redirige a Login
      (primera vez, sin sesión guardada)

### 3.2 Login PKCE
- [ ] "Iniciar sesión" abre el navegador con la página de login de Keycloak
- [ ] La URL del navegador contiene `code_challenge_method=S256`
- [ ] Login con `operario.demo / Eliza2026*` → vuelve a la app → Home
- [ ] Credenciales inválidas → Keycloak muestra error, la app no avanza

### 3.3 Menú por rol
- [ ] `operario.demo` ve **solo** Producción e Inventario
- [ ] Logout → login con `vendedor.demo` → ve **solo** Ventas y Catálogo
- [ ] `admin.demo` ve los 4 módulos
- [ ] Tocar un módulo → placeholder "Disponible en Sprint 9.x"

### 3.4 Claims del JWT (pantalla Perfil)
- [ ] Avatar (arriba a la derecha) → Perfil
- [ ] **Tenant** muestra el UUID de tu tenant seed (NO "⚠️ sin tenant_id")
- [ ] **Roles** muestra el rol del usuario (NO "⚠️ sin roles")

> Si aparece "sin tenant_id": el mapper existe pero el usuario no tiene el
> atributo, o el scope no está adjunto al client. Re-corré `kc:provision`
> y revisá Clients → eliza-mobile → Client scopes.

### 3.5 Persistencia y refresh de sesión
- [ ] Cerrá la app por completo y reabrila → entra directo a Home
      (el refresh token en SecureStore restauró la sesión)
- [ ] Dejá la app abierta > 15 min (vida del access token) y navegá:
      no debe pedir login (renovación silenciosa)

### 3.6 Logout
- [ ] Perfil → "Cerrar sesión" → vuelve a Login
- [ ] Cerrá y reabrí la app → pide login (refresh token revocado y borrado)

### 3.7 TypeScript
```cmd
npm run typecheck
```
- [ ] 0 errores

---

## 4. Troubleshooting

| Síntoma | Causa probable | Solución |
|---|---|---|
| El navegador no abre / "request null" | `.env` sin configurar o caché | Verificá `.env`, `npm run start:clear` |
| `invalid_redirect_uri` en Keycloak | Falta el redirect en el client | `kc:provision` agrega `exp://*` y `eliza://*`; verificá en consola admin |
| Login ok pero no vuelve a la app | Expo Go con tunnel y URI distinta | Usá LAN (no tunnel) o agregá la URI exacta que muestra el error |
| "sin tenant_id" en Perfil | Scope no adjunto o atributo faltante | Re-correr `kc:provision`; verificar usuario → Attributes |
| Backend rechaza el token (401) | Mismatch de issuer (LAN vs localhost) | Backend y app deben usar la MISMA URL de Keycloak |
| Timeout hacia Keycloak desde el teléfono | Firewall de Windows | Permitir puerto 8080/3000 en redes privadas |

---

## 5. Definition of Done — Sprint 9.1
- [ ] Fase 0 ejecutada e idempotente, realm exportado
- [ ] Login/logout PKCE funcionando en dispositivo real
- [ ] Claims `tenant_id` + roles visibles en Perfil
- [ ] Menú por rol correcto para los 3 usuarios demo
- [ ] Sesión persiste tras reiniciar la app
- [ ] `npm run typecheck` limpio
