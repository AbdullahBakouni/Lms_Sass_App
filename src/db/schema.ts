import { pgTable, varchar , uuid , text , pgEnum,integer , primaryKey , timestamp , boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm/sql";


export const voiceEnum = pgEnum('voice', ['male', 'female']);
export const styleEnum = pgEnum('style', ['formal', 'casual']);
export const subjectEnum = pgEnum('subject', [
    'mental_health',
    'relationships',
    'career_advice',
    'study_assistant',
    'productivity',
    'language_learning',
    'fitness',
    'nutrition',
    'parenting',
    'spirituality',
    'self_improvement',
    'business_coach',
    'finance',
    'coding_help',
    'emotional_support',
    'addiction_support',
    'philosophy',
    'creative_writing',
    'therapy_simulator',
    'daily_motivation',
    'travel_tips',
    'legal_advice',
    'ai_discussions',
    'custom_topic'
]);
export const featureTypeEnum = pgEnum('feature_type', ['boolean', 'number','string']);


export const users = pgTable("users", {
    id: uuid("id").primaryKey().default(sql`uuid_generate_v4()`),
    name: varchar({ length: 255 }).notNull(),
    image: varchar({length: 255}),
    email: varchar({ length: 255 }).notNull().unique(),
    password: varchar({ length: 255 }).notNull(),
    provider: text().default("credentials"),
});
// SUBSCRIPTION PLANS
export const subscriptions = pgTable('subscriptions', {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    name: text('name').unique().notNull(), // Free, Pro, Premium
    description: text('description'),
});
// FEATURES
export const features = pgTable('features', {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    name: text('name').unique().notNull(), // e.g., max_companions
    type: featureTypeEnum('type').notNull(),
    description: text('description'),
});

// SUBSCRIPTION_FEATURES
export const subscriptionFeatures = pgTable('subscription_features', {
    subscriptionId: uuid('subscription_id').references(() => subscriptions.id).notNull(),
    featureId: uuid('feature_id').references(() => features.id).notNull(),
    value: text('value').notNull(), // e.g., "true", "10", "-1" for unlimited
}, (table) => ({
    pk: primaryKey({ columns: [table.subscriptionId, table.featureId] }),
}));

// USER_SUBSCRIPTIONS
export const userSubscriptions = pgTable('user_subscriptions', {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),

    userId: uuid('user_id').references(() => users.id).notNull(),
    subscriptionId: uuid('subscription_id').references(() => subscriptions.id).notNull(),

    status: text('status', { enum: ['active', 'canceled', 'expired'] }).notNull(),
    startedAt: timestamp('started_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull(),


    externalId: text('external_id'), // e.g., Stripe subscription ID
});


// COMPANIONS
export const companions = pgTable('companions', {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    userId: uuid('user_id').references(() => users.id).notNull(),
    name: text('name').notNull(),
    subject: subjectEnum('subject').notNull(),
    helpWith: text('help_with').notNull(),
    voice: voiceEnum('voice').notNull(),
    style: styleEnum('style'),
    durationMinutes: integer('duration_minutes').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
});

export const payments = pgTable('payments', {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),

    userId: uuid('user_id').references(() => users.id).notNull(),
    amount: integer('amount').notNull(), // بالسنتات مثلاً (2000 = 20.00$)
    currency: text('currency').default('usd').notNull(),

    status: text('status', { enum: ['pending', 'succeeded', 'failed'] }).notNull(),
    method: text('method'), // stripe, test, etc

    createdAt: timestamp('created_at').defaultNow().notNull(),
    subscriptionId: uuid('subscription_id').references(() => subscriptions.id),
});

export const subscriptionPrices = pgTable('subscription_prices', {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),

    subscriptionId: uuid('subscription_id').references(() => subscriptions.id).notNull(),
    priceCents: integer('price_cents').notNull(), // السعر الشهري أو السنوي
    currency: text('currency').default('usd').notNull(),

    stripePriceId: text('stripe_price_id'), // تستخدم لاحقًا إذا ربطت Stripe

    interval: text('interval', { enum: ['monthly', 'yearly'] }).notNull(), // نوع الاشتراك
    isActive: boolean('is_active').default(true).notNull(),
});

export const wallets = pgTable('wallets', {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    userId: uuid('user_id').notNull().unique().references(() => users.id),
    balance: integer('balance').notNull().default(0),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const walletTransactions = pgTable('wallet_transactions', {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    walletId: uuid('wallet_id').references(() => wallets.id).notNull(),
    amount: integer('amount').notNull(),
    type: text('type', { enum: ['top_up', 'subscription'] }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

