import { hmacSha256, safeEqual } from '../../utils/crypto.js';

/** Razorpay signs `orderId|paymentId` with the key secret. */
export const verifyPaymentSignature = (orderId, paymentId, signature, secret) =>
  Boolean(secret && signature) && safeEqual(hmacSha256(secret, `${orderId}|${paymentId}`), signature);

/** Webhooks are signed over the exact raw request body with the webhook secret. */
export const verifyWebhookSignature = (rawBody, signature, secret) =>
  Boolean(secret && signature && rawBody?.length) && safeEqual(hmacSha256(secret, rawBody), signature);
