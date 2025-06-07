import { Router } from 'express';
// @ts-ignore
import {subscribeToPlan} from "../controllers/subscription.controller";

const subscriptionRouter = Router();

subscriptionRouter.post('/subscribe', subscribeToPlan);

export default subscriptionRouter;