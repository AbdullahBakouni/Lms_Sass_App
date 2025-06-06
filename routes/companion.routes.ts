import { Router } from 'express';
// @ts-ignore
import {createCompanion} from "../controllers/companion.controller";

const companionRouter = Router();

companionRouter.post('/create', createCompanion);

export default companionRouter;

