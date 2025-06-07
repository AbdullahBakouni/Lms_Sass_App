
import { Router } from 'express';
// @ts-ignore
import {chargeWallet} from "../controllers/wallet.controller";
const walletRouter = Router();

walletRouter.post('/charge', chargeWallet);
export default walletRouter;