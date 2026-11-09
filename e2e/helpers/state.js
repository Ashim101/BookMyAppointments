import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { runDir } from '../scripts/stack.mjs';

// The spec files run in order and hand data to each other (for example the appointment a patient booked).
const file = path.join(runDir, 'state.json');

export const readState = () => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {});
export const writeState = (patch) => writeFileSync(file, JSON.stringify({ ...readState(), ...patch }, null, 2));
