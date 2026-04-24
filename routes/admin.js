import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { User, Group, Payment, Expense } from '../models/Schema.js';

const router = Router();

router.use(authMiddleware);
router.use(requireRole('boss', 'admin'));

const STAFF_ROLES = ['teacher', 'admin', 'support_teacher', 'manager', 'cleaner'];
const PAYMENT_TYPES = ['cash', 'card', 'transfer'];

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function sanitizeUser(user) {
  return {
    id: String(user._id),
    full_name: user.full_name,
    username: user.username,
    role: user.role,
    phone: user.phone || '',
    phone2: user.phone2 || '',
    salary_percent: user.salary_percent || 0,
    fixed_salary: user.fixed_salary || 0,
    active: Boolean(user.active)
  };
}

function sanitizeGroup(group) {
  return {
    id: String(group._id),
    name: group.name,
    level: group.level || '',
    teacher_id: group.teacher_id?._id ? String(group.teacher_id._id) : (group.teacher_id ? String(group.teacher_id) : ''),
    teacher_name: group.teacher_id?.full_name || '',
    support_teacher_id: group.support_teacher_id?._id ? String(group.support_teacher_id._id) : (group.support_teacher_id ? String(group.support_teacher_id) : ''),
    support_teacher_name: group.support_teacher_id?.full_name || '',
    monthly_price: group.monthly_price || 0,
    days: group.days || '',
    time: group.time || '',
    room: group.room || '',
    active: Boolean(group.active)
  };
}

function sanitizePayment(payment) {
  return {
    id: String(payment._id),
    student_id: payment.student_id?._id ? String(payment.student_id._id) : String(payment.student_id || ''),
    student_name: payment.student_id?.full_name || '',
    amount: payment.amount || 0,
    type: payment.type || 'cash',
    note: payment.note || '',
    date: payment.date
  };
}

router.get('/overview', async (_req, res) => {
  try {
    const [incomeAgg, expenseAgg, studentCount, teacherCount, groupCount, recentPayments] = await Promise.all([
      Payment.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
      Expense.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
      User.countDocuments({ role: 'student', active: true }),
      User.countDocuments({ role: { $in: STAFF_ROLES }, active: true }),
      Group.countDocuments({ active: true }),
      Payment.find().sort({ date: -1 }).limit(5).populate('student_id', 'full_name').lean()
    ]);

    const income = incomeAgg[0]?.total || 0;
    const expense = expenseAgg[0]?.total || 0;

    res.json({
      metrics: {
        income,
        expense,
        profit: income - expense,
        student_count: studentCount,
        teacher_count: teacherCount,
        group_count: groupCount
      },
      recent_payments: recentPayments.map(sanitizePayment)
    });
  } catch (_error) {
    res.status(500).json({ error: 'Dashboard ma\'lumotlarini olib bo\'lmadi' });
  }
});

router.get('/reports', async (_req, res) => {
  try {
    const [incomeAgg, expenseAgg, studentCount, teacherCount, groupCount] = await Promise.all([
      Payment.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
      Expense.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
      User.countDocuments({ role: 'student', active: true }),
      User.countDocuments({ role: { $in: STAFF_ROLES }, active: true }),
      Group.countDocuments({ active: true })
    ]);

    const income = incomeAgg[0]?.total || 0;
    const expense = expenseAgg[0]?.total || 0;

    res.json({
      income,
      expense,
      profit: income - expense,
      student_count: studentCount,
      teacher_count: teacherCount,
      group_count: groupCount
    });
  } catch (_error) {
    res.status(500).json({ error: 'Hisobotlarni olib bo\'lmadi' });
  }
});

router.get('/teachers', async (_req, res) => {
  try {
    const teachers = await User.find({
      role: { $in: STAFF_ROLES }
    }).sort({ full_name: 1 }).lean();

    res.json(teachers.map(sanitizeUser));
  } catch (_error) {
    res.status(500).json({ error: 'Xodimlar ro\'yxatini olib bo\'lmadi' });
  }
});

router.post('/teachers', async (req, res) => {
  try {
    const fullName = String(req.body.full_name || '').trim();
    const username = normalizeUsername(req.body.username);
    const password = String(req.body.password || '');
    const role = String(req.body.role || 'teacher');

    if (!fullName || !username || password.length < 6) {
      return res.status(400).json({ error: 'F.I.SH, username va kamida 6 belgili parol kerak' });
    }

    if (!STAFF_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Noto\'g\'ri rol tanlandi' });
    }

    const user = await User.create({
      full_name: fullName,
      username,
      password: await bcrypt.hash(password, 10),
      role,
      phone: String(req.body.phone || '').trim(),
      salary_percent: Number(req.body.salary_percent || 0),
      fixed_salary: Number(req.body.fixed_salary || 0),
      active: true
    });

    res.status(201).json({ user: sanitizeUser(user) });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ error: 'Bu username allaqachon band' });
    }

    res.status(500).json({ error: 'Xodim yaratilmadi' });
  }
});

router.put('/teachers/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'Xodim topilmadi' });
    }

    user.full_name = String(req.body.full_name || user.full_name).trim();
    user.username = normalizeUsername(req.body.username || user.username);
    const role = String(req.body.role || user.role);
    if (!STAFF_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Noto\'g\'ri rol tanlandi' });
    }
    user.role = role;
    user.phone = String(req.body.phone || '');
    user.salary_percent = Number(req.body.salary_percent || 0);
    user.fixed_salary = Number(req.body.fixed_salary || 0);
    user.active = req.body.active === undefined ? user.active : Boolean(req.body.active);

    const password = String(req.body.password || '');
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Parol kamida 6 belgidan iborat bo\'lishi kerak' });
      }

      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();

    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ error: 'Bu username allaqachon band' });
    }

    res.status(500).json({ error: 'Xodim yangilanmadi' });
  }
});

router.delete('/teachers/:id', async (req, res) => {
  try {
    const deleted = await User.findByIdAndDelete(req.params.id).lean();

    if (!deleted) {
      return res.status(404).json({ error: 'Xodim topilmadi' });
    }

    res.json({ success: true });
  } catch (_error) {
    res.status(500).json({ error: 'Xodim o\'chirilmadi' });
  }
});

router.get('/students', async (_req, res) => {
  try {
    const students = await User.find({ role: 'student' }).sort({ full_name: 1 }).lean();
    res.json(students.map(sanitizeUser));
  } catch (_error) {
    res.status(500).json({ error: 'O\'quvchilar ro\'yxatini olib bo\'lmadi' });
  }
});

router.post('/students', async (req, res) => {
  try {
    const fullName = String(req.body.full_name || '').trim();
    const username = normalizeUsername(req.body.username);
    const password = String(req.body.password || '');

    if (!fullName || !username || password.length < 6) {
      return res.status(400).json({ error: 'F.I.SH, username va kamida 6 belgili parol kerak' });
    }

    const student = await User.create({
      full_name: fullName,
      username,
      password: await bcrypt.hash(password, 10),
      role: 'student',
      phone: String(req.body.phone || '').trim(),
      phone2: String(req.body.phone2 || '').trim(),
      active: true
    });

    res.status(201).json({ user: sanitizeUser(student) });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ error: 'Bu username allaqachon band' });
    }

    res.status(500).json({ error: 'O\'quvchi yaratilmadi' });
  }
});

router.put('/students/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user || user.role !== 'student') {
      return res.status(404).json({ error: 'O\'quvchi topilmadi' });
    }

    user.full_name = String(req.body.full_name || user.full_name).trim();
    user.username = normalizeUsername(req.body.username || user.username);
    user.phone = String(req.body.phone || '');
    user.phone2 = String(req.body.phone2 || '');
    user.active = req.body.active === undefined ? user.active : Boolean(req.body.active);

    const password = String(req.body.password || '');
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Parol kamida 6 belgidan iborat bo\'lishi kerak' });
      }

      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();

    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ error: 'Bu username allaqachon band' });
    }

    res.status(500).json({ error: 'O\'quvchi yangilanmadi' });
  }
});

router.delete('/students/:id', async (req, res) => {
  try {
    const deleted = await User.findOneAndDelete({ _id: req.params.id, role: 'student' }).lean();

    if (!deleted) {
      return res.status(404).json({ error: 'O\'quvchi topilmadi' });
    }

    res.json({ success: true });
  } catch (_error) {
    res.status(500).json({ error: 'O\'quvchi o\'chirilmadi' });
  }
});

router.get('/groups', async (_req, res) => {
  try {
    const groups = await Group.find()
      .populate('teacher_id', 'full_name')
      .populate('support_teacher_id', 'full_name')
      .sort({ name: 1 })
      .lean();

    res.json(groups.map(sanitizeGroup));
  } catch (_error) {
    res.status(500).json({ error: 'Guruhlar ro\'yxatini olib bo\'lmadi' });
  }
});

router.post('/groups', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();

    if (!name) {
      return res.status(400).json({ error: 'Guruh nomi kerak' });
    }

    const group = await Group.create({
      name,
      level: String(req.body.level || 'Beginner').trim(),
      teacher_id: req.body.teacher_id || undefined,
      support_teacher_id: req.body.support_teacher_id || undefined,
      monthly_price: Number(req.body.monthly_price || 0),
      days: String(req.body.days || '').trim(),
      time: String(req.body.time || '').trim(),
      room: String(req.body.room || '').trim(),
      active: true
    });

    const populated = await Group.findById(group._id)
      .populate('teacher_id', 'full_name')
      .populate('support_teacher_id', 'full_name')
      .lean();

    res.status(201).json({ group: sanitizeGroup(populated) });
  } catch (_error) {
    res.status(500).json({ error: 'Guruh yaratilmadi' });
  }
});

router.put('/groups/:id', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ error: 'Guruh topilmadi' });
    }

    group.name = String(req.body.name || group.name).trim();
    group.level = String(req.body.level || group.level || '').trim();
    group.teacher_id = req.body.teacher_id || null;
    group.support_teacher_id = req.body.support_teacher_id || null;
    group.monthly_price = Number(req.body.monthly_price || 0);
    group.days = String(req.body.days || '');
    group.time = String(req.body.time || '');
    group.room = String(req.body.room || '');
    group.active = req.body.active === undefined ? group.active : Boolean(req.body.active);

    await group.save();

    const populated = await Group.findById(group._id)
      .populate('teacher_id', 'full_name')
      .populate('support_teacher_id', 'full_name')
      .lean();

    res.json({ group: sanitizeGroup(populated) });
  } catch (_error) {
    res.status(500).json({ error: 'Guruh yangilanmadi' });
  }
});

router.delete('/groups/:id', async (req, res) => {
  try {
    const deleted = await Group.findByIdAndDelete(req.params.id).lean();

    if (!deleted) {
      return res.status(404).json({ error: 'Guruh topilmadi' });
    }

    res.json({ success: true });
  } catch (_error) {
    res.status(500).json({ error: 'Guruh o\'chirilmadi' });
  }
});

router.get('/payments', async (_req, res) => {
  try {
    const payments = await Payment.find()
      .populate('student_id', 'full_name')
      .sort({ date: -1 })
      .lean();

    res.json(payments.map(sanitizePayment));
  } catch (_error) {
    res.status(500).json({ error: 'To\'lovlar ro\'yxatini olib bo\'lmadi' });
  }
});

router.post('/payments', async (req, res) => {
  try {
    const studentId = String(req.body.student_id || '');
    const amount = Number(req.body.amount || 0);
    const paymentType = String(req.body.type || 'cash');

    if (!studentId || amount <= 0) {
      return res.status(400).json({ error: 'O\'quvchi va musbat summa kerak' });
    }

    if (!PAYMENT_TYPES.includes(paymentType)) {
      return res.status(400).json({ error: 'Noto\'g\'ri to\'lov turi' });
    }

    const student = await User.findOne({ _id: studentId, role: 'student' }).lean();

    if (!student) {
      return res.status(404).json({ error: 'O\'quvchi topilmadi' });
    }

    const payment = await Payment.create({
      student_id: studentId,
      amount,
      type: paymentType,
      note: String(req.body.note || '').trim()
    });

    const populated = await Payment.findById(payment._id).populate('student_id', 'full_name').lean();

    res.status(201).json({ payment: sanitizePayment(populated) });
  } catch (_error) {
    res.status(500).json({ error: 'To\'lov saqlanmadi' });
  }
});

export default router;
