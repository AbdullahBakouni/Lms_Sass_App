import {Request, Response} from "express";
import {db} from "../src/db";
import {subscriptionPrices, userSubscriptions , payments} from "../src/db/schema";
import {eq, and} from "drizzle-orm";
import {stripe} from "../src/config/stripe";
import Stripe from 'stripe';
import config from "../src/config/config";
export const stripePaymentsController = async (req: Request, res: Response): Promise<void> =>{

    try {
        const { userId, subscriptionId, interval } = req.body;

        // جلب السعر من قاعدة البيانات
        const priceRecord = await db.query.subscriptionPrices.findFirst({
            where: and(
                eq(subscriptionPrices.subscriptionId, subscriptionId),
                eq(subscriptionPrices.interval, interval),
                eq(subscriptionPrices.isActive, true)
            )
        });

        if (!priceRecord) {
            res.status(400).json({ error: 'Price not found' });
            return;
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            line_items: [
                {
                    price_data: {
                        currency: priceRecord.currency,
                        unit_amount: priceRecord.priceCents,
                        product_data: {
                            name: `Subscription - ${interval}`,
                        },
                    },
                    quantity: 1,
                },
            ],
            metadata: {
                userId,
                subscriptionId,
                interval,
            },
            success_url: `http://localhost:3000/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `http://localhost:3000/cancel`,
        });

        res.json({ url: session.url });
    }catch (err) {
        console.error('Payments not Completed', err);
        res.status(500).json({ error: 'Something went wrong' });
    }
};


export const handleStripeWebhook = async (req: Request, res: Response): Promise<void> =>{
    const sig = req.headers['stripe-signature'];
    const endpointSecret = config.STRIPE_WEBHOOK_SECRET_KEY!;
    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig!, endpointSecret);
    } catch (err) {
        console.error('⚠️  Webhook signature verification failed.', err);
       res.status(400).send(`Webhook Error: ${err}`);
       return;
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata;
        if (!metadata) {
            res.status(400).send('No metadata');
            return;
        }

        const userId = metadata.userId;
        const subscriptionId = metadata.subscriptionId;
        const interval = metadata.interval;
        const paymentId = session.payment_intent as string;

        // 🧾 1. تخزين الدفع
        await db.insert(payments).values({
            userId,
            amount: session.amount_total || 0,
            currency: session.currency || 'usd',
            status: 'succeeded',
            method: 'stripe',
            subscriptionId,
        });

        // 📆 2. حساب تاريخ الانتهاء
        const now = new Date();
        const expiresAt = new Date(now);
        interval === 'monthly'
            ? expiresAt.setMonth(expiresAt.getMonth() + 1)
            : expiresAt.setFullYear(expiresAt.getFullYear() + 1);

        // 👤 3. تحديث اشتراك المستخدم
        await db.insert(userSubscriptions).values({
            userId,
            subscriptionId,
            status: 'active',
            startedAt: now,
            expiresAt,
            externalId: paymentId,
        });
    }

    res.status(200).send('Event received');
};