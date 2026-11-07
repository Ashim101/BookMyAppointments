import Razorpay from 'razorpay';
import { randomToken } from '../../utils/crypto.js';
import { verifyPaymentSignature, verifyWebhookSignature } from './signature.js';

/**
 * Payment providers share one interface:
 *   createOrder({ amount, currency, receipt }) -> { orderId }
 *   verifyPayment({ orderId, paymentId, signature }) -> boolean
 *   verifyWebhook(rawBody, signature) -> boolean
 *   refund({ paymentId, amount, currency }) -> { refundId, status: 'completed' | 'pending' }
 * Amounts are in major currency units.
 */
export function createMockProvider() {
  return {
    mode: 'mock',
    keyId: null,
    async createOrder() {
      return { orderId: `mock_order_${randomToken(9)}` };
    },
    verifyPayment: ({ paymentId, signature }) => paymentId.startsWith('mock_') && signature === 'mock',
    verifyWebhook: () => false,
    async refund() {
      return { refundId: `mock_refund_${randomToken(6)}`, status: 'completed' };
    },
  };
}

const toMinorUnits = (amount) => Math.round(amount * 100);

export function createRazorpayProvider({ keyId, keySecret, webhookSecret, client }) {
  const api = client ?? new Razorpay({ key_id: keyId, key_secret: keySecret });
  return {
    mode: 'razorpay',
    keyId,
    async createOrder({ amount, currency, receipt }) {
      const order = await api.orders.create({ amount: toMinorUnits(amount), currency, receipt });
      return { orderId: order.id };
    },
    verifyPayment: ({ orderId, paymentId, signature }) =>
      verifyPaymentSignature(orderId, paymentId, signature, keySecret),
    verifyWebhook: (rawBody, signature) => verifyWebhookSignature(rawBody, signature, webhookSecret),
    async refund({ paymentId, amount }) {
      const refund = await api.payments.refund(paymentId, { amount: toMinorUnits(amount) });
      return { refundId: refund.id, status: refund.status === 'processed' ? 'completed' : 'pending' };
    },
  };
}

export function createPaymentProvider({ config }) {
  const { mode, keyId, keySecret, webhookSecret } = config.payments;
  return mode === 'razorpay'
    ? createRazorpayProvider({ keyId, keySecret, webhookSecret })
    : createMockProvider();
}
