/**
 * Devuelve la actividad cultural actualmente activa (activities.activa = true).
 * Se usa como referencia para construir el estado de cuenta de un estudiante
 * que todavía no tiene activity_account (ver students.service.js).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase cliente
 *   contextualizado con el JWT del usuario autenticado (req.supabase).
 */
export async function getActiveActivity(supabase) {
  const { data, error } = await supabase.from('activities').select('*').eq('activa', true).maybeSingle();

  if (error) throw error;

  if (!data) {
    const err = new Error('No hay actividad activa configurada.');
    err.status = 404;
    err.publicMessage = 'No hay actividad activa configurada.';
    throw err;
  }

  return data;
}
