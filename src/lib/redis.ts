import { Redis } from 'ioredis';

export const redis: Redis = new Redis({
  host: '127.0.0.1',
  port: 6379,
  maxRetriesPerRequest: null,
});
