import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import exportRoutes from './routes/export';
import paymentRoutes from './routes/payment';
import teacherRoutes from './routes/teacher';
import attendanceRoutes from './routes/attendance';
import kioskRoutes from './routes/kiosk';
import parentRoutes from './routes/parent';
import academyRoutes from './routes/academy';
import authRoutes from './routes/auth';

import { scheduleAwayTimeout } from './cron/awayTimeout';
import { scheduleAutoCheckout } from './cron/autoCheckout';
import { scheduleWeeklyReport } from './cron/weeklyReport';

const app = express();
const PORT = process.env.PORT ?? 5000;

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? '*',
  })
);
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/export', exportRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/kiosk', kioskRoutes);
app.use('/api/parent', parentRoutes);
app.use('/api/academy', academyRoutes);
app.use('/api/auth', authRoutes);

// Cron 작업 등록 (무료 티어 Cold Start 대응은 별도 외부 핑 서비스 권장)
scheduleAwayTimeout();
scheduleAutoCheckout();
scheduleWeeklyReport();

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[SafeStep] backend listening on port ${PORT}`);
});
