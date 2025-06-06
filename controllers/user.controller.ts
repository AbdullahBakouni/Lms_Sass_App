import { Request, Response } from "express";
import {db} from "../src/db";
import { users , userSubscriptions , subscriptionFeatures , features , companions , subscriptions} from "../src/db/schema";
import { eq , and , gt , desc , sql} from "drizzle-orm";




export const updateUserInfo
    = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params; // id المستخدم من URL مثلا /user/:id
        const { name, image } = req.body;

        if (!name && !image) {
            res.status(400).json({ error: "At least one field (name or image) is required" });
            return;
        }

        const updatedFields: Partial<{ name: string; image: string }> = {};
        if (name) updatedFields.name = name;
        if (image) updatedFields.image = image;

        const updatedUser = await db
            .update(users)
            .set(updatedFields)
            .where(eq(users.id, id))
            .returning();

        if (updatedUser.length === 0) {
            res.status(404).json({ error: "User not found" });
            return;
        }

        res.status(200).json({ message: "User updated", user: updatedUser[0] });
    } catch (error) {
        console.error("Update user error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const deletedUser = await db
            .delete(users)
            .where(eq(users.id, id))
            .returning();

        if (deletedUser.length === 0) {
            res.status(404).json({ error: "User not found" });
            return;
        }

        res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
        console.error("Delete user error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        const users = await db.query.users.findMany();
        res.status(200).json({ users });
    } catch (error) {
        console.error("Get all users error:", error);
    }
}


export async function canUserCreateCompanion(
    userId: string,
    voice: 'male' | 'female',
    style: 'formal' | 'casual',
    durationMinutes: number
): Promise<{
    allowed: boolean;
    reason?: string;
}> {
    const now = new Date();

    // 1. الحصول على اشتراك المستخدم الحالي (نستخدم status + expiresAt بدل isActive)
    const [userSub] = await db
        .select()
        .from(userSubscriptions)
        .where(
            and(
                eq(userSubscriptions.userId, userId),
                eq(userSubscriptions.status, 'active'),
                gt(userSubscriptions.expiresAt , now) // لم ينتهِ بعد
            )
        )
        .orderBy(desc(userSubscriptions.startedAt))
        .limit(1);

    if (!userSub) {
        return { allowed: false, reason: 'No active subscription found' };
    }

    const subscriptionId = userSub.subscriptionId;

    // 2. جلب كل الميزات المرتبطة بالاشتراك
    const featuresResult = await db
        .select({
            name: features.name,
            value: subscriptionFeatures.value
        })
        .from(subscriptionFeatures)
        .innerJoin(features, eq(subscriptionFeatures.featureId, features.id))
        .where(eq(subscriptionFeatures.subscriptionId, subscriptionId));

    const featureMap = Object.fromEntries(
        featuresResult.map((f) => [f.name, f.value])
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
            reason: `You have reached your maximum allowed companions (${maxCompanions}).`
        };
    }

    // تحقق 2: voice_type
    const allowedVoices = (featureMap['voice_type'] ?? 'female').split(',');
    if (!allowedVoices.includes(voice)) {
        return {
            allowed: false,
            reason: `Your subscription does not allow using voice type: ${voice}`
        };
    }

    // تحقق 3: style_options
    const rawStyleOptions = featureMap['style_options'];

    // const selectedStyle = style;

// إذا ما في خيارات style وكان المستخدم محدد none، منسمحله
    if (!rawStyleOptions) {
        if (style === null) {
            // مسموح، ما اختار style
        } else {
            return {
                allowed: false,
                reason: 'Your subscription does not allow selecting a style.'
            };
        }
    } else {
        const allowedStyles = rawStyleOptions.split(',');
        if (!allowedStyles.includes(style)) {
            return {
                allowed: false,
                reason: `Your subscription does not allow using style: ${style}`
            };
        }
    }

    // تحقق 4: max_session_minutes
    const maxMinutes = parseInt(featureMap['max_session_minutes'] ?? '15');
    if (durationMinutes > maxMinutes) {
        return {
            allowed: false,
            reason: `Your subscription allows maximum session duration of ${maxMinutes} minutes.`
        };
    }

    // ✅ كل شيء مسموح
    return { allowed: true };
}

export const getUserSubscriptions = async (req: Request, res: Response): Promise<void> => {
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
            .innerJoin(subscriptions, eq(userSubscriptions.subscriptionId, subscriptions.id))
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
                    .where(eq(subscriptionFeatures.subscriptionId, userSub.subscriptionId));

                return {
                    ...userSub,
                    name: subscriptionName,
                    description: subscriptionDescription,
                    features: featuresResult,
                };
            })
        );

        res.status(200).json({ subscriptions: detailedSubscriptions });
    } catch (error) {
        console.error('Error fetching user subscriptions with details:', error);
        res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }
};
