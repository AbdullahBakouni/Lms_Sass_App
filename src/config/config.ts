import dotenv from 'dotenv';
import path from 'path';

// تحميل الملف الصحيح حسب البيئة
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

interface Config {
    port: number;
    nodeEnv: string;
    JWT_SECRET: string;
    JWT_EXPIRES_IN: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    GOOGLE_CALLBACK_URL: string;
}

const config: Config = {
    port: Number(process.env.PORT) || 5500,
    nodeEnv: process.env.NODE_ENV || 'development',
    JWT_SECRET: process.env.JWT_SECRET || '',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1d',
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
    GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL || ''
};

export default config;