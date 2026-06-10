# UPTBAL WebApp — Autenticación local (demo)

Instrucciones para ejecutar el servidor y cliente localmente:

1) Iniciar el backend (Node/Express + SQLite):

```powershell
cd server
npm install
cp .env.example .env
# editar .env si quieres cambiar secretos
npm start
```

2) Servir el cliente (puedes usar Python):

```powershell
cd ..
python -m http.server 8000
```

3) Abrir en el navegador: http://localhost:8000

Credenciales iniciales:
- admin / (valor de `INIT_ADMIN_PW` en `.env`, por defecto `admin`).

Qué se implementó ahora:
- Backend con SQLite y rutas para `register` y `login`.
- Hashing de contraseñas con `bcryptjs`.
- JWT para autenticación; el front almacena el token en `localStorage`.
- Rutas admin protegidas para listar/crear/bloquear/eliminar usuarios desde el panel gráfico.
 - Refresh tokens: el servidor emite `refreshToken` (rotado) para renovar access tokens automáticamente.
 - Endpoint admin para cambiar la contraseña de cualquier usuario (`POST /api/admin/users/:username/password`).
 - Ahora los `refreshToken` se guardan como cookie `HttpOnly` (más seguro). Si sirves el cliente desde otro origen, ajusta `CLIENT_ORIGIN` en el `.env` o en el entorno del servidor (por defecto `http://localhost:8000`).

Limitaciones y próximos pasos recomendados:
- En producción, ejecutar detrás de HTTPS, configurar CORS y variables de entorno seguras.
- Implementar endpoints para cambiar contraseña admin sin reiniciar.
- Añadir logging/auditoría, pruebas unitarias y CI.
