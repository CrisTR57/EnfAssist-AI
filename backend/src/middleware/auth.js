const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const authorization = req.get('authorization') || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'missing_bearer_token' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'jwt_secret_not_configured' });
  }

  try {
    const payload = jwt.verify(token, secret);
    if (!payload || typeof payload !== 'object' || !payload.sub || !payload.role) {
      return res.status(401).json({ error: 'invalid_token_payload' });
    }
    req.auth = { userId: String(payload.sub), role: String(payload.role) };
    return next();
  } catch (_error) {
    return res.status(401).json({ error: 'invalid_or_expired_token' });
  }
}

function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.auth) return res.status(401).json({ error: 'authentication_required' });
    if (!roles.includes(req.auth.role)) return res.status(403).json({ error: 'insufficient_role' });
    return next();
  };
}

module.exports = { authenticateToken, authorizeRoles };
