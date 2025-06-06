import { Router } from 'express';
import passport from "passport";
// @ts-ignore
import {signUp , signIn , signOut , googleFailureHandler , googleCallbackHandler} from "../controllers/auth.controller";

const authRouter = Router();

authRouter.post('/sign-up', signUp);

authRouter.post('/sign-in', signIn);

authRouter.post('/sign-out', signOut);


// Google OAuth routes
authRouter.get(
    "/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
);

authRouter.get(
    "/google/callback",
    passport.authenticate("google", {
        session: false,
        failureRedirect: "/api/v1/auth/google/failure",
    }),
    googleCallbackHandler
);

authRouter.get("/google/failure", googleFailureHandler);
export default authRouter;
