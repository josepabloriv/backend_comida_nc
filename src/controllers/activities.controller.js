import * as activitiesService from '../services/activities.service.js';
import { success } from '../utils/apiResponse.js';

export async function getActive(req, res, next) {
  try {
    const activity = await activitiesService.getActiveActivity(req.supabase);
    return success(res, { message: 'Actividad activa obtenida.', data: { activity } });
  } catch (err) {
    return next(err);
  }
}
