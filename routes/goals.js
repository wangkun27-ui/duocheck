const express = require('express');
const { db } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// All routes require auth
router.use(authMiddleware);

// POST /api/goals/ - create goal for self
router.post('/', (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title || title.trim().length === 0) {
      return res.status(400).json({ success: false, error: '请输入目标标题' });
    }

    const result = db.prepare(
      'INSERT INTO goals (user_id, title, description) VALUES (?, ?, ?)'
    ).run(req.user.id, title.trim(), description || null);

    const goal = db.prepare('SELECT * FROM goals WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({ success: true, data: goal });
  } catch (err) {
    console.error('Create goal error:', err);
    res.status(500).json({ success: false, error: '创建目标失败' });
  }
});

// GET /api/goals/ - get own goals
router.get('/', (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM goals WHERE user_id = ?';
    const params = [req.user.id];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const goals = db.prepare(query).all(...params);
    res.json({ success: true, data: { goals } });
  } catch (err) {
    console.error('Get goals error:', err);
    res.status(500).json({ success: false, error: '获取目标列表失败' });
  }
});

// GET /api/goals/partner/:userId - get a partner's active goals
router.get('/partner/:userId', (req, res) => {
  try {
    const partnerId = parseInt(req.params.userId);
    const userId = req.user.id;

    // Verify they are partners
    const partnership = db.prepare(`
      SELECT id FROM partnerships
      WHERE ((user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?))
        AND status = 'active'
    `).get(userId, partnerId, partnerId, userId);

    if (!partnership) {
      return res.status(403).json({ success: false, error: '你们不是搭档关系' });
    }

    const goals = db.prepare(
      'SELECT * FROM goals WHERE user_id = ? AND status = ? ORDER BY created_at DESC'
    ).all(partnerId, 'active');

    res.json({ success: true, data: { goals } });
  } catch (err) {
    console.error('Get partner goals error:', err);
    res.status(500).json({ success: false, error: '获取搭档目标失败' });
  }
});

// PUT /api/goals/:id - update own goal
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status } = req.body;

    const goal = db.prepare('SELECT * FROM goals WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!goal) {
      return res.status(404).json({ success: false, error: '目标不存在或无权修改' });
    }

    const updates = {};
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description;
    if (status !== undefined) {
      if (!['active', 'completed', 'abandoned'].includes(status)) {
        return res.status(400).json({ success: false, error: '无效的状态值' });
      }
      updates.status = status;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: '没有需要更新的内容' });
    }

    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(updates);

    db.prepare(`UPDATE goals SET ${setClauses} WHERE id = ?`).run(...values, id);

    const updated = db.prepare('SELECT * FROM goals WHERE id = ?').get(id);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Update goal error:', err);
    res.status(500).json({ success: false, error: '更新目标失败' });
  }
});

module.exports = router;
