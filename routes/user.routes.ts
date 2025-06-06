import { Router } from 'express';
// @ts-ignore
import {deleteUser, updateUserInfo} from "../controllers/user.controller";
// @ts-ignore
import {authorize} from "../middlewares/auth.middleware";

const userRouter = Router();


userRouter.patch('/:id/update',authorize, updateUserInfo);
userRouter.delete('/:id/delete', authorize ,deleteUser);


export default userRouter;