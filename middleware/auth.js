import jwt from 'jsonwebtoken';
import { User } from '../models/Schema.js';

const TOKEN_EXPIRES_IN = '7d';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET topilmadi. Environment sozlamalarini tekshiring.');
  }

  return secret;
}

export function generateToken(user) {
  return jwt.sign(
    {
      id: String(user._id),
      role: user.role,
      username: user.username
    },
    getJwtSecret(),
    { expiresIn: TOKEN_EXPIRES_IN }
  );
}

export async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    return res.status(401).json({ error: 'Token kerak' });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());
    const user = await User.findById(payload.id).lean();

    if (!user || !user.active) {
      return res.status(401).json({ error: 'Foydalanuvchi faollashtirilmagan' });
    }

    req.user = {
      id: String(user._id),
      username: user.username,
      role: user.role,
      full_name: user.full_name
    };

    next();
  } catch (_error) {
    return res.status(401).json({ error: 'Token yaroqsiz yoki muddati tugagan' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Bu amal uchun ruxsat yo\'q' });
    }

    next();
  };
}
