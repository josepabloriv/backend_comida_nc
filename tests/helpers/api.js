/**
 * Wrapper mínimo sobre fetch para hablar con la API bajo prueba.
 * Devuelve { status, json } para que cada test decida qué aserciones hacer.
 */
export async function request(baseUrl, path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const json = await res.json();
  return { status: res.status, json };
}

/**
 * Login de prueba: usa las credenciales del usuario QA definidas en .env
 * (TEST_USER_EMAIL / TEST_USER_PASSWORD). No existen roles en el sistema,
 * así que cualquier usuario autenticado sirve para probar todos los flujos.
 */
export async function loginTestUser(baseUrl) {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'Faltan TEST_USER_EMAIL / TEST_USER_PASSWORD en .env. Son las credenciales del usuario usado por la suite de pruebas.'
    );
  }

  const { status, json } = await request(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });

  if (status !== 200 || !json.success) {
    throw new Error(`No se pudo iniciar sesión para las pruebas: ${json.message}`);
  }

  return json.data.session.access_token;
}
