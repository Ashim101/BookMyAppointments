import { z } from 'zod';

const email = z
  .email()
  .max(254)
  .transform((value) => value.trim().toLowerCase());

export const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a digit');

const refreshToken = z.string().min(20).max(200);

export const otpRequestSchema = { body: z.object({ email }) };

export const registerSchema = {
  body: z.object({
    name: z.string().trim().min(2).max(80),
    email,
    password,
    otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
  }),
};

export const loginSchema = {
  body: z.object({
    email,
    password: z.string().min(1).max(128),
    role: z.enum(['patient', 'doctor', 'admin']),
  }),
};

export const googleSchema = { body: z.object({ credential: z.string().min(10).max(4000) }) };
export const refreshSchema = { body: z.object({ refreshToken }) };
export const forgotSchema = { body: z.object({ email, role: z.enum(['patient', 'doctor']) }) };
export const resetSchema = { body: z.object({ token: z.string().min(20).max(200), password }) };
