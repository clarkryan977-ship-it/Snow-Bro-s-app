const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'snowbros-lawncare-secret-2024';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  // Also accept token via query string (for file download in new tab)
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;
  if (!token) return res.status(401).json({ error: 'Access denied' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Admin or Manager access required' });
  }
  next();
}

module.exports = { authenticateToken, requireAdmin, JWT_SECRET };
