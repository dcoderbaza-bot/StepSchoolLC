import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../database.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import OpenAI from 'openai';

const router = Router();
router.use(authMiddleware);
router.use(requireRole('teacher'));

// My groups
router.get('/groups', (req, res) => {
  const groups = db.prepare(`
    SELECT g.*, (SELECT COUNT(*) FROM group_students gs WHERE gs.group_id = g.id AND gs.active = 1) as student_count
    FROM groups g WHERE g.teacher_id = ? AND g.active = 1 ORDER BY g.name
  `).all(req.user.id);
  res.json(groups);
});

// Group students
router.get('/groups/:id/students', (req, res) => {
  const group = db.prepare('SELECT * FROM groups WHERE id = ? AND teacher_id = ?').get(req.params.id, req.user.id);
  if (!group) return res.status(403).json({ error: 'Bu sizning guruhingiz emas' });

  const students = db.prepare(`
    SELECT u.id, u.username, u.full_name, u.phone, gs.joined_at
    FROM group_students gs JOIN users u ON gs.student_id = u.id
    WHERE gs.group_id = ? AND gs.active = 1 ORDER BY u.full_name
  `).all(req.params.id);
  res.json(students);
});

// Create student in group
router.post('/students', (req, res) => {
  const { username, password, full_name, phone, group_id } = req.body;
  if (!username || !password || !group_id) return res.status(400).json({ error: 'Username, parol va guruh kerak' });

  const group = db.prepare('SELECT * FROM groups WHERE id = ? AND teacher_id = ?').get(group_id, req.user.id);
  if (!group) return res.status(403).json({ error: 'Bu sizning guruhingiz emas' });

  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(400).json({ error: 'Bu username band' });

  const hash = bcrypt.hashSync(password, 10);
  const tx = db.transaction(() => {
    const result = db.prepare('INSERT INTO users (username, password, role, full_name, phone) VALUES (?,?,?,?,?)').run(username, hash, 'student', full_name || '', phone || '');
    db.prepare('INSERT INTO group_students (group_id, student_id) VALUES (?,?)').run(group_id, result.lastInsertRowid);
    return result.lastInsertRowid;
  });
  const studentId = tx();
  res.json({ id: studentId, message: 'O\'quvchi yaratildi' });
});

// === LESSONS ===
router.get('/lessons', (req, res) => {
  const { group_id } = req.query;
  let sql = 'SELECT * FROM lessons WHERE teacher_id = ?';
  const params = [req.user.id];
  if (group_id) { sql += ' AND group_id = ?'; params.push(group_id); }
  sql += ' ORDER BY order_num, created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

router.post('/lessons', (req, res) => {
  const { group_id, title, video_url, description, order_num } = req.body;
  if (!group_id || !title) return res.status(400).json({ error: 'Guruh va sarlavha kerak' });

  const group = db.prepare('SELECT * FROM groups WHERE id = ? AND teacher_id = ?').get(group_id, req.user.id);
  if (!group) return res.status(403).json({ error: 'Bu sizning guruhingiz emas' });

  const result = db.prepare('INSERT INTO lessons (group_id, teacher_id, title, video_url, description, order_num) VALUES (?,?,?,?,?,?)').run(group_id, req.user.id, title, video_url || '', description || '', order_num || 0);
  res.json({ id: result.lastInsertRowid, message: 'Dars qo\'shildi' });
});

router.put('/lessons/:id', (req, res) => {
  const { title, video_url, description, order_num } = req.body;
  db.prepare('UPDATE lessons SET title=?, video_url=?, description=?, order_num=? WHERE id=? AND teacher_id=?').run(title, video_url, description, order_num, req.params.id, req.user.id);
  res.json({ message: 'Yangilandi' });
});

router.delete('/lessons/:id', (req, res) => {
  db.prepare('DELETE FROM lessons WHERE id=? AND teacher_id=?').run(req.params.id, req.user.id);
  res.json({ message: 'O\'chirildi' });
});

// === TESTS ===
router.get('/tests', (req, res) => {
  const { group_id } = req.query;
  let sql = 'SELECT id, group_id, teacher_id, title, time_limit, created_at FROM tests WHERE teacher_id = ?';
  const params = [req.user.id];
  if (group_id) { sql += ' AND group_id = ?'; params.push(group_id); }
  sql += ' ORDER BY created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

// AI generate test
router.post('/tests/generate', async (req, res) => {
  const { group_id, topic, question_count, difficulty } = req.body;
  if (!group_id || !topic) return res.status(400).json({ error: 'Guruh va mavzu kerak' });

  const apiKey = db.prepare("SELECT value FROM settings WHERE key = 'openai_key'").get()?.value;
  if (!apiKey) return res.status(400).json({ error: 'OpenAI API key sozlamalarda kiritilmagan' });

  try {
    const openai = new OpenAI({ apiKey });
    const count = question_count || 10;
    const diff = difficulty || 'intermediate';

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'system',
        content: 'You are an English language test generator. Generate multiple choice questions in JSON format.'
      }, {
        role: 'user',
        content: `Generate ${count} English language test questions about "${topic}" at ${diff} level. Return ONLY valid JSON array with format: [{"question":"...","options":["A)...","B)...","C)...","D)..."],"correct":0}] where correct is the index of the right answer (0-3).`
      }],
      temperature: 0.7
    });

    let questions;
    try {
      const content = completion.choices[0].message.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      questions = JSON.parse(content);
    } catch {
      return res.status(500).json({ error: 'AI javobini o\'qib bo\'lmadi' });
    }

    const result = db.prepare('INSERT INTO tests (group_id, teacher_id, title, questions, time_limit) VALUES (?,?,?,?,?)').run(group_id, req.user.id, `${topic} - Test`, JSON.stringify(questions), 30);
    res.json({ id: result.lastInsertRowid, question_count: questions.length, message: 'Test yaratildi' });
  } catch (err) {
    res.status(500).json({ error: 'AI xatosi: ' + err.message });
  }
});

router.post('/tests/manual', (req, res) => {
  const { group_id, title, questions, time_limit } = req.body;
  if (!group_id || !title || !questions) return res.status(400).json({ error: 'Ma\'lumotlar kerak' });
  const result = db.prepare('INSERT INTO tests (group_id, teacher_id, title, questions, time_limit) VALUES (?,?,?,?,?)').run(group_id, req.user.id, title, JSON.stringify(questions), time_limit || 30);
  res.json({ id: result.lastInsertRowid, message: 'Test yaratildi' });
});

router.delete('/tests/:id', (req, res) => {
  db.prepare('DELETE FROM tests WHERE id=? AND teacher_id=?').run(req.params.id, req.user.id);
  res.json({ message: 'O\'chirildi' });
});

// My salary
router.get('/salary', (req, res) => {
  const salaries = db.prepare('SELECT * FROM teacher_salaries WHERE teacher_id = ? ORDER BY month DESC').all(req.user.id);
  res.json(salaries);
});

export default router;
