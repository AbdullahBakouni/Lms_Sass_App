import express from 'express';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import './config/passport';
import cors from 'cors';
// @ts-ignore
import authRouter from '../routes/auth.routes';
// @ts-ignore
import userRouter from '../routes/user.routes';
// @ts-ignore
import companionsRouter from '../routes/companion.routes';
// @ts-ignore
import walletRouter from '../routes/wallet.routes';

// @ts-ignore
import subscriptionRouter from '../routes/subscription.routes';

import { startSubscriptionReminderCron } from './corn/subscriptionReminderCron';
import { scheduleOtpCleanup } from './jobs/scheduleOtpCleanup';

import './workers/otpCleanupWorker';

const app = express();

app.use(
  cors({
    origin: 'http://localhost:3000',
    credentials: true,
  }),
);

app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(passport.initialize());
app.use(express.json());

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/companions', companionsRouter);
app.use('/api/v1/wallets', walletRouter);
app.use('/api/v1/subscriptions', subscriptionRouter);
app.use('/uploads', express.static('uploads'));

startSubscriptionReminderCron();
scheduleOtpCleanup();

console.log('✅ OTP cleanup cron job scheduled via BullMQ');

app.get('/', (req, res) => {
  res.send('Welcome to the LMS SASS API!');
});
export default app;
