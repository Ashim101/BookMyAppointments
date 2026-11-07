import { existsSync } from 'node:fs';
import { mkdtemp, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  destroy: vi.fn(),
  config: vi.fn(),
  verifyIdToken: vi.fn(),
  sendMail: vi.fn(),
  createTransport: vi.fn(),
}));

vi.mock('cloudinary', () => ({
  v2: {
    config: mocks.config,
    uploader: {
      upload_stream: (options, callback) => ({ end: (buffer) => mocks.upload(options, buffer, callback) }),
      destroy: mocks.destroy,
    },
  },
}));
vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    verifyIdToken = mocks.verifyIdToken;
  },
}));
vi.mock('nodemailer', () => ({ default: { createTransport: mocks.createTransport } }));

const { loadConfig } = await import('../../src/config/env.js');
const { createStorage, assertImageContent } = await import('../../src/modules/uploads/storage.js');
const { createGoogleVerifier } = await import('../../src/modules/auth/googleVerifier.js');
const { createMailer } = await import('../../src/modules/notifications/mailer.js');
const { createPaymentProvider } = await import('../../src/modules/payments/providers.js');

const base = { JWT_ACCESS_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'b'.repeat(32) };
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
const logger = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() };

beforeEach(() => vi.clearAllMocks());

describe('image content checks', () => {
  it('accepts matching magic bytes and rejects mismatches', () => {
    expect(() => assertImageContent({ mimetype: 'image/png', buffer: PNG })).not.toThrow();
    expect(() => assertImageContent({ mimetype: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]) })).not.toThrow();
    expect(() => assertImageContent({ mimetype: 'image/webp', buffer: Buffer.from('RIFF....WEBPxxxx') })).not.toThrow();
    expect(() => assertImageContent({ mimetype: 'image/png', buffer: Buffer.from('GIF89a') })).toThrow(/not a valid image/);
    expect(() => assertImageContent({ mimetype: 'image/gif', buffer: Buffer.from('GIF89a') })).toThrow(/not a valid image/);
  });
});

describe('local image storage', () => {
  it('stores files under the upload directory and removes replaced ones safely', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'bma-storage-'));
    const config = loadConfig({ ...base, UPLOAD_DIR: dir, PUBLIC_URL: 'http://api.example.com/' });
    const storage = createStorage({ config, logger });
    const url = await storage.saveImage({ mimetype: 'image/png', buffer: PNG });
    expect(url).toMatch(/^http:\/\/api\.example\.com\/uploads\/[\w-]+\.png$/);
    const name = path.basename(url);
    expect(await readdir(dir)).toEqual([name]);

    await storage.removeImage(`http://api.example.com/uploads/../../${name}`);
    expect(existsSync(path.join(dir, name))).toBe(false);
    await storage.removeImage(null);
    await storage.removeImage('http://api.example.com/uploads/missing.png');
    expect(logger.warn).toHaveBeenCalled();
    await storage.removeImage('https://elsewhere.example/img.png');
    expect(mocks.destroy).not.toHaveBeenCalled();
  });
});

describe('Cloudinary storage', () => {
  const config = loadConfig({ ...base, CLOUDINARY_CLOUD_NAME: 'demo', CLOUDINARY_API_KEY: 'key', CLOUDINARY_API_SECRET: 'secret' });

  it('uploads through the SDK and returns the secure URL', async () => {
    mocks.upload.mockImplementation((_options, _buffer, callback) => callback(null, { secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/bookmyappointments/abc.png' }));
    const storage = createStorage({ config, logger });
    expect(mocks.config).toHaveBeenCalledWith({ cloud_name: 'demo', api_key: 'key', api_secret: 'secret' });
    const url = await storage.saveImage({ mimetype: 'image/png', buffer: PNG });
    expect(url).toBe('https://res.cloudinary.com/demo/image/upload/v1/bookmyappointments/abc.png');
    expect(mocks.upload.mock.calls[0][0]).toMatchObject({ folder: 'bookmyappointments', resource_type: 'image' });
  });

  it('surfaces upload failures and destroys replaced images by public id', async () => {
    mocks.upload.mockImplementation((_options, _buffer, callback) => callback(new Error('quota exceeded')));
    const storage = createStorage({ config, logger });
    await expect(storage.saveImage({ mimetype: 'image/png', buffer: PNG })).rejects.toThrow('quota exceeded');

    await storage.removeImage('https://res.cloudinary.com/demo/image/upload/v123/bookmyappointments/abc.png');
    expect(mocks.destroy).toHaveBeenCalledWith('bookmyappointments/abc');
  });
});

describe('Google verifier', () => {
  it('is disabled without a client id', () => {
    expect(createGoogleVerifier({ config: loadConfig(base) })).toBeNull();
  });

  it('maps the verified payload', async () => {
    mocks.verifyIdToken.mockResolvedValue({ getPayload: () => ({ sub: 'g1', email: 'a@example.com', email_verified: true, name: 'Ann', picture: 'https://img/a.png' }) });
    const verify = createGoogleVerifier({ config: loadConfig({ ...base, GOOGLE_CLIENT_ID: 'client-id' }) });
    expect(await verify('token')).toEqual({ sub: 'g1', email: 'a@example.com', emailVerified: true, name: 'Ann', picture: 'https://img/a.png' });
    expect(mocks.verifyIdToken).toHaveBeenCalledWith({ idToken: 'token', audience: 'client-id' });

    mocks.verifyIdToken.mockResolvedValue({ getPayload: () => ({ sub: 'g2', email: 'b@example.com' }) });
    expect(await verify('token')).toMatchObject({ emailVerified: false, name: 'b@example.com', picture: null });
  });
});

describe('mailer', () => {
  it('uses the SMTP transport when configured and logs without bodies', async () => {
    mocks.sendMail.mockResolvedValue({});
    mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
    const config = loadConfig({ ...base, SMTP_HOST: 'smtp.example.com', SMTP_PORT: '465', SMTP_USER: 'user', SMTP_PASS: 'pass' });
    const mailer = createMailer({ config, logger });
    expect(mocks.createTransport).toHaveBeenCalledWith({ host: 'smtp.example.com', port: 465, secure: true, auth: { user: 'user', pass: 'pass' } });
    await mailer.send({ to: 'x@example.com', subject: 'Hello', text: 'Secret body 123456' });
    expect(mocks.sendMail).toHaveBeenCalledWith({ from: config.mailFrom, to: 'x@example.com', subject: 'Hello', text: 'Secret body 123456' });
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain('Secret body');
    expect(mailer.outbox).toEqual([]);
  });

  it('keeps messages in the outbox with the json transport', async () => {
    mocks.createTransport.mockImplementation(() => ({ sendMail: async (message) => ({ message: JSON.stringify(message) }) }));
    const mailer = createMailer({ config: loadConfig(base), logger });
    expect(mocks.createTransport).toHaveBeenCalledWith({ jsonTransport: true });
    for (let i = 0; i < 105; i += 1) await mailer.send({ to: 'x@example.com', subject: `S${i}`, text: `T${i}` });
    expect(mailer.outbox).toHaveLength(100);
    expect(mailer.outbox.at(-1)).toEqual({ to: 'x@example.com', subject: 'S104', text: 'T104' });
    expect(mailer.outbox[0].subject).toBe('S5');
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain('T104');
  });
});

describe('payment provider selection', () => {
  it('chooses the mock provider by default and Razorpay when configured', () => {
    expect(createPaymentProvider({ config: loadConfig(base) })).toMatchObject({ mode: 'mock', keyId: null });
    const config = loadConfig({ ...base, PAYMENTS_MODE: 'razorpay', RAZORPAY_KEY_ID: 'rzp_test_1', RAZORPAY_KEY_SECRET: 's', RAZORPAY_WEBHOOK_SECRET: 'w' });
    expect(createPaymentProvider({ config })).toMatchObject({ mode: 'razorpay', keyId: 'rzp_test_1' });
  });
});
