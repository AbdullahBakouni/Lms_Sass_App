import { Request, Response } from 'express';
import { db } from '../src/db';
import {
  users,
  userSubscriptions,
  subscriptionFeatures,
  features,
  companions,
  subscriptions,
  accounts,
  accountOtps,
} from '../src/db/schema';
import { eq, desc, sql, and, lt } from 'drizzle-orm';
import path from 'path';
import fs from 'fs/promises';
import { randomBytes } from 'crypto';
import { sendOtpEmail } from '../src/utils/mailer';
import bcrypt from 'bcrypt';
const UPLOAD_DIR = path.resolve(__dirname, '../uploads');

export const updateUserInfo = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { accountId, name, email, existingImage, newPassword, oldPassword } =
    req.body;
  const file = req.file; // middleware multer
  if (!accountId) {
    res.status(400).json({ error: 'Missing accountId' });
    return;
  }
  const account = await db
    .select({
      accountId: accounts.id,
      accountImage: accounts.image,
      provider: accounts.provider,
      password: accounts.password,
      userId: users.id,
      userName: users.name,
      userEmail: accounts.email,
    })
    .from(accounts)
    .innerJoin(users, eq(accounts.userId, users.id))
    .where(eq(accounts.id, accountId))
    .then((r) => r[0]);

  if (!account) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }
  if (!account.password) {
    res.status(400).json({ error: 'Password not available for this account' });
    return;
  }
  const isPasswordCorrect = await bcrypt.compare(oldPassword, account.password);
  if (!isPasswordCorrect) {
    res.status(401).json({ error: 'Incorrect current password' });
    return;
  }
  const updates: Partial<typeof accounts.$inferInsert> = {};
  const usersUpdates: Partial<typeof users.$inferInsert> = {};

  // 1️⃣ الاسم
  if (name && name !== account.userName) {
    usersUpdates.name = name;
  }

  // 2️⃣ الصورة
  if (file) {
    updates.image = file.filename;
    usersUpdates.image = file.filename;

    if (existingImage) {
      const oldPath = path.join(UPLOAD_DIR, existingImage);
      fs.rm(oldPath).catch(() => {});
    }
  }

  let otpToken: string | null = null;
  let otpExpiry: Date | null = null;
  let otpMessage: string | null = null;

  if (email && email !== account.userEmail) {
    const now = new Date();

    await db
      .delete(accountOtps)
      .where(
        and(
          eq(accountOtps.account_id, accountId),
          lt(accountOtps.expires_at, now),
        ),
      );
    const existingOtp = await db
      .select()
      .from(accountOtps)
      .where(
        and(
          eq(accountOtps.account_id, accountId),
          eq(accountOtps.new_email, email),
        ),
      )
      .orderBy(desc(accountOtps.expires_at))
      .then((r) => r[0]);

    if (existingOtp?.expires_at && new Date(existingOtp.expires_at) > now) {
      otpMessage = 'OTP already sent. Please wait before requesting a new one.';
      otpExpiry = new Date(existingOtp.expires_at);
    } else {
      // إنشاء OTP جديد
      otpToken = randomBytes(3).toString('hex').toUpperCase();
      otpExpiry = new Date(now.getTime() + 60 * 1000); // دقيقة واحدة

      await sendOtpEmail(email, otpToken);

      await db.insert(accountOtps).values({
        account_id: accountId,
        otp: otpToken,
        new_email: email,
        new_password: newPassword,
        expires_at: otpExpiry,
      });

      otpMessage = existingOtp
        ? 'Previous OTP expired. A new one has been sent.'
        : 'OTP has been sent.';
    }
  }

  // 4️⃣ تحديث الاسم/الصورة فقط (الإيميل لا يُحدّث هنا)
  if (Object.keys(updates).length > 0) {
    await db.update(accounts).set(updates).where(eq(accounts.id, accountId));
  }

  if (Object.keys(usersUpdates).length > 0) {
    await db
      .update(users)
      .set(usersUpdates)
      .where(eq(users.id, account.userId));
  }

  res.json({
    success: true,
    otpSent: !!otpToken,
    message: otpMessage,
    expiresIn: otpExpiry ? otpExpiry.toISOString() : null,
  });
};

export const deleteUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    const deletedUser = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning();

    if (deletedUser.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
export const getUserInfo = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as any).user;

    if (!user?.id) {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }

    // جلب بيانات المستخدم من جدول users
    const userData = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });

    if (!userData) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const accountList = await db
      .select({
        id: accounts.id,
        email: accounts.email,
        provider: accounts.provider,
        image: accounts.image,
        name: users.name,
      })
      .from(accounts)
      .leftJoin(users, eq(accounts.userId, users.id))
      .where(eq(users.id, user.id));

    // حساب الـ account المحدد (المفعل)
    const selectedAccount = accountList.find(
      (acc) => acc.id === userData.selectedAccountId,
    );

    res.status(200).json({
      currentUser: {
        id: userData.id,
        name: userData.name,
        image: userData.image,
        selectedAccountId: userData.selectedAccountId,
        selectedAccount: selectedAccount || null,
      },
      accounts: accountList,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export async function canUserCreateCompanion(
  userId: string,
  voice: 'male' | 'female',
  style: 'formal' | 'casual',
  durationMinutes: number,
): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  const now = new Date();

  const [latestSub] = await db
    .select({
      userSub: userSubscriptions,
      sub: subscriptions,
    })
    .from(userSubscriptions)
    .innerJoin(
      subscriptions,
      eq(userSubscriptions.subscriptionId, subscriptions.id),
    )
    .where(eq(userSubscriptions.userId, userId))
    .orderBy(desc(userSubscriptions.startedAt))
    .limit(1);

  if (!latestSub) {
    return { allowed: false, reason: 'You do not have any subscription.' };
  }

  const { userSub, sub } = latestSub;

  const isExpired =
    userSub.status === 'expired' || new Date(userSub.expiresAt) < now;

  if (isExpired) {
    const expirationDate = new Date(userSub.expiresAt).toLocaleDateString();
    return {
      allowed: false,
      reason: `Your subscription "${sub.name}" expired on ${expirationDate}. Please renew to continue.`,
    };
  }

  if (userSub.status !== 'active') {
    return { allowed: false, reason: 'Your subscription is not active.' };
  }

  const subscriptionId = userSub.subscriptionId;

  const featuresResult = await db
    .select({
      name: features.name,
      value: subscriptionFeatures.value,
    })
    .from(subscriptionFeatures)
    .innerJoin(features, eq(subscriptionFeatures.featureId, features.id))
    .where(eq(subscriptionFeatures.subscriptionId, subscriptionId));

  const featureMap = Object.fromEntries(
    featuresResult.map((f) => [f.name, f.value]),
  );

  // تحقق 1: max_companions
  const maxCompanions = parseInt(featureMap['max_companions'] ?? '1');
  const [companionCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(companions)
    .where(eq(companions.userId, userId));

  if (Number(companionCount.count) >= maxCompanions) {
    return {
      allowed: false,
      reason: `You have reached your maximum allowed companions (${maxCompanions}).`,
    };
  }

  // تحقق 2: voice_type
  const allowedVoices = (featureMap['voice_type'] ?? 'female').split(',');
  if (!allowedVoices.includes(voice)) {
    return {
      allowed: false,
      reason: `Your subscription does not allow using voice type: ${voice}`,
    };
  }

  const rawStyleOptions = featureMap['style_options'];

  if (!rawStyleOptions) {
    if (style === null) {
    } else {
      return {
        allowed: false,
        reason: 'Your subscription does not allow selecting a style.',
      };
    }
  } else {
    const allowedStyles = rawStyleOptions.split(',');
    if (!allowedStyles.includes(style)) {
      return {
        allowed: false,
        reason: `Your subscription does not allow using style: ${style}`,
      };
    }
  }

  const maxMinutes = parseInt(featureMap['max_session_minutes'] ?? '15');
  if (durationMinutes > maxMinutes) {
    return {
      allowed: false,
      reason: `Your subscription allows maximum session duration of ${maxMinutes} minutes.`,
    };
  }

  return { allowed: true };
}

export const getUserSubscriptions = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    // 1. جلب كل اشتراكات المستخدم مع اسم ووصف الاشتراك (عن طريق join على subscriptions)
    const userSubs = await db
      .select({
        userSub: userSubscriptions,
        subscriptionName: subscriptions.name,
        subscriptionDescription: subscriptions.description,
      })
      .from(userSubscriptions)
      .innerJoin(
        subscriptions,
        eq(userSubscriptions.subscriptionId, subscriptions.id),
      )
      .where(eq(userSubscriptions.userId, id));

    // 2. جلب الميزات المرتبطة بكل اشتراك
    const detailedSubscriptions = await Promise.all(
      userSubs.map(async (entry) => {
        const { userSub, subscriptionName, subscriptionDescription } = entry;

        const featuresResult = await db
          .select({
            featureName: features.name,
            featureValue: subscriptionFeatures.value,
          })
          .from(subscriptionFeatures)
          .innerJoin(features, eq(subscriptionFeatures.featureId, features.id))
          .where(
            eq(subscriptionFeatures.subscriptionId, userSub.subscriptionId),
          );

        return {
          ...userSub,
          name: subscriptionName,
          description: subscriptionDescription,
          features: featuresResult,
        };
      }),
    );

    res.status(200).json({ subscriptions: detailedSubscriptions });
  } catch (error) {
    console.error('Error fetching user subscriptions with details:', error);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
};
