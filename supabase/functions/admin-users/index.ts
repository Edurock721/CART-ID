import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Método no permitido.' }, 405);
  }

  const authorization = request.headers.get('Authorization');
  const token = authorization?.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : null;
  if (!token) {
    return jsonResponse({ error: 'Se requiere iniciar sesión.' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('Supabase function secrets are not configured.');
    return jsonResponse({ error: 'La función administrativa no está configurada.' }, 500);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user) {
    return jsonResponse({ error: 'La sesión no es válida. Inicia sesión nuevamente.' }, 401);
  }
  if (user.app_metadata?.role !== 'admin') {
    return jsonResponse({ error: 'No tienes permisos de administrador.' }, 403);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = await request.json();
    const action = body?.action;

    if (action === 'list') {
      const users = [];
      for (let page = 1; ; page += 1) {
        const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 100 });
        if (error) throw error;
        users.push(...data.users);
        if (data.users.length < 100) break;
      }

      return jsonResponse({
        users: users.map((listedUser) => ({
          id: listedUser.id,
          email: listedUser.email,
          role: listedUser.app_metadata?.role === 'admin' ? 'admin' : 'user',
          blocked: Boolean(listedUser.banned_until && new Date(listedUser.banned_until) > new Date()),
        })),
      });
    }

    if (action === 'create') {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      const separator = email.indexOf('@');
      if (separator < 1
          || separator !== email.lastIndexOf('@')
          || email.includes(' ')
          || email.lastIndexOf('.') <= separator + 1
          || email.endsWith('.')) {
        return jsonResponse({ error: 'Ingresa un correo válido.' }, 400);
      }
      if (password.length < 10) {
        return jsonResponse({ error: 'La contraseña inicial debe tener al menos 10 caracteres.' }, 400);
      }

      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { role: 'user' },
      });
      if (error) {
        return jsonResponse({ error: error.message }, 400);
      }
      return jsonResponse({ user: { id: data.user.id, email: data.user.email, role: 'user', blocked: false } }, 201);
    }

    if (action === 'update-password' || action === 'set-blocked' || action === 'delete') {
      const userId = typeof body.userId === 'string' ? body.userId : '';
      if (!userId) {
        return jsonResponse({ error: 'Falta el identificador del usuario.' }, 400);
      }
      if (action === 'delete' && userId === user.id) {
        return jsonResponse({ error: 'No puedes eliminar tu propia cuenta.' }, 400);
      }

      const { data: targetResult, error: targetError } = await adminClient.auth.admin.getUserById(userId);
      if (targetError || !targetResult.user) {
        return jsonResponse({ error: 'No se encontró la cuenta indicada.' }, 404);
      }
      const target = targetResult.user;
      const isAdmin = target.app_metadata?.role === 'admin';
      if (isAdmin && (action === 'set-blocked' || action === 'delete')) {
        return jsonResponse({ error: 'No se puede bloquear ni eliminar una cuenta administradora.' }, 400);
      }

      if (action === 'update-password') {
        const password = typeof body.password === 'string' ? body.password : '';
        if (password.length < 10) {
          return jsonResponse({ error: 'La contraseña debe tener al menos 10 caracteres.' }, 400);
        }
        const { error } = await adminClient.auth.admin.updateUserById(userId, { password });
        if (error) throw error;
        return jsonResponse({ success: true });
      }

      if (action === 'set-blocked') {
        if (typeof body.blocked !== 'boolean') {
          return jsonResponse({ error: 'El estado de bloqueo no es válido.' }, 400);
        }
        const { error } = await adminClient.auth.admin.updateUserById(userId, {
          ban_duration: body.blocked ? '876000h' : 'none',
        });
        if (error) throw error;
        return jsonResponse({ success: true });
      }

      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) throw error;
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: 'La acción solicitada no es válida.' }, 400);
  } catch (error) {
    console.error('Admin user operation failed:', error);
    return jsonResponse({ error: 'No se pudo completar la operación administrativa.' }, 500);
  }
});
