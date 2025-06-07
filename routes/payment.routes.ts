import express from 'express';
import { Router } from 'express';
// @ts-ignore
import {stripePaymentsController , handleStripeWebhook} from "../controllers/stripe_payments.controller";

const paymentRouter = Router();

paymentRouter.post('/payment/create' , stripePaymentsController);
paymentRouter.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook)
export default paymentRouter;