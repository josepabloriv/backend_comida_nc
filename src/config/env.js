import 'dotenv/config';

/**
 * Punto único de acceso a las variables de entorno.
 * No leer process.env directamente en otros archivos: importar `env` desde aquí.
 */

const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];

for (const key of required) {
  if (!process.env[key]) {
    // eslint-disable-next-line no-console
    console.warn(`[env] Falta la variable de entorno "${key}". Revisa tu archivo .env.`);
  }
}

export const env = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',

  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,

  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
};
