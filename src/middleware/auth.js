import jwt from 'jsonwebtoken';

export function authRequired(req, res, next){
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if(!token) return res.status(401).json({ error: 'Unauthorized' });
  try{
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    req.user = payload; // { id, role, name }
    next();
  } catch(err){
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function adminOnly(req, res, next){
  if(req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
}
