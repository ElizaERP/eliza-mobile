# ELIZA Mobile — Sprint 9.1 (Fundación)

App móvil operativa de ELIZA para BCM Congelados. React Native + Expo,
online-only, cubre los 4 BCs operativos (Catálogo, Inventario, Producción,
Ventas) + Auth. Sprint 9.1 entrega: autenticación OIDC PKCE contra Keycloak,
shell de navegación, menú por rol y la base HTTP/estado para los siguientes
sub-sprints.

## Stack
| Capa | Tecnología |
|---|---|
| Runtime | Expo SDK 57 · React Native 0.86 · TypeScript 6 strict |
| Navegación | Expo Router (file-based) |
| Server state | TanStack Query |
| Estado de sesión/UI | Zustand |
| Estilos | NativeWind (Tailwind) |
| HTTP | Axios con interceptores (Bearer + refresh + 401) |
| Auth | Keycloak 25 · Authorization Code + PKCE S256 · `expo-auth-session` |
| Tokens | access en memoria · refresh en Keychain/Keystore (`expo-secure-store`) |

## Estructura
```
app/                    # rutas (Expo Router)
  (auth)/login.tsx      # login PKCE
  (app)/home.tsx        # menú de módulos por rol
  (app)/profile.tsx     # claims del JWT + logout
  (app)/module/[id].tsx # placeholder por módulo (sprints 9.2–9.5)
src/core/
  config/env.ts         # variables EXPO_PUBLIC_*
  auth/                 # discovery, jwt, tokenManager, store, service
  http/apiClient.ts     # axios hacia el backend NestJS
  query/queryClient.ts  # TanStack Query
  rbac/menu.ts          # rol → módulos visibles
src/components/ui/      # Button, Screen, InfoRow
keycloak/               # Fase 0: provisioning + export del realm
```

## Conectar al ambiente DEV (tailnet)

El backend DEV corre en una VM de OCI publicada solo dentro de la tailnet de Tailscale
(`https://eliza-dev.taile05b63.ts.net`), con HTTPS válido.

1. Instalá **Tailscale** en el teléfono, iniciá sesión con la misma cuenta y dejalo **activo**.
2. Instalá **Expo Go** (SDK 57).
3. En la PC: `copy .env.example .env` (ya trae las URLs de DEV), `npm install`, `npm run start:clear`.
4. Escaneá el QR con Expo Go → **Iniciar sesión** → usuario de Keycloak del realm `eliza`.
5. En **Mi perfil**, la tarjeta *Conexión con el backend* debe mostrar ✅ en "API lista" y "Sesión en la API".

## Quickstart
Ver **TESTING-MOBILE-9.1.md** para el paso a paso completo (Fase 0 de
Keycloak incluida).

```bash
npm install
npx expo install --fix     # alinea versiones nativas con el SDK
copy .env.example .env     # y editá las URLs con tu IP LAN
npm run kc:provision       # Fase 0 (una sola vez por ambiente)
npm run start:clear
```

## Decisiones registradas (Sprint 9.1)
- El realm de Keycloak es **`eliza`** (no `eliza-platform` como dice el
  Doc. de Seguridad). Desviación aceptada y parametrizada
  (`EXPO_PUBLIC_KEYCLOAK_REALM`). Anotar en Documento 14.
- Roles de realm: `tenant-admin`, `jefe-produccion`, `jefe-inventario`,
  `jefe-calidad`, `jefe-ventas`, `operario-planta`, `operario-logistica`,
  `vendedor`. El mapping rol→módulos vive en `src/core/rbac/menu.ts`.
- Claims custom vía client scope `eliza-claims`: `tenant_id`, `plant_id`,
  `warehouse_id`, `roles` (plano). Compartido entre `eliza-mobile` y
  `eliza-api`.
- El escáner de códigos (expo-camera) entra en el Sprint 9.3 (Inventario).
