import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createMockProvider } from '../../src/modules/payments/providers.js';
import { verifyPaymentSignature, verifyWebhookSignature } from '../../src/modules/payments/signature.js';
import { generateOtp, hmacSha256, randomToken, safeEqual, sha256 } from '../../src/utils/crypto.js';

const hmac = (secret, value) => createHmac('sha256', secret).update(value).digest('hex');

describe('payment signature', () => {
  const secret = 'key_secret';

  it('accepts HMAC-SHA256 of orderId|paymentId', () => {
    const signature = hmac(secret, 'order_1|pay_1');
    expect(verifyPaymentSignature('order_1', 'pay_1', signature, secret)).toBe(true);
  });

  it('rejects tampering with any part', () => {
    const signature = hmac(secret, 'order_1|pay_1');
    expect(verifyPaymentSignature('order_2', 'pay_1', signature, secret)).toBe(false);
    expect(verifyPaymentSignature('order_1', 'pay_2', signature, secret)).toBe(false);
    expect(verifyPaymentSignature('order_1', 'pay_1', signature, 'other')).toBe(false);
    expect(verifyPaymentSignature('order_1', 'pay_1', `${signature.slice(0, -1)}0`, secret)).toBe(false);
  });

  it('rejects missing signature, short signature and missing secret', () => {
    expect(verifyPaymentSignature('o', 'p', undefined, secret)).toBe(false);
    expect(verifyPaymentSignature('o', 'p', 'abc', secret)).toBe(false);
    expect(verifyPaymentSignature('o', 'p', hmac(secret, 'o|p'), undefined)).toBe(false);
  });
});

describe('webhook signature', () => {
  const body = Buffer.from('{"event":"payment.captured"}');

  it('verifies the exact raw bytes', () => {
    const signature = hmac('whsec', body);
    expect(verifyWebhookSignature(body, signature, 'whsec')).toBe(true);
    expect(verifyWebhookSignature(Buffer.from('{"event":"payment.captured" }'), signature, 'whsec')).toBe(
      false,
    );
    expect(verifyWebhookSignature(body, signature, 'wrong')).toBe(false);
    expect(verifyWebhookSignature(Buffer.alloc(0), signature, 'whsec')).toBe(false);
    expect(verifyWebhookSignature(body, undefined, 'whsec')).toBe(false);
  });
});

describe('mock provider', () => {
  const provider = createMockProvider();

  it('accepts only mock_ payment ids with the mock signature', () => {
    expect(provider.verifyPayment({ paymentId: 'mock_abc', signature: 'mock' })).toBe(true);
    expect(provider.verifyPayment({ paymentId: 'pay_abc', signature: 'mock' })).toBe(false);
    expect(provider.verifyPayment({ paymentId: 'mock_abc', signature: 'nope' })).toBe(false);
    expect(provider.verifyWebhook(Buffer.from('{}'), 'anything')).toBe(false);
  });
});

describe('crypto helpers', () => {
  it('compares strings in constant time without throwing on length mismatch', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual(undefined, '')).toBe(true);
  });

  it('generates zero padded six digit OTPs', () => {
    const codes = Array.from({ length: 200 }, generateOtp);
    expect(codes.every((code) => /^\d{6}$/.test(code))).toBe(true);
    expect(new Set(codes).size).toBeGreaterThan(150);
  });

  it('hashes deterministically and generates unique tokens', () => {
    expect(sha256('a')).toBe(sha256('a'));
    expect(sha256('a')).toHaveLength(64);
    expect(hmacSha256('k1', 'v')).not.toBe(hmacSha256('k2', 'v'));
    expect(randomToken()).not.toBe(randomToken());
    expect(randomToken(48)).toMatch(/^[\w-]+$/);
  });
});
