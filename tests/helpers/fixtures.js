import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '../../src/config/supabase.js';

/**
 * Crea un estudiante desechable para pruebas (fuera del roster real
 * importado del colegio). Se limpia siempre con deleteTestStudent().
 */
export async function createTestStudent(label = 'generic') {
  const { data, error } = await supabaseAdmin
    .from('students')
    .insert({
      nombre: `QA_TEST_${label}_${randomUUID().slice(0, 8)}`,
      apellidos: 'Automatizado',
      grado: 'QA_TEST',
      activo: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Elimina un estudiante de prueba y todo lo que haya generado
 * (qr_tickets → payments → activity_accounts → students), en ese orden
 * por las FK existentes (no hay ON DELETE CASCADE en el esquema actual).
 */
/**
 * Crea un usuario de Supabase Auth desechable, exclusivo para pruebas que
 * necesitan su PROPIA sesión (ej. logout con scope 'global', que revoca
 * TODAS las sesiones del usuario — no se puede compartir con el usuario
 * fijo TEST_USER_EMAIL sin interferir con otros archivos de prueba que
 * corren en paralelo).
 */
export async function createEphemeralAuthUser() {
  const email = `qa_test_${randomUUID()}@actividadcultural.local`;
  const password = 'QA_Test_123!';

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;

  return { id: data.user.id, email, password };
}

export async function deleteEphemeralAuthUser(userId) {
  await supabaseAdmin.auth.admin.deleteUser(userId);
}

export async function deleteTestStudent(studentId) {
  const { data: accounts } = await supabaseAdmin.from('activity_accounts').select('id').eq('student_id', studentId);
  const accountIds = (accounts || []).map((a) => a.id);

  if (accountIds.length > 0) {
    await supabaseAdmin.from('qr_tickets').delete().in('account_id', accountIds);
    await supabaseAdmin.from('payments').delete().in('account_id', accountIds);
    await supabaseAdmin.from('activity_accounts').delete().in('id', accountIds);
  }

  await supabaseAdmin.from('students').delete().eq('id', studentId);
}
