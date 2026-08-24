import { getActiveActivity } from './activities.service.js';

/**
 * Resuelve el activity_id a usar: el indicado explícitamente por
 * ?actividad=, o la actividad activa por defecto.
 */
async function resolveActivityId(supabase, actividadParam) {
  if (actividadParam) return actividadParam;
  const activity = await getActiveActivity(supabase);
  return activity.id;
}

/**
 * Totales generales de la actividad (v_dashboard_actividad). No se
 * recalcula nada en Node.js: PostgreSQL ya entrega los agregados.
 * Ver GUIA-BACKEND-ACTIVIDAD-CULTURAL.md, sección 29.
 */
export async function getDashboardTotals(supabase, { actividad } = {}) {
  const activityId = await resolveActivityId(supabase, actividad);

  const { data, error } = await supabase
    .from('v_dashboard_actividad')
    .select('*')
    .eq('activity_id', activityId)
    .maybeSingle();

  if (error) throw error;

  // Actividad activa sin transacciones todavía: la vista puede no traer
  // fila. Se devuelve un resumen en cero en vez de un 404, ya que la
  // actividad sí existe.
  return (
    data || {
      activity_id: activityId,
      actividad: null,
      estudiantes_con_cuenta: 0,
      cuotas_completas: 0,
      cuotas_pendientes: 0,
      ingresos_cuotas: 0,
      saldo_total_pendiente: 0,
      ingresos_platos_extra: 0,
      ingresos_totales: 0,
      platos_extra_vendidos: 0,
      platos_base_habilitados: 0,
      total_platos_habilitados: 0,
      cantidad_transacciones: 0,
    }
  );
}

/**
 * Ingresos diarios (v_ingresos_diarios), con filtro opcional de rango de
 * fechas.
 */
export async function getDailyIncome(supabase, { actividad, fechaInicio, fechaFin } = {}) {
  const activityId = await resolveActivityId(supabase, actividad);

  let query = supabase.from('v_ingresos_diarios').select('*').eq('activity_id', activityId).order('fecha', { ascending: true });

  if (fechaInicio) query = query.gte('fecha', fechaInicio);
  if (fechaFin) query = query.lte('fecha', fechaFin);

  const { data, error } = await query;
  if (error) throw error;

  return data;
}

/**
 * Ingresos por grado (v_ingresos_por_grado), con filtro opcional a un
 * grado específico.
 */
export async function getIncomeByGrade(supabase, { actividad, grado } = {}) {
  const activityId = await resolveActivityId(supabase, actividad);

  let query = supabase.from('v_ingresos_por_grado').select('*').eq('activity_id', activityId).order('grado', { ascending: true });

  if (grado) query = query.eq('grado', grado);

  const { data, error } = await query;
  if (error) throw error;

  return data;
}
