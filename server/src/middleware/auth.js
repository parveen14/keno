import jwt from 'jsonwebtoken';

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  // File-download links (invoice/report export) open via window.open, which can't set headers -- allow ?token= as a fallback.
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : req.query.token;
  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
