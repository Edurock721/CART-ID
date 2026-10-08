# UPTBAL WebApp

La aplicación web es estática y puede publicarse en GitHub Pages. La autenticación centralizada y el directorio de cuentas usan Supabase Auth; no hay registro público.

## Configuración de Supabase

1. En **Authentication → Providers → Email**, deja desactivado el registro público.
2. En **Authentication → Users**, crea y confirma la cuenta del administrador inicial.
3. En **SQL Editor**, ejecuta `supabase/bootstrap-admin.sql` después de reemplazar `REPLACE_WITH_ADMIN_EMAIL` por el correo exacto del administrador. Confirma que el resultado muestre una fila con `role = admin`. Luego cierra e inicia sesión otra vez para renovar el token con el nuevo rol.
4. En **Project Settings → API**, copia la Project URL y la clave pública `anon` o `publishable` en `supabase-config.js`. Esa clave está diseñada para el cliente web; nunca pongas `service_role`, contraseñas ni secretos en ese archivo.
5. Despliega la función administrativa desde la raíz `WebApp` con Supabase CLI:

   ```powershell
   supabase login
   supabase link --project-ref xksujgtvcntuhhqauqwi
   supabase functions deploy admin-users
   ```

   La función utiliza los secretos gestionados por Supabase (`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`). La clave privilegiada se queda del lado del servidor; nunca la copies al sitio ni a GitHub.
6. Publica en GitHub Pages `index.html`, `app.js`, `supabase-config.js`, `style.css` y `assets/`.

El panel usa la función `admin-users`, que valida el JWT y exige `app_metadata.role = admin` antes de listar, crear, bloquear, restablecer contraseñas o eliminar cuentas. Las cuentas administradoras no se pueden bloquear ni eliminar desde este panel. Las contraseñas nuevas deben tener al menos 10 caracteres.

Las cuentas y contraseñas guardadas antes en cada dispositivo no se importan automáticamente. Crea de nuevo las cuentas desde el panel después de configurar Supabase. Los datos de carnet que el usuario mantenga en el navegador siguen siendo locales.

## Aplicación Android

La APK carga la versión publicada en <https://edurock721.github.io/CART-ID/> cada vez que se abre y no reutiliza la caché web. Después de subir cambios a la fuente configurada de GitHub Pages y completar su publicación, estarán disponibles la próxima vez que se abra la APK, sin reinstalarla. Una sesión que ya está abierta no se recarga automáticamente. Se requiere conexión a Internet; si no se puede cargar el sitio, se muestra la versión incluida en la APK.

La APK solo permite navegar dentro de ese sitio HTTPS. Los cambios del código nativo de Android todavía requieren compilar e instalar una nueva APK. La versión nativa con esta integración es la 1.1 (código 2).
