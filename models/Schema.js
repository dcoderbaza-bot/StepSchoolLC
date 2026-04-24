import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['boss', 'admin', 'teacher', 'student', 'support_teacher', 'manager', 'cleaner'], default: 'student' },
  full_name: { type: String, required: true },
  phone: String,
  phone2: String,
  fixed_salary: Number,
  salary_percent: Number,
  balance: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now }
});

const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  level: String,
  teacher_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  support_teacher_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  monthly_price: { type: Number, default: 0 },
  schedule: String,
  days: String,
  time: String,
  room: String,
  active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now }
});

const PaymentSchema = new mongoose.Schema({
  student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['cash', 'card', 'transfer'], default: 'cash' },
  date: { type: Date, default: Date.now },
  note: String
});

const ExpenseSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  note: String,
  date: { type: Date, default: Date.now }
});

const AttendanceSchema = new mongoose.Schema({
  student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  group_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  status: { type: String, enum: ['present', 'absent'], default: 'present' },
  date: { type: Date, default: Date.now }
});

export const User = mongoose.model('User', UserSchema);
export const Group = mongoose.model('Group', GroupSchema);
export const Payment = mongoose.model('Payment', PaymentSchema);
export const Expense = mongoose.model('Expense', ExpenseSchema);
export const Attendance = mongoose.model('Attendance', AttendanceSchema);
