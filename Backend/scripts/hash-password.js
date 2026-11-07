import bcrypt from 'bcrypt';

const password = process.argv[2];
const ROUNDS = 12;

if (!password) {
  console.error('Usage: npm run hash-password -- <password>');
  process.exit(1);
}

const hash = await bcrypt.hash(password, ROUNDS);
console.log(hash);
console.error('\nPut it in .env as ADMIN_PASSWORD_HASH (wrap it in single quotes if your shell or tooling expands "$").');
