import { Request, Response } from "express";
import {db} from "../src/db";
import { users , userSubscriptions , subscriptions , wallets } from "../src/db/schema";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import {setTokenCookie} from "../src/utils/setTokenCookie";

export const signUp = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, email, password, image } = req.body;

        if (!name || !email || !password) {
            res.status(400).json({ error: "All fields are required" });
            return;
        }

        const existingUser = await db.query.users.findFirst({
            where: eq(users.email, email),
        });

        if (existingUser) {
            res.status(409).json({ error: "User already exists" });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const insertedUser = await db.transaction(async (tx) => {
            const [createdUser] = await tx.insert(users).values({
                name,
                email,
                image,
                password: hashedPassword,
            }).returning();

            // جلب subscription المجاني من جدول subscriptions (مثلاً اسمه 'free')
            const freeSub = await tx.select().from(subscriptions).where(eq(subscriptions.name, 'free')).limit(1).then(rows => rows[0]);

            if (!freeSub) {
                res.status(409).json({ error: "Free subscription not found" });
                return;
            }

            // إدخال اشتراك المستخدم المجاني
            await tx.insert(userSubscriptions).values({
                userId: createdUser.id,
                subscriptionId: freeSub.id,
                status: 'active',
                startedAt: new Date(),
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // مثلاً سنة مجانية
                externalId: null,
            });

            await tx.insert(wallets).values({
                userId: createdUser.id,
                balance: 0,
            });

            return createdUser;
        });

        if (!insertedUser) {
            return;
        }

        const token = setTokenCookie(res, { id: insertedUser.id, email: insertedUser.email });


        res.status(201).json({
            message: "User created successfully",
            token,
            user: {
                id: insertedUser.id,
                name: insertedUser.name,
                email: insertedUser.email,
                image: insertedUser.image,
                provider: insertedUser.provider,
            },

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
            res.status(400).json({ error: "Email and password are required" });
            return;
        }

        // Find user by email
        const user = await db.query.users.findFirst({
            where: eq(users.email, email),
        });

        if (!user) {
            res.status(401).json({ error: "Invalid credentials" });
            return;
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            res.status(401).json({ error: "Invalid credentials" });
            return;
        }

        // Generate JWT token
        // const token = jwt.sign(
        //     { id: user.id, email: user.email},
        //     config.JWT_SECRET as Secret,
        //     {
        //         expiresIn: config.JWT_EXPIRES_IN || '1d' // Convert to number if it's numeric, or use time string
        //     } as SignOptions
        // );
        const token = setTokenCookie(res, { id: user.id, email: user.email });

        res.status(200).json({ message: "Login successful", token, user });
    } catch (err) {
        console.error("Sign in error:", err);
        res.status(500).json({ error: "Something went wrong" });
    }
};

export const signOut = async (req: Request, res: Response): Promise<void> => {
    try {
        // In a stateless JWT authentication system, the client is responsible for
        // discarding the token. The server can't invalidate the token directly.
        // However, we can respond with a success message.
        res.clearCookie("token");
        res.status(200).json({ message: "Logged out successfully" });

        // For a more secure implementation, you could:
        // 1. Use a token blacklist (requires database storage)
        // 2. Use short-lived tokens with refresh tokens
        // 3. Implement a Redis cache for token invalidation
    } catch (err) {
        console.error("Sign out error:", err);
        res.status(500).json({ error: "Something went wrong" });
    }
};

export const googleCallbackHandler = (req: Request, res: Response) => {


    const user = req.user as any;
    const token = setTokenCookie(res, { id: user.id, email: user.email });


    res.redirect("http://localhost:3000/auth/success");
};

// فشل تسجيل دخول Google
export const googleFailureHandler = (req: Request, res: Response) => {
    res.status(401).json({ message: "Google login failed" });
};
