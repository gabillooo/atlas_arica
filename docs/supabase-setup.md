# Supabase setup

## Variables Vite

Crea un archivo `.env.local` con:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
VITE_SUPABASE_PHOTO_BUCKET=event-photos
```

## Primer administrador

1. Crea el usuario desde Supabase Auth.
2. Ejecuta el SQL de `docs/supabase-schema.sql`.
3. Promueve la primera cuenta desde SQL Editor:

```sql
update public.profiles
set role = 'admin'
where email = 'correo-del-admin@dominio.cl';
```

Las contraseñas quedan completamente administradas por Supabase Auth. La app solo consulta la sesión y el rol guardado en `profiles`.
