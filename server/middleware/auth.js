const jwt = require('jsonwebtoken');

// JWT_SECRET must be provided via environment variable (set in the hosting
// provider's dashboard). No hardcoded fallback: a missing secret is a
// deployment configuration error and should fail loudly at startup.
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Set it in your hosting provider (e.g. Railway/Render) before starting the server.');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

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
