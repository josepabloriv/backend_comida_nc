import * as studentsService from '../services/students.service.js';
import { success } from '../utils/apiResponse.js';

export async function list(req, res, next) {
  try {
    const { search, grado } = req.query;
    const students = await studentsService.listStudents(req.supabase, { search, grado });
    return success(res, { message: 'Estudiantes obtenidos.', data: { students } });
  } catch (err) {
    return next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const student = await studentsService.getStudentById(req.supabase, req.params.id);
    return success(res, { message: 'Estudiante obtenido.', data: { student } });
  } catch (err) {
    return next(err);
  }
}

export async function getAccount(req, res, next) {
  try {
    const account = await studentsService.getStudentAccount(req.supabase, req.params.id);
    return success(res, { message: 'Estado de cuenta obtenido.', data: { account } });
  } catch (err) {
    return next(err);
  }
}
