import { Request, Response } from 'express';
import { db } from '../src/db';
import {
  users,
  userSubscriptions,
  subscriptions,
  wallets,
  accounts,
  accountOtps,
} from '../src/db/schema';
import bcrypt from 'bcrypt';
import { eq, and, desc } from 'drizzle-orm';
import { setTokenCookie } from '../src/utils/setTokenCookie';
import { randomBytes } from 'crypto';
import { sendOtpEmail } from '../src/utils/mailer';
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}
export const signUp = async (
  req: MulterRequest,
  res: Response,
): Promise<void> => {
  try {
    const { name, email, password } = req.body;
    const imageFile = req.file;
    const incomingToken = req.cookies.token;

    if (!name || !email || !password) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    // تحقق من وجود حساب credentials بنفس الإيميل
    const existingCredentialAccount = await db.query.accounts.findFirst({
      where: and(
        eq(accounts.email, email),
        eq(accounts.provider, 'credentials'),
      ),
    });

    if (existingCredentialAccount) {
      res.status(409).json({ error: 'Account already exists with this email' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let userId: string | null = null;
    let finalToken = incomingToken;

    await db.transaction(async (tx) => {
      // ✅ أولاً: حاول استخراج userId من التوكن
      if (incomingToken) {
        const existingUser = await tx.query.users.findFirst({
          where: eq(users.token, incomingToken),
        });

        if (existingUser) {
          userId = existingUser.id;

          // 🔍 تحقق إذا المستخدم الحالي عنده حساب بهذا الإيميل مسبقًا
          const existingEmailForUser = await tx.query.accounts.findFirst({
            where: and(eq(accounts.email, email), eq(accounts.userId, userId)),
          });

          if (existingEmailForUser) {
            res.status(409).json({
              error: 'This email is already associated with your account.',
            });
            return;
          }
        }
      }

      // ✅ ثانياً: إذا لم نجد user من التوكن، نبحث عن أي حساب بنفس الإيميل (حتى لو Google)
      if (!userId) {
        const existingAnyAccount = await tx.query.accounts.findFirst({
          where: eq(accounts.email, email),
        });

        if (existingAnyAccount) {
          userId = existingAnyAccount.userId;
        }
      }

      // ✅ ثالثاً: إذا لم نجد أي مستخدم → أنشئ مستخدم جديد
      if (!userId) {
        const [newUser] = await tx
          .insert(users)
          .values({
            name,
            image: imageFile ? imageFile.filename : null,
            token: '', // لاحقًا
          })
          .returning();

        userId = newUser.id;

        const token = setTokenCookie(res, {
          id: newUser.id,
          email,
        });

        finalToken = token;

        await tx.update(users).set({ token }).where(eq(users.id, userId));

        // اشتراك ومحفظة
        const freeSub = await tx.query.subscriptions.findFirst({
          where: eq(subscriptions.name, 'free'),
        });

        if (freeSub) {
          await tx.insert(userSubscriptions).values({
            userId,
            subscriptionId: freeSub.id,
            status: 'active',
            startedAt: new Date(),
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            externalId: null,
          });
        }

        await tx.insert(wallets).values({
          userId,
          balance: 0,
        });
      }

      // ✅ في جميع الحالات: أضف حساب credentials لهذا المستخدم (حتى لو مستخدم قديم)
      await tx.insert(accounts).values({
        userId: userId!,
        email,
        password: hashedPassword,
        image: imageFile ? imageFile.filename : null,
        provider: 'credentials',
      });
    });

    res.status(201).json({
      message: 'Account created successfully',
      token: finalToken,
    });
  } catch (error) {
    console.error('Sign up error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

export const signIn = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // جلب الحساب بناء على الإيميل وprovider
    const account = await db.query.accounts.findFirst({
      where: and(
        eq(accounts.email, email),
        eq(accounts.provider, 'credentials'),
      ),
    });

    if (!account || !account.password) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, account.password);
    if (!isPasswordValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = setTokenCookie(res, {
      id: account.userId,
      email: account.email,
    });

    res.status(200).json({ message: 'Login successful' });
  } catch (err) {
    console.error('Sign in error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

export const signOut = async (req: Request, res: Response): Promise<void> => {
  try {
    // In a stateless JWT authentication system, the client is responsible for
    // discarding the token. The server can't invalidate the token directly.
    // However, we can respond with a success message.
    res.clearCookie('token');
    res.status(200).json({ message: 'Logged out successfully' });

    // For a more secure implementation, you could:
    // 1. Use a token blacklist (requires database storage)
    // 2. Use short-lived tokens with refresh tokens
    // 3. Implement a Redis cache for token invalidation
  } catch (err) {
    console.error('Sign out error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

export const googleCallbackHandler = (req: Request, res: Response) => {
  const user = req.user as any;

  if (!user) {
    return res.redirect('/api/v1/auth/google/failure');
  }

  const token = setTokenCookie(res, { id: user.id, email: user.email });

  res.redirect('http://localhost:3000');
};

// فشل تسجيل دخول Google
export const googleFailureHandler = (req: Request, res: Response) => {
  res.status(401).json({ message: 'Google login failed' });
};

export const switchAccount = async (req: Request, res: Response) => {
  try {
    const { accountId } = req.body;
    const token = req.cookies.token;

    if (!token || !accountId) {
      res.status(400).json({ error: 'Missing token or accountId' });
      return;
    }

    const user = await db.query.users.findFirst({
      where: eq(users.token, token),
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const account = await db.query.accounts.findFirst({
      where: and(eq(accounts.id, accountId), eq(accounts.userId, user.id)),
    });

    if (!account) {
      res
        .status(403)
        .json({ error: 'Account does not belong to current user' });
      return;
    }

    await db
      .update(users)
      .set({ selectedAccountId: account.id })
      .where(eq(users.id, user.id));

    res.status(200).json({ message: 'Switched active account successfully' });
  } catch (error) {
    console.error('Switch account error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

export const verifyOtpAndUpdateEmail = async (req: Request, res: Response) => {
  const { accountId, otp, oldPassword } = req.body;

  if (!accountId || !otp || !oldPassword) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  const otpRecord = await db
    .select()
    .from(accountOtps)
    .where(and(eq(accountOtps.account_id, accountId), eq(accountOtps.otp, otp)))
    .orderBy(desc(accountOtps.expires_at))
    .then((r) => r[0]);

  const now = new Date();

  if (!otpRecord) {
    res.status(400).json({ error: 'Invalid OTP' });
    return;
  }
  const account = await db
    .select()
    .from(accounts)
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
  if (otpRecord?.expires_at && new Date(otpRecord.expires_at) < now) {
    if (!otpRecord.new_email) {
      res.status(400).json({ error: 'No email found to send new OTP.' });
      return;
    }
    const newOtp = randomBytes(3).toString('hex').toUpperCase();
    const newExpiry = new Date(now.getTime() + 60 * 1000); // دقيقة واحدة

    await sendOtpEmail(otpRecord.new_email, newOtp);

    await db.insert(accountOtps).values({
      account_id: accountId,
      otp: newOtp,
      new_email: otpRecord.new_email,
      expires_at: newExpiry,
    });

    res.status(400).json({
      error: 'OTP expired. A new OTP has been sent.',
      newOtpSent: true,
      expiresIn: newExpiry.toISOString(),
    });
    return;
  }

  if (otpRecord.new_email && otpRecord.new_password) {
    const hashedPassword = await bcrypt.hash(otpRecord.new_password, 10);

    await db
      .update(accounts)
      .set({ email: otpRecord.new_email, password: hashedPassword })
      .where(eq(accounts.id, accountId));

    await db.delete(accountOtps).where(eq(accountOtps.id, otpRecord.id));

    res.json({ success: true, message: 'Email has been updated successfully' });
  }
};

export const resendOtp = async (req: Request, res: Response) => {
  const { accountId } = req.body;

  if (!accountId) {
    res.status(400).json({ error: 'Missing accountId' });
    return;
  }

  const latestOtp = await db
    .select()
    .from(accountOtps)
    .where(eq(accountOtps.account_id, accountId))
    .orderBy(desc(accountOtps.expires_at))
    .then((r) => r[0]);

  if (!latestOtp || !latestOtp.new_email) {
    res.status(400).json({ error: 'No email found to send new OTP.' });
    return;
  }

  const newOtp = randomBytes(3).toString('hex').toUpperCase();
  const newExpiry = new Date(Date.now() + 60 * 1000);

  await sendOtpEmail(latestOtp.new_email, newOtp);

  await db.insert(accountOtps).values({
    account_id: accountId,
    otp: newOtp,
    new_email: latestOtp.new_email,
    new_password: latestOtp.new_password,
    expires_at: newExpiry,
  });

  res.json({ message: 'New OTP sent.', expiresIn: newExpiry.toISOString() });
};
