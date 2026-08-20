import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../../lib/db.js';

export async function login(email, password) {
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];
  if (!user) throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  return issueToken(user);
}

export async function loginAsDemoUser(userId) {
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [userId]);
  const user = rows[0];
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  return issueToken(user);
}

function issueToken(user) {
  const payload = { userId: user.id, role: user.role, venueId: user.venue_id, name: user.name, email: user.email };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '12h' });
  return { token, user: payload };
}

export async function listDemoAccounts() {
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.role, u.venue_id, v.name AS venue_name
     FROM users u LEFT JOIN venues v ON v.id = u.venue_id
     WHERE u.hide_from_demo_picker = false
     ORDER BY u.role, u.name`
  );
  return rows;
}
