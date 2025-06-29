import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { db } from '../db';
import {
  users,
  subscriptions,
  userSubscriptions,
  wallets,
  accounts,
} from '../db/schema';
import { eq, and } from 'drizzle-orm';
import config from './config';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';

passport.use(
  new GoogleStrategy(
    {
      clientID: config.GOOGLE_CLIENT_ID!,
      clientSecret: config.GOOGLE_CLIENT_SECRET!,
      callbackURL: config.GOOGLE_CALLBACK_URL!,
      passReqToCallback: true,
    },

    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value ?? '';
        const image = profile.photos?.[0]?.value ?? null;
        const name = profile.displayName;

        if (!email) {
          return done(new Error('Email not found in Google profile'), false);
        }

        let user;
        let isNewUser = false;

        // ✅ 1. تحقق من وجود توكن داخل الكوكي واستخرج المستخدم منه
        const incomingToken = req.cookies?.token || null;

        if (incomingToken) {
          try {
            const decoded = jwt.verify(
              incomingToken,
              config.JWT_SECRET as Secret,
            ) as { id: string };

            const existingUser = await db.query.users.findFirst({
              where: eq(users.id, decoded.id),
            });

            if (existingUser) {
              user = existingUser;

              // 🔍 هل لدى هذا المستخدم أي حساب بنفس الإيميل؟
              const hasAnyAccountWithSameEmail =
                await db.query.accounts.findFirst({
                  where: and(
                    eq(accounts.userId, user.id),
                    eq(accounts.email, email),
                  ),
                });

              if (!hasAnyAccountWithSameEmail) {
                // ✅ لم يتم ربط هذا الإيميل بهذا المستخدم → أنشئ حساب Google
                await db.insert(accounts).values({
                  userId: user.id,
                  email,
                  password: '',
                  image,
                  provider: 'google',
                });
              }

              return done(null, { ...user, email, token: incomingToken });
            }
          } catch (err) {
            console.warn('Invalid or expired token in cookie');
          }
        }

        // ✅ 2. ابحث عن حساب Google
        let existingAccount = await db.query.accounts.findFirst({
          where: and(
            eq(accounts.email, email),
            eq(accounts.provider, 'google'),
          ),
        });

        // ✅ 3. إذا لم يوجد حساب Google، ابحث عن حساب يدوي (credentials)
        if (!existingAccount) {
          const manualAccount = await db.query.accounts.findFirst({
            where: and(
              eq(accounts.email, email),
              eq(accounts.provider, 'credentials'),
            ),
          });

          if (manualAccount) {
            // ربط حساب Google بنفس userId
            await db.insert(accounts).values({
              userId: manualAccount.userId,
              email,
              password: '',
              image,
              provider: 'google',
            });

            existingAccount = manualAccount;
          }
        }

        // ✅ 4. إذا وجدنا حساب، استرجع المستخدم
        if (existingAccount) {
          user = await db.query.users.findFirst({
            where: eq(users.id, existingAccount.userId),
          });

          if (!user) {
            return done(
              new Error('User not found for existing account'),
              false,
            );
          }
        } else {
          // ✅ 5. لم نجد أي حساب → أنشئ مستخدم جديد
          const [createdUser] = await db
            .insert(users)
            .values({ name, image })
            .returning();

          if (!createdUser) {
            return done(new Error('Failed to create new user'), false);
          }

          user = createdUser;
          isNewUser = true;

          await db.insert(accounts).values({
            userId: user.id,
            email,
            password: '',
            image,
            provider: 'google',
          });
        }

        // ✅ 6. إذا كان مستخدم جديد → أضف اشتراك مجاني ومحفظة
        if (isNewUser) {
          const freeSub = await db.query.subscriptions.findFirst({
            where: eq(subscriptions.name, 'free'),
          });

          if (freeSub) {
            await db.insert(userSubscriptions).values({
              userId: user.id,
              subscriptionId: freeSub.id,
              status: 'active',
              startedAt: new Date(),
              expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // سنة
              externalId: null,
            });
          }

          await db.insert(wallets).values({
            userId: user.id,
            balance: 0,
          });
        }

        // ✅ 7. توليد توكن JWT جديد وتحديثه بقاعدة البيانات
        const newToken = jwt.sign(
          { id: user.id, email },
          config.JWT_SECRET as Secret,
          {
            expiresIn: config.JWT_EXPIRES_IN || '1d',
          } as SignOptions,
        );

        await db
          .update(users)
          .set({ token: newToken })
          .where(eq(users.id, user.id));

        return done(null, { ...user, email, token: newToken });
      } catch (err) {
        console.error('Google OAuth error:', err);
        return done(err as any, false);
      }
    },
  ),
);
