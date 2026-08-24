import * as dashboardService from '../services/dashboard.service.js';
import { success } from '../utils/apiResponse.js';

export async function getTotals(req, res, next) {
  try {
    const { actividad } = req.query;
    const totals = await dashboardService.getDashboardTotals(req.supabase, { actividad });
    return success(res, { message: 'Totales del dashboard obtenidos.', data: { totals } });
  } catch (err) {
    return next(err);
  }
}

export async function getDaily(req, res, next) {
  try {
    const { actividad, fecha_inicio: fechaInicio, fecha_fin: fechaFin } = req.query;
    const daily = await dashboardService.getDailyIncome(req.supabase, { actividad, fechaInicio, fechaFin });
    return success(res, { message: 'Ingresos diarios obtenidos.', data: { daily } });
  } catch (err) {
    return next(err);
  }
}

export async function getByGrade(req, res, next) {
  try {
    const { actividad, grado } = req.query;
    const byGrade = await dashboardService.getIncomeByGrade(req.supabase, { actividad, grado });
    return success(res, { message: 'Ingresos por grado obtenidos.', data: { byGrade } });
  } catch (err) {
    return next(err);
  }
}
