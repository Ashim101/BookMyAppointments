import { SettingsDoc } from './settings.model.js';

const FIELDS = ['cancellationCutoffHours', 'bookingWindowDays', 'defaultSlotMinutes', 'currency'];

/** Settings stored in a singleton document override the environment defaults. */
export function createSettingsService({ config, clock, ttlMs = 5000 }) {
  let cached = null;

  async function load() {
    const doc = await SettingsDoc.findOne({ key: 'global' }).lean();
    const merged = { ...config.clinic };
    for (const field of FIELDS) {
      if (doc?.[field] !== undefined && doc[field] !== null) merged[field] = doc[field];
    }
    return {
      cancellationCutoffHours: merged.cancellationCutoffHours,
      bookingWindowDays: merged.bookingWindowDays,
      defaultSlotMinutes: merged.defaultSlotMinutes,
      currency: merged.currency,
      timezone: config.clinic.timezone,
    };
  }

  async function get() {
    const now = clock.now();
    if (!cached || now - cached.at > ttlMs) cached = { value: await load(), at: now };
    return cached.value;
  }

  async function update(patch) {
    await SettingsDoc.findOneAndUpdate({ key: 'global' }, { $set: patch }, { upsert: true });
    cached = null;
    return get();
  }

  return { get, update };
}
