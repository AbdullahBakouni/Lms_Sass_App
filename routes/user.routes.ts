import { Router } from 'express';

// @ts-ignore
import {
  deleteUser,
  updateUserInfo,
  getUserSubscriptions,
  getUserInfo,
} from '../controllers/user.controller';

// @ts-ignore
import { authorize } from '../middlewares/auth.middleware';
import multer from 'multer';

const userRouter = Router();

const upload = multer({ dest: 'uploads/' });

userRouter.post('/update', upload.single('image'), updateUserInfo);

userRouter.delete('/:id/delete', authorize, deleteUser);
userRouter.get('/me', authorize, getUserInfo);
userRouter.get('/:id/mysubscription', authorize, getUserSubscriptions);
export default userRouter;
