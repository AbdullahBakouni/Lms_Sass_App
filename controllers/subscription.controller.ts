import { Request, Response } from 'express';
import {db} from "../src/db"; // import Drizzle DB instance
import { eq } from 'drizzle-orm';
import { subscriptionPrices, userSubscriptions, wallets, walletTransactions , payments , subscriptions , users} from '../src/db/schema';
import {redis} from "../src/config/upstash";


export const subscribeToPlan = async (req: Request, res: Response): Promise<void> => {
    try {

        const { subscriptionPriceId , userId } = req.body;
        const [user] = await db.select().from(users).where(eq(users.id, userId));
        if (!subscriptionPriceId) {
            res.status(400).json({ message: 'subscriptionPriceId is required' });
            return;
        }

        // جلب السعر
        const [priceRow] = await db.select({
            priceId: subscriptionPrices.id,
            interval: subscriptionPrices.interval,
            priceCents: subscriptionPrices.priceCents,
            subscriptionId: subscriptionPrices.subscriptionId,
            subscriptionName: subscriptions.name,
            currency: subscriptionPrices.currency
        }).from(subscriptionPrices)
            .innerJoin(subscriptions, eq(subscriptionPrices.subscriptionId, subscriptions.id))
            .where(eq(subscriptionPrices.id, subscriptionPriceId));
        if (!priceRow) {
            res.status(404).json({ message: 'Subscription price not found' });
            return;
        }

        // جلب المحفظة
        const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId));
        if (!wallet) {
            res.status(404).json({ message: 'Wallet not found' });
            return;
        }

        if (wallet.balance < priceRow.priceCents) {
            res.status(400).json({ message: 'Insufficient balance in wallet' });
            return;
        }

        // حساب تواريخ الاشتراك
        const startedAt = new Date();
        const expiresAt = new Date();
        if (priceRow.interval === 'monthly') {
            expiresAt.setMonth(expiresAt.getMonth() + 1);
        } else if (priceRow.interval === 'yearly') {
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        }

        // تنفيذ transaction متكاملة
        await db.transaction(async (tx) => {
            // 1. إنشاء الاشتراك
            await tx.insert(userSubscriptions).values({
                userId,
                subscriptionId: priceRow.subscriptionId,
                status: 'active',
                startedAt,
                expiresAt
            });

            // 2. تحديث رصيد المحفظة
            const newBalance = wallet.balance - priceRow.priceCents;
            await tx.update(wallets)
                .set({ balance: newBalance, updatedAt: new Date() })
                .where(eq(wallets.id, wallet.id));

            // 3. تسجيل في walletTransactions
            await tx.insert(walletTransactions).values({
                walletId: wallet.id,
                amount: -priceRow.priceCents,
                type: 'subscription',
                createdAt: new Date()
            });

            // 4. تسجيل في جدول payments
            await tx.insert(payments).values({
                userId,
                amount: priceRow.priceCents,
                status: 'succeeded',
                method: 'subscription',
                subscriptionId: priceRow.subscriptionId,
                createdAt: new Date()
            });
        });

        // const reminderDate = new Date();
        // reminderDate.setDate(expiresAt.getDate() - 3);
        const reminderDate = new Date(Date.now() + 2 * 60 * 1000); // تذكير بعد دقيقتين

        await redis.zadd("subscription_reminders", {
            score: reminderDate.getTime(),
            member: JSON.stringify({
                type: "subscriptionReminder",
                payload: {
                    userEmail: user.email,
                    userName: user.name,
                    subscription: {
                        planName: priceRow.subscriptionName,
                        price: (priceRow.priceCents / 100).toFixed(2), // تحويل السعر من سنت إلى وحدة العملة
                        currency: priceRow.currency || 'USD', // تأكد من وجود العملة، أو ضع الافتراضي
                        expiresAt: expiresAt.toISOString()
                    }
                },
            }),
        });
        res.status(201).json({ message: 'Subscription successful' });

    } catch (error) {
        console.error('Subscribe to plan error:', error);
        res.status(500).json({ error: 'Something went wrong' });
    }
};
