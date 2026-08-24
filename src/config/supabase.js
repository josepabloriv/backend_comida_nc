import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

/**
 * Cliente administrativo (service_role).
 * Uso interno y controlado únicamente. NUNCA exponer al frontend ni usarlo
 * para ejecutar las RPC financieras (registrar_pago, regenerar_qr, validar_qr),
 * ya que esas operaciones dependen de auth.uid() del usuario autenticado.
 * Ver GUIA-BACKEND-ACTIVIDAD-CULTURAL.md, sección 8.
 */
export const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Cliente "anónimo" base, útil para operaciones como el login
 * (signInWithPassword) donde todavía no existe un JWT de usuario.
 */
export const supabaseAnon = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Crea un cliente Supabase contextualizado con el JWT del usuario autenticado.
 * Este es el cliente que debe usarse para invocar RPC financieras
 * (registrar_pago, regenerar_qr, validar_qr), de forma que auth.uid()
 * se resuelva correctamente dentro de PostgreSQL.
 *
 * Se completa e integra en el middleware `authenticate` (Fase 2).
 *
 * @param {string} accessToken - JWT del usuario (Bearer token)
 */
export function getSupabaseForUser(accessToken) {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
