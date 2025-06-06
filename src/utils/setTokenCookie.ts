import { Response } from "express";
import jwt, {Secret , SignOptions} from "jsonwebtoken";
import config from "../config/config";

export const setTokenCookie = (res: Response, payload: object) => {
    const token = jwt.sign(payload, config.JWT_SECRET as Secret, {
        expiresIn: config.JWT_EXPIRES_IN || "1d",
    } as SignOptions);

    res.cookie("token", token, {
        httpOnly: true,
        secure: config.nodeEnv === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    return token;
};