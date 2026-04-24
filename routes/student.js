import { Router } from 'express';
import db from '../database.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);
router.use(requireRole('student'));

// My groups
router.get('/groups', (req, res) => {
  const groups = db.prepare(`
    SELECT g.*, u.full_name as teacher_name
    FROM group_students gs JOIN groups g ON gs.group_id = g.id LEFT JOIN users u ON g.teacher_id = u.id
    WHERE gs.student_id = ? AND gs.active = 1 AND g.active = 1
  `).all(req.user.id);
  res.json(groups);
});

// Lessons for my groups
router.get('/lessons', (req, res) => {
  const { group_id } = req.query;
  const myGroups = db.prepare('SELECT group_id FROM group_students WHERE student_id = ? AND active = 1').all(req.user.id).map(g => g.group_id);
  if (group_id && !myGroups.includes(Number(group_id))) return res.status(403).json({ error: 'Ruxsat yo\'q' });

  const ids = group_id ? [group_id] : myGroups;
  if (ids.length === 0) return res.json([]);

  const placeholders = ids.map(() => '?').join(',');
  const lessons = db.prepare(`SELECT l.*, g.name as group_name FROM lessons l JOIN groups g ON l.group_id = g.id WHERE l.group_id IN (${placeholders}) ORDER BY l.order_num, l.created_at`).all(...ids);
  res.json(lessons);
});

// Tests for my groups
router.get('/tests', (req, res) => {
  const myGroups = db.prepare('SELECT group_id FROM group_students WHERE student_id = ? AND active = 1').all(req.user.id).map(g => g.group_id);
  if (myGroups.length === 0) return res.json([]);

  const placeholders = myGroups.map(() => '?').join(',');
  const tests = db.prepare(`SELECT t.id, t.group_id, t.title, t.time_limit, t.created_at, g.name as group_name,
    (SELECT COUNT(*) FROM test_results tr WHERE tr.test_id = t.id AND tr.student_id = ?) as attempted
    FROM tests t JOIN groups g ON t.group_id = g.id WHERE t.group_id IN (${placeholders}) ORDER BY t.created_at DESC`).all(req.user.id, ...myGroups);
  res.json(tests);
});

// Get test questions
router.get('/tests/:id', (req, res) => {
  const test = db.prepare('SELECT * FROM tests WHERE id = ?').get(req.params.id);
  if (!test) return res.status(404).json({ error: 'Test topilmadi' });

  const questions = JSON.parse(test.questions).map(q => ({
    question: q.question,
    options: q.options
  }));
  res.json({ ...test, questions });
});

// Submit test
router.post('/tests/:id/submit', (req, res) => {
  const test = db.prepare('SELECT * FROM tests WHERE id = ?').get(req.params.id);
  if (!test) return res.status(404).json({ error: 'Test topilmadi' });

  const existing = db.prepare('SELECT id FROM test_results WHERE test_id = ? AND student_id = ?').get(req.params.id, req.user.id);
  if (existing) return res.status(400).json({ error: 'Siz bu testni allaqachon yechgansiz' });

  const { answers } = req.body;
  const questions = JSON.parse(test.questions);
  let score = 0;
  answers.forEach((a, i) => {
    if (questions[i] && a === questions[i].correct) score++;
  });

  const result = db.prepare('INSERT INTO test_results (test_id, student_id, answers, score, total) VALUES (?,?,?,?,?)').run(req.params.id, req.user.id, JSON.stringify(answers), score, questions.length);
  res.json({ score, total: questions.length, percentage: Math.round((score / questions.length) * 100) });
});

// My test results
router.get('/results', (req, res) => {
  const results = db.prepare(`
    SELECT tr.*, t.title as test_title, g.name as group_name
    FROM test_results tr JOIN tests t ON tr.test_id = t.id JOIN groups g ON t.group_id = g.id
    WHERE tr.student_id = ? ORDER BY tr.completed_at DESC
  `).all(req.user.id);
  res.json(results);
});

// My payments
router.get('/payments', (req, res) => {
  const payments = db.prepare(`
    SELECT p.*, g.name as group_name FROM payments p JOIN groups g ON p.group_id = g.id
    WHERE p.student_id = ? ORDER BY p.created_at DESC
  `).all(req.user.id);
  res.json(payments);
});

export default router;
