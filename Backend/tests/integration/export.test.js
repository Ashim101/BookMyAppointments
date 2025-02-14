import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Appointment } from '../../src/modules/appointments/appointment.model.js';
import { startHarness } from '../helpers/harness.js';

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r' && text[i + 1] === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
    } else field += ch;
  }
  return rows;
};

describe('appointment CSV export', () => {
  let h;
  let admin;
  let doctor;
  const as = () => h.bearer(admin.token);

  const insert = (n, overrides = {}) =>
    Appointment.create({
      patient: doctor.doctor._id,
      doctor: doctor.doctor._id,
      patientInfo: { name: `Patient ${n}`, email: `p${n}@example.com` },
      doctorInfo: { name: 'Dr. Test', speciality: 'general-physician', specialityName: 'General physician' },
      date: '2026-03-05',
      time: '10:00',
      startsAt: new Date(Date.UTC(2026, 2, 5, 4, 15) + n * 60_000),
      endsAt: new Date(Date.UTC(2026, 2, 5, 4, 45)),
      timezone: 'Asia/Kathmandu',
      fee: 500,
      currency: 'INR',
      ...overrides,
    });

  beforeAll(async () => {
    h = await startHarness();
    admin = await h.adminSession();
    doctor = await h.doctor();
  });
  afterAll(() => h.stop());

  it('streams a CSV with the documented columns and one row per appointment', async () => {
    await insert(1, { status: 'completed', paymentStatus: 'paid' });
    await insert(2, { status: 'cancelled', date: '2026-03-06' });
    const res = await h.request.get('/api/admin/appointments/export').set(as());
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/csv/);
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['transfer-encoding']).toBe('chunked');

    const rows = parseCsv(res.text);
    expect(rows[0]).toEqual([
      'id',
      'date',
      'time',
      'patient',
      'patientEmail',
      'doctor',
      'speciality',
      'status',
      'paymentStatus',
      'fee',
      'currency',
      'createdAt',
    ]);
    expect(rows).toHaveLength(3);
    const completed = rows.find((r) => r[3] === 'Patient 1');
    expect(completed.slice(1, 11)).toEqual([
      '2026-03-05',
      '10:00',
      'Patient 1',
      'p1@example.com',
      'Dr. Test',
      'General physician',
      'completed',
      'paid',
      '500',
      'INR',
    ]);
    expect(completed[11]).toMatch(/^\d{4}-\d\d-\d\dT.*Z$/);
    expect(completed[0]).toMatch(/^[0-9a-f]{24}$/);
  });

  it('escapes quotes, commas, newlines and formula prefixes', async () => {
    await Appointment.deleteMany({});
    const nasty = [
      '=HYPERLINK("http://evil.example","click")',
      '+1+1',
      '-2+3',
      '@SUM(A1)',
      'Smith, John',
      'Line one\nLine two',
      'He said "hi"',
    ];
    for (const [i, name] of nasty.entries())
      await insert(i + 10, { patientInfo: { name, email: 'x@example.com' } });

    const res = await h.request.get('/api/admin/appointments/export').set(as());
    const rows = parseCsv(res.text).slice(1);
    const names = rows.map((r) => r[3]);
    expect(names).toHaveLength(nasty.length);
    for (const name of nasty) {
      const stored = /^[=+\-@]/.test(name) ? `'${name}` : name;
      expect(names, name).toContain(stored);
    }
    expect(names.filter((n) => /^[=+\-@]/.test(n))).toEqual([]);
    expect(res.text).toContain('"Smith, John"');
    expect(res.text).toContain('"He said ""hi"""');
    expect(res.text).toContain('"Line one\nLine two"');
    expect(rows.every((r) => r.length === 12)).toBe(true);
  });

  it('applies the same filters as the appointment list', async () => {
    await Appointment.deleteMany({});
    await insert(21, { status: 'booked', date: '2026-03-05' });
    await insert(22, { status: 'cancelled', date: '2026-03-07' });
    await insert(23, { status: 'completed', date: '2026-03-09' });
    const names = async (query) =>
      parseCsv((await h.request.get('/api/admin/appointments/export').set(as()).query(query)).text)
        .slice(1)
        .map((r) => r[3]);
    expect(await names({ status: 'cancelled' })).toEqual(['Patient 22']);
    expect(await names({ from: '2026-03-06', to: '2026-03-08' })).toEqual(['Patient 22']);
    expect(await names({ doctorId: doctor.id })).toHaveLength(3);
    expect(await names({ doctorId: '64b64b64b64b64b64b64b64b' })).toEqual([]);
    const bad = await h.request.get('/api/admin/appointments/export').set(as()).query({ status: 'nope' });
    expect(bad.status).toBe(400);
  });

  it('exports only the header for no matches and streams large sets in full', async () => {
    await Appointment.deleteMany({});
    const empty = await h.request.get('/api/admin/appointments/export').set(as());
    expect(parseCsv(empty.text)).toHaveLength(1);

    await Appointment.insertMany(
      Array.from({ length: 450 }, (_, i) => ({
        patient: doctor.doctor._id,
        doctor: doctor.doctor._id,
        patientInfo: { name: `Bulk ${i}`, email: `b${i}@example.com` },
        doctorInfo: {
          name: 'Dr. Test',
          speciality: 'general-physician',
          specialityName: 'General physician',
        },
        date: '2026-03-05',
        time: '10:00',
        startsAt: new Date(Date.UTC(2026, 2, 5) + i * 1000),
        endsAt: new Date(Date.UTC(2026, 2, 5) + i * 1000 + 1000),
        timezone: 'Asia/Kathmandu',
        fee: 100,
        currency: 'INR',
      })),
    );
    const res = await h.request.get('/api/admin/appointments/export').set(as());
    const rows = parseCsv(res.text);
    expect(rows).toHaveLength(451);
    expect(new Set(rows.slice(1).map((r) => r[0])).size).toBe(450);
  });
});
