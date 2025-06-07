import {Request, Response} from "express";
import {db} from "../src/db";
import { wallets , walletTransactions , payments} from "../src/db/schema";
import { eq } from "drizzle-orm";


export const chargeWallet = async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId, amount } = req.body;

        if (!userId || !amount || amount <= 0) {
            res.status(400).json({ error: 'Invalid userId or amount' });
            return;
        }

        const wallet = await db.query.wallets.findFirst({
            where: eq(wallets.userId, userId)
        });

        if (!wallet) {
            res.status(404).json({ error: 'Wallet not found' });
            return;
        }



        await db.transaction(async (tx) => {
            // سجل الدفع في جدول payments
            await tx.insert(payments).values({
                userId,
                amount,
                currency: 'usd',
                status: 'succeeded',
                method: 'test', // لأنو وهمي
                createdAt: new Date()
            });

            // أضف الحركة إلى wallet_transactions
            await tx.insert(walletTransactions).values({
                walletId: wallet.id,
                amount,
                type: 'top_up',
                createdAt: new Date()
            });

            // حدّث رصيد المحفظة
            await tx.update(wallets)
                .set({ balance: wallet.balance + amount, updatedAt: new Date() })
                .where(eq(wallets.id, wallet.id));
        });

        res.status(200).json({
            message: 'Wallet topped up successfully',
            amount,
            userId,
        });

    } catch (error) {
        console.error('Charge wallet error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};