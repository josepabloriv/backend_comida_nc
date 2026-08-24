import { getActiveActivity } from './activities.service.js';

const STUDENT_COLUMNS = 'id, nombre, apellidos, grado, activo';

/**
 * Lista estudiantes con búsqueda opcional por nombre, apellidos o grado, y
 * filtro exacto opcional por grado. Solo devuelve estudiantes activos
 * (students.activo = true), reflejando el import vigente de la BD central.
 *
 * Ver GUIA-BACKEND-ACTIVIDAD-CULTURAL.md, secciones 7 y 20.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{search?: string, grado?: string}} filters
 */
export async function listStudents(supabase, { search, grado } = {}) {
  let query = supabase
    .from('students')
    .select(STUDENT_COLUMNS)
    .eq('activo', true)
    .order('grado', { ascending: true })
    .order('apellidos', { ascending: true })
    .order('nombre', { ascending: true });

  if (grado) {
    query = query.eq('grado', grado);
  }

  if (search) {
    const term = search.trim();
    query = query.or(`nombre.ilike.%${term}%,apellidos.ilike.%${term}%,grado.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return data;
}

/**
 * Obtiene un estudiante por su student_id (UUID interno).
 */
export async function getStudentById(supabase, studentId) {
  const { data, error } = await supabase
    .from('students')
    .select(STUDENT_COLUMNS)
    .eq('id', studentId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const err = new Error('Estudiante no encontrado.');
    err.status = 404;
    err.publicMessage = 'Estudiante no encontrado.';
    throw err;
  }

  return data;
}

/**
 * Obtiene el estado de cuenta del estudiante en la actividad activa,
 * usando v_estado_cuentas. Si el estudiante todavía no tiene
 * activity_account (no ha realizado ningún pago), se construye una
 * representación por defecto a partir de los valores de la actividad:
 * cuota pendiente en su totalidad, 0 platos habilitados.
 *
 * Ver GUIA-BACKEND-ACTIVIDAD-CULTURAL.md, secciones 9 y 11.
 */
export async function getStudentAccount(supabase, studentId) {
  const student = await getStudentById(supabase, studentId);
  const activity = await getActiveActivity(supabase);

  const { data, error } = await supabase
    .from('v_estado_cuentas')
    .select('*')
    .eq('student_id', studentId)
    .eq('activity_id', activity.id)
    .maybeSingle();

  if (error) throw error;

  if (data) {
    return data;
  }

  return {
    account_id: null,
    activity_id: activity.id,
    actividad: activity.nombre,
    student_id: student.id,
    nombre: student.nombre,
    apellidos: student.apellidos,
    estudiante: `${student.nombre} ${student.apellidos}`,
    grado: student.grado,
    cuota_base: activity.cuota_base,
    cuota_pagada: 0,
    saldo_cuota: activity.cuota_base,
    cuota_completa: false,
    estado_cuota: 'PENDIENTE',
    platos_incluidos: activity.platos_incluidos,
    platos_extra: 0,
    total_platos: 0,
    ingresos_extras: 0,
    total_pagado: 0,
    cantidad_pagos: 0,
  };
}
