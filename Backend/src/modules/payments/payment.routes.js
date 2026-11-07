import express, { Router } from 'express';
import { z } from 'zod';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler, ok } from '../../utils/asyncHandler.js';
import { objectId } from '../../utils/schemas.js';

const orderSchema = { body: z.object({ appointmentId: objectId }) };
const verifySchema = {
  body: z.object({
    appointmentId: objectId,
    orderId: z.string().min(1).max(100),
    paymentId: z.string().min(1).max(100),
    signature: z.string().min(1).max(256),
  }),
};

export function createPaymentRoutes({ payments, authenticate }) {
  const router = Router();
  router.use(authenticate, authorize('patient'));
  router.post(
    '/order',
    validate(orderSchema),
    asyncHandler(async (req, res) =>
      ok(res, await payments.createOrder(req.user, req.valid.body.appointmentId)),
    ),
  );
  router.post(
    '/verify',
    validate(verifySchema),
    asyncHandler(async (req, res) => ok(res, await payments.verify(req.user, req.valid.body))),
  );
  return router;
}

/** Must be mounted before the JSON body parser: the signature covers the exact raw bytes. */
export function createPaymentWebhookRoute({ payments }) {
  const router = Router();
  router.post(
    '/',
    express.raw({ type: () => true, limit: '1mb' }),
    asyncHandler(async (req, res) => {
      const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      ok(res, await payments.handleWebhook(body, req.get('x-razorpay-signature')));
    }),
  );
  return router;
}
