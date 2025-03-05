import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockProvider } from '../../src/modules/payments/providers.js';

afterEach(() => vi.unstubAllEnvs());

describe('mock payment provider', () => {
  it.each(['development', 'test'])('works when NODE_ENV=%s', async (env) => {
    vi.stubEnv('NODE_ENV', env);
    const provider = createMockProvider();
    const { orderId } = await provider.createOrder();
    expect(orderId).toMatch(/^mock_order_/);
    expect(provider.verifyPayment({ orderId, paymentId: 'mock_pay_1', signature: 'mock' })).toBe(true);
    expect(provider.verifyPayment({ orderId, paymentId: 'pay_real', signature: 'mock' })).toBe(false);
    expect((await provider.refund()).status).toBe('completed');
  });

  describe('when NODE_ENV=production', () => {
    it('refuses to create orders, verify payments or refund, even when constructed directly', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      const provider = createMockProvider();
      await expect(provider.createOrder()).rejects.toThrow(/disabled when NODE_ENV=production/);
      expect(() =>
        provider.verifyPayment({ orderId: 'o', paymentId: 'mock_pay_1', signature: 'mock' }),
      ).toThrow(/disabled when NODE_ENV=production/);
      await expect(provider.refund()).rejects.toThrow(/disabled when NODE_ENV=production/);
    });

    it('checks the environment at call time, so a provider built earlier is still refused', async () => {
      vi.stubEnv('NODE_ENV', 'test');
      const provider = createMockProvider();
      vi.stubEnv('NODE_ENV', 'production');
      await expect(provider.createOrder()).rejects.toThrow(/mock payment provider is disabled/);
    });
  });
});
