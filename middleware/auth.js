const jwt = require('jsonwebtoken');

const JWT_SECRET = 'duocheck_secret_key_2024';

function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: '未提供认证令牌' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.id, username: decoded.username, is_admin: decoded.is_admin || 0 };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: '认证令牌无效或已过期' });
  }
}

module.exports = { authMiddleware, JWT_SECRET };
