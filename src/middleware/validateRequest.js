import { error } from '../utils/apiResponse.js';

/**
 * Envuelve una función validadora de `src/validators/*` en un middleware.
 *
 * La función validadora recibe `req.body` y debe devolver un arreglo de
 * mensajes de error (vacío si el payload es válido).
 *
 * Uso:
 *   router.post('/login', validateRequest(validateLogin), authController.login)
 */
export function validateRequest(validatorFn) {
  return (req, res, next) => {
    const errors = validatorFn(req.body || {});

    if (errors.length > 0) {
      return error(res, {
        message: 'Datos de entrada inválidos.',
        err: errors,
        status: 422,
      });
    }

    next();
  };
}
