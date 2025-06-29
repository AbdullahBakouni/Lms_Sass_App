import { otpCleanupQueue } from '../queues/otpCleanupQueue';

export async function scheduleOtpCleanup() {
  await otpCleanupQueue.add(
    'cleanup-task',
    {}, // no payload needed
    {
      repeat: { every: 60 * 1000 },
      removeOnComplete: true,
    },
  );
}
