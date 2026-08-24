import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from './config/env.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { success } from './utils/apiResponse.js';
import authRoutes from './routes/auth.routes.js';
import activitiesRoutes from './routes/activities.routes.js';
import studentsRoutes from './routes/students.routes.js';
import paymentsRoutes from './routes/payments.routes.js';
import qrRoutes from './routes/qr.routes.js';
import receiptsRoutes from './routes/receipts.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true,
  })
);
app.use(morgan(env.isProduction ? 'combined' : 'dev'));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  success(res, { message: 'API de Actividad Cultural operativa', data: { env: env.nodeEnv } });
});

app.use('/api/auth', authRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/payments', receiptsRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
