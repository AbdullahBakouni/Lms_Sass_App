import { Router } from 'express';
import passport from 'passport';
// @ts-ignore
import {
  signUp,
  signIn,
  signOut,
  googleFailureHandler,
  googleCallbackHandler,
  switchAccount,
  verifyOtpAndUpdateEmail,
  resendOtp,
} from '../controllers/auth.controller';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';

const authRouter = Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueName = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname); // preserve the extension
    cb(null, uniqueName + ext);
  },
});

const upload = multer({ storage });

authRouter.post('/sign-up', upload.single('image'), signUp);

authRouter.post('/sign-in', signIn);

authRouter.post('/sign-out', signOut);

authRouter.post('/switch-account', switchAccount);

authRouter.post('/verify-otp', verifyOtpAndUpdateEmail);

authRouter.post('/resend-otp', resendOtp);

// Google OAuth routes
authRouter.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] }),
);

authRouter.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/api/v1/auth/google/failure',
  }),
  googleCallbackHandler,
);

authRouter.get('/google/failure', googleFailureHandler);
export default authRouter;
