import app from './app.js';
import { env } from './config/env.js';

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] Escuchando en http://localhost:${env.port} (${env.nodeEnv})`);
});
