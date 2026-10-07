import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import exportRoutes from './routes/export';
import paymentRoutes from './routes/payment';
import teacherRoutes from './routes/teacher';
import attendanceRoutes from './routes/attendance';
import kioskRoutes from './routes/kiosk';
import parentRoutes from './routes/parent';
import academyRoutes from './routes/academy';
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import ownerRoutes from './routes/owner';
import chatRoutes from './routes/chat';
import studentPassRoutes from './routes/studentPass';
import studentLinkRoutes from './routes/studentLink';
import inquiryRoutes from './routes/inquiry';

import { scheduleAwayTimeout } from './cron/awayTimeout';
import { scheduleAutoCheckout } from './cron/autoCheckout';
import { scheduleWeeklyReport } from './cron/weeklyReport';
import { scheduleLateDetection } from './cron/lateDetection';
import { scheduleExpirePasses } from './cron/expirePasses';

const app = express();
const PORT = process.env.PORT ?? 5000;

// Render 등 리버스 프록시 뒤에서 실제 클라이언트 IP로 레이트 리밋이 동작하도록
app.set('trust proxy', 1);
app.use(helmet());

// CORS_ORIGIN(쉼표로 여러 개 가능)과 FRONTEND_URL만 허용. 와일드카드는 쓰지 않습니다.
const allowedOrigins = [process.env.CORS_ORIGIN, process.env.FRONTEND_URL].filter(Boolean).join(',')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
  })
);
app.use(express.json({ limit: '100kb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/export', exportRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/kiosk', kioskRoutes);
app.use('/api/parent', parentRoutes);
app.use('/api/academy', academyRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/student-passes', studentPassRoutes);
app.use('/api/student-link', studentLinkRoutes);
app.use('/api/inquiries', inquiryRoutes);

// Cron 작업 등록 (무료 티어 Cold Start 대응은 별도 외부 핑 서비스 권장)
scheduleAwayTimeout();
scheduleAutoCheckout();
scheduleWeeklyReport();
scheduleLateDetection();
scheduleExpirePasses();

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[SafeStep] backend listening on port ${PORT}`);
});
