import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { db } from "../db";
import {users, subscriptions, userSubscriptions, wallets} from "../db/schema";
import { eq } from "drizzle-orm";
import config from "./config";
import jwt, {Secret, SignOptions} from "jsonwebtoken";
import crypto from "crypto";



passport.use(
    new GoogleStrategy(
        {
            clientID: config.GOOGLE_CLIENT_ID!,
            clientSecret: config.GOOGLE_CLIENT_SECRET!,
            callbackURL: config.GOOGLE_CALLBACK_URL!,
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0].value ?? "";
                const image = profile.photos?.[0].value;
                let user = await db.query.users.findFirst({
                    where: eq(users.email, email),
                });

                if (!user) {
                    // Generate a random password for OAuth users
                    const randomPassword = crypto.randomBytes(32).toString('hex');

                    const newUser = await db.insert(users).values({
                        name: profile.displayName,
                        email,
                        image,
                        password: randomPassword, // Add random password for OAuth users
                        provider: "google",
                    }).returning();
                    user = newUser[0];

                    const freeSubscription = await db.query.subscriptions.findFirst({
                        where: eq(subscriptions.name, 'free'),  // تأكد اسم الاشتراك الافتراضي عندك
                    });

                    if (freeSubscription) {
                        await db.insert(userSubscriptions).values({
                            userId: user.id,
                            subscriptionId: freeSubscription.id,
                            status: 'active',
                            startedAt: new Date(),
                            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // صلاحية سنة، عدلها حسب حاجتك
                            externalId: null,
                        });
                    }
                    await db.insert(wallets).values({
                        userId: user.id,
                        balance: 0,
                    });

                }

                // ✅ أنشئ توكن
                const token = jwt.sign(
                    { id: user.id, email: user.email},
                    config.JWT_SECRET as Secret,
                    {
                        expiresIn: config.JWT_EXPIRES_IN || '1d'
                    } as SignOptions
                );


                return done(null, { ...user, token });
            } catch (err) {
                done(err as any, false);
            }
        }
    )
);
