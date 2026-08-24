import app from '../../src/app.js';

/**
 * Levanta la app Express en un puerto efímero (0 = asignado por el SO),
 * para que la suite de pruebas pueda correr en paralelo sin chocar con el
 * puerto de desarrollo (3000).
 */
export function startTestServer() {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({
        server,
        baseUrl: `http://localhost:${port}`,
        close: () => new Promise((res) => server.close(res)),
      });
    });
    server.on('error', reject);
  });
}
