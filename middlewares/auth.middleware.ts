import {Request, Response, NextFunction} from "express";
import jwt from "jsonwebtoken";
import config from "../src/config/config";
import {db} from "../src/db";
import { users } from "../src/db/schema";
import { eq } from "drizzle-orm";

export const authorize = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {

        const token = req.cookies.token;

        if (!token) {
            res.status(401).json({ message: "Unauthorized - No token provided" });
            return;
        }

        // فك تشفير التوكن
        const decoded = jwt.verify(token, config.JWT_SECRET) as { id: string };

        // جلب المستخدم من قاعدة البيانات عبر Drizzle
        const user = await db.query.users.findFirst({
            where: eq(users.id, decoded.id)
        });

        if (!user) {
            res.status(401).json({ message: "Unauthorized - User not found" });
            return;
        }

        // إضافة المستخدم للـ request object
        (req as any).user = user;

        next();
    } catch (error) {
        console.error("Auth error:", error);
        res.status(401).json({ message: "Unauthorized", error: (error as any).message });
    }
};
