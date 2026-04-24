import mongoose from 'mongoose';

export default async function connectDB() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error('MONGO_URI topilmadi. .env faylini yoki hosting env vars ni tekshiring.');
  }

  mongoose.set('strictQuery', true);

  try {
    const connection = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000
    });

    console.log(`MongoDB connected: ${connection.connection.host}`);
  } catch (error) {
    const message = String(error?.message || '');

    if (message.includes('querySrv ECONNREFUSED')) {
      throw new Error(
        'MongoDB SRV DNS xatosi: `mongodb+srv` ni o`qib bo`lmadi. DNS yoki internetni tekshiring, yoki `mongodb://` direct URI ishlating.'
      );
    }

    if (message.includes('whitelist')) {
      throw new Error(
        'MongoDB Atlas IP ruxsati yo`q. Atlas > Network Access ga kirib hozirgi IP manzilingizni (yoki test uchun 0.0.0.0/0) qo`shing.'
      );
    }

    throw error;
  }
}
