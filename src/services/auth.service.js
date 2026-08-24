import { supabaseAnon, supabaseAdmin } from '../config/supabase.js';

/**
 * Inicia sesión contra Supabase Auth. No existe tabla propia de usuarios ni
 * de contraseñas: las credenciales las administra Supabase Auth por completo.
 * Ver GUIA-BACKEND-ACTIVIDAD-CULTURAL.md, secciones 5 y 6.
 */
export async function login(email, password) {
  const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });

  if (error) {
    const err = new Error(error.message);
    err.status = 401;
    err.publicMessage = 'Credenciales inválidas.';
    throw err;
  }

  return {
    user: formatUser(data.user),
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    },
  };
}

/**
 * Devuelve la información del usuario autenticado actual.
 * req.user ya fue resuelto y verificado por el middleware `authenticate`.
 */
export function getCurrentUser(user) {
  return formatUser(user);
}

/**
 * Revoca la sesión asociada al access token (logout server-side).
 * Como no se persiste sesión en el backend (cliente stateless), el frontend
 * es responsable de descartar el token localmente; aquí además se intenta
 * revocar la sesión en Supabase Auth para invalidarla del lado del servidor.
 */
export async function logout(accessToken) {
  try {
    await supabaseAdmin.auth.admin.signOut(accessToken, 'global');
  } catch (err) {
    // No es crítico: si la revocación server-side falla, el token expirará
    // por su cuenta y el frontend ya descartó su copia local.
    // eslint-disable-next-line no-console
    console.warn('[auth.service] No se pudo revocar la sesión en Supabase Auth:', err.message);
  }
}

function formatUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    created_at: user.created_at,
  };
}
