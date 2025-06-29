import { Queue } from 'bullmq';
import { redis } from '../lib/redis';

export const otpCleanupQueue = new Queue('otp-cleanup', {
  connection: redis,
});
