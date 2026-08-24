import * as authService from '../services/auth.service.js';
import { success } from '../utils/apiResponse.js';

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    return success(res, { message: 'Sesión iniciada correctamente.', data: result });
  } catch (err) {
    return next(err);
  }
}

export async function me(req, res, next) {
  try {
    const user = authService.getCurrentUser(req.user);
    return success(res, { message: 'Usuario autenticado.', data: { user } });
  } catch (err) {
    return next(err);
  }
}

export async function logout(req, res, next) {
  try {
    await authService.logout(req.accessToken);
    return success(res, { message: 'Sesión cerrada correctamente.', data: {} });
  } catch (err) {
    return next(err);
  }
}
