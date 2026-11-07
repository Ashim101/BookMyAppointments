import mongoose from 'mongoose';

export async function connectDatabase(uri, options = {}) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000, ...options });
  // Unique indexes are what prevent double booking, so wait for them before serving traffic.
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}

export const disconnectDatabase = () => mongoose.disconnect();

export const isDatabaseUp = () => mongoose.connection.readyState === 1;
