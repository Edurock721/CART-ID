UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
WHERE email = 'REPLACE_WITH_ADMIN_EMAIL'
RETURNING id, email, raw_app_meta_data->>'role' AS role;
