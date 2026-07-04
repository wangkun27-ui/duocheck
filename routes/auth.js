const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../database');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate username: 3-20 chars, alphanumeric + underscore
    if (!username || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({
        success: false,
        error: '用户名必须为3-20个字符，只能包含字母、数字和下划线'
      });
    }

    // Validate password: min 6 chars
    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        error: '密码至少需要6个字符'
      });
    }

    // Check if username already exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: '用户名已被注册'
      });
    }

    // Hash password and insert user
    const passwordHash = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, passwordHash);

    const token = jwt.sign(
      { id: result.lastInsertRowid, username, is_admin: 0 },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      data: {
        token,
        user: { id: result.lastInsertRowid, username, is_admin: 0 }
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, error: '注册失败，请稍后重试' });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: '请提供用户名和密码'
      });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: '用户名或密码错误'
      });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: '用户名或密码错误'
      });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, is_admin: user.is_admin || 0 },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, username: user.username, is_admin: user.is_admin || 0 }
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: '登录失败，请稍后重试' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;

    const user = db.prepare('SELECT id, username, is_admin, created_at FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    // Total checkins
    const totalCheckins = db.prepare('SELECT COUNT(*) as count FROM checkins WHERE user_id = ?').get(userId).count;

    // Calculate streak efficiently in-memory to reduce database queries
    const checkinDatesList = db.prepare('SELECT DISTINCT date FROM checkins WHERE user_id = ? ORDER BY date DESC').all(userId);
    const checkinDates = new Set(checkinDatesList.map(c => c.date));
    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    const checkDate = new Date(today);

    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (checkinDates.has(dateStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        // Allow streak to continue if they haven't checked in yet today, but did yesterday
        if (dateStr === today && streak === 0) {
          checkDate.setDate(checkDate.getDate() - 1);
          continue;
        }
        break;
      }
    }

    // Active goals count
    const activeGoals = db.prepare(
      'SELECT COUNT(*) as count FROM goals WHERE user_id = ? AND status = ?'
    ).get(userId, 'active').count;

    // Partner count (active partnerships)
    const partnerCount = db.prepare(
      'SELECT COUNT(*) as count FROM partnerships WHERE (user1_id = ? OR user2_id = ?) AND status = ?'
    ).get(userId, userId, 'active').count;

    res.json({
      success: true,
      data: {
        user,
        stats: {
          totalCheckins,
          total_checkins: totalCheckins,
          streak,
          activeGoals,
          active_goals: activeGoals,
          partnerCount,
          partner_count: partnerCount
        }
      }
    });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ success: false, error: '获取用户信息失败' });
  }
});

module.exports = router;
