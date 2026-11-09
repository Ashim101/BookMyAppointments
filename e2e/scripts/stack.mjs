// Single source of truth for the ports, URLs and throwaway credentials used by the e2e stack.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const runDir = path.join(root, 'e2e', '.run');

export const ports = { api: 4100, patient: 5273, staff: 5274, mongo: 27019 };
export const urls = {
  api: `http://127.0.0.1:${ports.api}`,
  patient: `http://127.0.0.1:${ports.patient}`,
  staff: `http://127.0.0.1:${ports.staff}`,
};
export const mongoUri =
  process.env.E2E_MONGODB_URI ?? `mongodb://127.0.0.1:${ports.mongo}/bma_e2e`;

/** Dev-only credentials. They protect a database that is wiped on every run. */
export const admin = { email: 'admin@e2e.example.com', password: 'Admin#E2e12345' };
export const demoPatient = { email: 'demo.patient@example.com', password: 'Demo@12345' };
export const doctorPassword = 'Doctor@12345';

export const backendLog = path.join(runDir, 'backend.log');
