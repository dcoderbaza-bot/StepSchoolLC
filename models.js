import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['boss', 'admin', 'teacher', 'student'], required: true },
  full_name: { type: String, default: '' },
  phone: { type: String, default: '' },
  phone2: { type: String, default: '' },
  active: { type: Number, default: 1 },
  salary_percent: { type: Number, default: 40 },
  fixed_salary: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now }
});

const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  level: { type: String, default: 'Beginner' },
  teacher_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  room: { type: String, default: '' },
  time: { type: String, default: '' },
  days: { type: String, default: '' },
  price: { type: Number, default: 470000 },
  active: { type: Number, default: 1 },
  created_at: { type: Date, default: Date.now }
});

const PaymentSchema = new mongoose.Schema({
  student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  student_name: { type: String }, // Cache name for faster display
  amount: { type: Number, required: true },
  month: { type: String, required: true },
  receipt_id: { type: String },
  date: { type: Date, default: Date.now }
});

const AttendanceSchema = new mongoose.Schema({
  group_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  date: { type: String, required: true },
  absentees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

const ExamSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: String, required: true },
  type: { type: String, default: 'Mock' },
  files: {
    audio: { type: String },
    pdf: { type: String }
  },
  created_at: { type: Date, default: Date.now }
});

const ResultSchema = new mongoose.Schema({
  exam_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam' },
  student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  student_name: { type: String },
  scores: {
    listening: { type: Number, default: 0 },
    reading: { type: Number, default: 0 },
    writing: { type: Number, default: 0 },
    speaking: { type: Number, default: 0 },
    overall: { type: Number, default: 0 }
  },
  date: { type: Date, default: Date.now }
});

export const User = mongoose.model('User', UserSchema);
export const Group = mongoose.model('Group', GroupSchema);
export const Payment = mongoose.model('Payment', PaymentSchema);
export const Attendance = mongoose.model('Attendance', AttendanceSchema);
export const Exam = mongoose.model('Exam', ExamSchema);
export const Result = mongoose.model('Result', ResultSchema);
