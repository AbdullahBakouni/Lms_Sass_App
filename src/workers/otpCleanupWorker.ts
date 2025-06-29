import { Worker } from 'bullmq';
import { redis } from '../lib/redis';
import { db } from '../db';
import { accountOtps } from '../db/schema';
import { lt } from 'drizzle-orm';

export const otpCleanupWorker = new Worker(
  'otp-cleanup',
  async () => {
    const now = new Date();
    await db.delete(accountOtps).where(lt(accountOtps.expires_at, now));
    console.log(`[OTP Cleanup] ✅: ${now.toISOString()}`);
  },
  {
    connection: redis,
  },
);
