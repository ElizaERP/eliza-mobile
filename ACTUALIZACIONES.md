# Actualizaciones por aire (EAS Update)

Los cambios de **JavaScript** (pantallas, textos, validaciones, lógica) llegan
a los teléfonos **sin reinstalar el APK**: la app busca la versión nueva al
abrirse y al volver a ella (como mucho cada 15 min), la descarga y pregunta
"Reiniciar". Si dicen "Más tarde", se aplica sola la próxima vez que se abra.
En **Mi perfil → Versión** se ve qué actualización tiene cada teléfono y hay
un botón "Buscar actualización".

## Publicar una actualización

Después de hacer merge a `main`:

```powershell
git checkout main
git pull --ff-only
npm run actualizar -- "Qué cambió, en una línea"
```

El script toma la URL de la API del perfil `preview` de `eas.json` (la misma
que usa el APK), no del `.env` local, y publica solo para Android (la app no
tiene versión web). Canal de producción (cuando exista la
build de Play Store): `npm run actualizar -- "Qué cambió" production`.

## Cuándo SÍ hay que construir un APK nuevo

Una actualización por aire solo puede cambiar JavaScript e imágenes. Hace
falta APK nuevo cuando el cambio:

- agrega o actualiza una librería **nativa** (`npx expo install …` de un
  módulo `expo-*` o `react-native-*` con código nativo);
- cambia `app.config.ts` en algo nativo (ícono, splash, permisos, nombre,
  paquete, plugins);
- sube la versión de Expo SDK.

En ese caso: subir `version` en `app.config.ts` (ej. 0.12.0 → 0.13.0),
`npx eas-cli build -p android --profile preview` e instalar el APK nuevo.

## Por qué la versión importa

`runtimeVersion` = `version` de `app.config.ts`. Una actualización publicada
con la versión 0.12.0 solo llega a los APK 0.12.0. Así nunca llega a un APK
JavaScript que necesita una librería nativa que ese APK no tiene (eso cerraría
la app). Para cambios solo de JavaScript **no** se sube la versión.

## Si una actualización sale mal

Publicar otra con el arreglo, o volver a la anterior:

```powershell
npx eas-cli update:list --branch preview
npx eas-cli update:republish --group <id-del-grupo-bueno>
```
