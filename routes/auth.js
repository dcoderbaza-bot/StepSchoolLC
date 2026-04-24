import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/Schema.js';
import { authMiddleware, generateToken } from '../middleware/auth.js';

const router = Router();

function sanitizeUser(user) {
  return {
    id: String(user._id),
    username: user.username,
    role: user.role,
    full_name: user.full_name,
    phone: user.phone || ''
  };
}

router.get('/status', async (_req, res) => {
  try {
    const boss = await User.findOne({ role: 'boss' }).lean();
    res.json({ setup: Boolean(boss) });
  } catch (_error) {
    res.status(500).json({ error: 'Tizim holatini tekshirib bo\'lmadi' });
  }
});

router.post('/setup', async (req, res) => {
  try {
    const existingBoss = await User.findOne({ role: 'boss' }).lean();

    if (existingBoss) {
      return res.status(400).json({ error: 'Boshlang\'ich boss foydalanuvchi allaqachon yaratilgan' });
    }

    const fullName = String(req.body.full_name || '').trim();
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!fullName || !username || password.length < 6) {
      return res.status(400).json({ error: 'To\'liq ism, username va kamida 6 belgili parol kiriting' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      full_name: fullName,
      username,
      password: passwordHash,
      role: 'boss',
      active: true
    });

    res.status(201).json({
      token: generateToken(user),
      user: sanitizeUser(user)
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ error: 'Bu username allaqachon band' });
    }

    res.status(500).json({ error: 'Boss foydalanuvchini yaratib bo\'lmadi' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!username || !password) {
      return res.status(400).json({ error: 'Username va parol kerak' });
    }

    const user = await User.findOne({ username }).lean();

    if (!user || !user.active) {
      return res.status(401).json({ error: 'Foydalanuvchi topilmadi yoki faol emas' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: 'Login yoki parol noto\'g\'ri' });
    }

    res.json({
      token: generateToken(user),
      user: sanitizeUser(user)
    });
  } catch (_error) {
    res.status(500).json({ error: 'Tizimga kirib bo\'lmadi' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();

    if (!user) {
      return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    }

    res.json({ user: sanitizeUser(user) });
  } catch (_error) {
    res.status(500).json({ error: 'Profilni olib bo\'lmadi' });
  }
});

export default router;
