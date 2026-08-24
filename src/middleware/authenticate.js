import { supabaseAnon, getSupabaseForUser } from '../config/supabase.js';
import { error } from '../utils/apiResponse.js';

/**
 * Middleware de autenticación (obligatorio en toda ruta protegida).
 *
 * 1. Obtiene el Bearer Token del header Authorization.
 * 2. Verifica el token contra Supabase Auth.
 * 3. Obtiene el usuario.
 * 4. Coloca el usuario en req.user y el access token en req.accessToken.
 * 5. Crea un cliente Supabase contextualizado con el JWT del usuario
 *    (req.supabase) para que auth.uid() se resuelva correctamente en las
 *    RPC financieras (registrar_pago, regenerar_qr, validar_qr).
 *
 * Ver GUIA-BACKEND-ACTIVIDAD-CULTURAL.md, secciones 6 y 8.
 */
export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return error(res, {
      message: 'Se requiere un token de autenticación (Authorization: Bearer <token>).',
      status: 401,
    });
  }

  const { data, error: authError } = await supabaseAnon.auth.getUser(token);

  if (authError || !data?.user) {
    return error(res, {
      message: 'Token inválido o expirado.',
      status: 401,
    });
  }

  req.user = data.user;
  req.accessToken = token;
  req.supabase = getSupabaseForUser(token);

  next();
}
