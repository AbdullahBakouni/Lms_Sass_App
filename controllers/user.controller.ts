import { Request, Response, RequestHandler } from "express";
import {db} from "../src/db";
import { users } from "../src/db/schema";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import config from "../src/config/config";



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

