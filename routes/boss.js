import { Router } from 'express';
import db from '../database.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);
router.use(requireRole('boss'));

// Dashboard stats
router.get('/dashboard', (req, res) => {
  const income = db.prepare('SELECT COALESCE(SUM(amount),0) as total FROM payments').get();
  const expense = db.prepare('SELECT COALESCE(SUM(amount),0) as total FROM expenses').get();
  const salaries = db.prepare('SELECT COALESCE(SUM(total),0) as total FROM teacher_salaries').get();

  res.json({
    total_income: income.total,
    total_expense: expense.total + salaries.total,
    profit: income.total - expense.total - salaries.total,
    student_count: db.prepare('SELECT COUNT(*) as c FROM users WHERE role="student" AND active=1').get().c,
    teacher_count: db.prepare('SELECT COUNT(*) as c FROM users WHERE role="teacher" AND active=1').get().c,
    group_count: db.prepare('SELECT COUNT(*) as c FROM groups WHERE active=1').get().c
  });
});

// All groups with payment info
router.get('/groups', (req, res) => {
  const groups = db.prepare(`
    SELECT g.*, u.full_name as teacher_name,
    (SELECT COUNT(*) FROM group_students gs WHERE gs.group_id = g.id AND gs.active = 1) as student_count,
    (SELECT COALESCE(SUM(p.amount),0) FROM payments p WHERE p.group_id = g.id) as total_payments
    FROM groups g LEFT JOIN users u ON g.teacher_id = u.id WHERE g.active = 1 ORDER BY g.name
  `).all();
  res.json(groups);
});

// All payments
router.get('/payments', (req, res) => {
  const { month } = req.query;
  let sql = `SELECT p.*, u.full_name as student_name, g.name as group_name FROM payments p JOIN users u ON p.student_id = u.id JOIN groups g ON p.group_id = g.id WHERE 1=1`;
  const params = [];
  if (month) { sql += ' AND p.month = ?'; params.push(month); }
  sql += ' ORDER BY p.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

// Reports
router.get('/reports', (req, res) => {
  const monthlyIncome = db.prepare('SELECT month, SUM(amount) as total FROM payments GROUP BY month ORDER BY month DESC LIMIT 12').all();
  const monthlyExpense = db.prepare(`SELECT strftime('%Y-%m', created_at) as month, SUM(amount) as total FROM expenses GROUP BY month ORDER BY month DESC LIMIT 12`).all();
  const salaries = db.prepare(`SELECT s.*, u.full_name as teacher_name FROM teacher_salaries s JOIN users u ON s.teacher_id = u.id ORDER BY s.created_at DESC LIMIT 50`).all();

  res.json({ monthly_income: monthlyIncome, monthly_expense: monthlyExpense, salaries });
});

export default router;
