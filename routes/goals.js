const express = require('express');
const { db } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// All routes require auth
router.use(authMiddleware);

// POST /api/goals/ - create goal for self
router.post('/', async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title || title.trim().length === 0) {
      return res.status(400).json({ success: false, error: '请输入目标标题' });
    }

    const result = await db.run(
      'INSERT INTO goals (user_id, title, description) VALUES (?, ?, ?)',
      [req.user.id, title.trim(), description || null]
    );

    const goal = await db.get('SELECT * FROM goals WHERE id = ?', [result.lastInsertRowid]);

    res.status(201).json({ success: true, data: goal });
  } catch (err) {
    console.error('Create goal error:', err);
    res.status(500).json({ success: false, error: '创建目标失败' });
  }
});

// GET /api/goals/ - get own goals
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM goals WHERE user_id = ?';
    const params = [req.user.id];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const goals = await db.all(query, params);
    res.json({ success: true, data: { goals } });
  } catch (err) {
    console.error('Get goals error:', err);
    res.status(500).json({ success: false, error: '获取目标列表失败' });
  }
});

// GET /api/goals/partner/:userId - get a partner's active goals
router.get('/partner/:userId', async (req, res) => {
  try {
    const partnerId = parseInt(req.params.userId);
    const userId = req.user.id;

    // Verify they are partners
    const partnership = await db.get(`
      SELECT id FROM partnerships
      WHERE ((user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?))
        AND status = 'active'
    `, [userId, partnerId, partnerId, userId]);

    if (!partnership) {
      return res.status(403).json({ success: false, error: '你们不是搭档关系' });
    }

    const goals = await db.all(
      'SELECT * FROM goals WHERE user_id = ? AND status = ? ORDER BY created_at DESC',
      [partnerId, 'active']
    );

    res.json({ success: true, data: { goals } });
  } catch (err) {
    console.error('Get partner goals error:', err);
    res.status(500).json({ success: false, error: '获取搭档目标失败' });
  }
});

// PUT /api/goals/:id - update own goal
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status } = req.body;

    const goal = await db.get('SELECT * FROM goals WHERE id = ? AND user_id = ?', [id, req.user.id]);
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

    await db.run(`UPDATE goals SET ${setClauses} WHERE id = ?`, [...values, id]);

    const updated = await db.get('SELECT * FROM goals WHERE id = ?', [id]);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Update goal error:', err);
    res.status(500).json({ success: false, error: '更新目标失败' });
  }
});

// DELETE /api/goals/:id - delete own goal (completely remove goal and its checkins)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify goal exists and belongs to user
    const goal = await db.get('SELECT * FROM goals WHERE id = ? AND user_id = ?', [id, userId]);
    if (!goal) {
      return res.status(404).json({ success: false, error: '目标不存在或无权删除' });
    }

    // Use a transaction to delete goal and its related checkins
    await db.transaction(async (tx) => {
      // 1. Delete all checkins associated with this goal
      await tx.run('DELETE FROM checkins WHERE goal_id = ?', [id]);
      // 2. Delete the goal itself
      await tx.run('DELETE FROM goals WHERE id = ?', [id]);
    });

    res.json({ success: true, data: { message: '目标及打卡记录已彻底删除' } });
  } catch (err) {
    console.error('Delete goal error:', err);
    res.status(500).json({ success: false, error: '删除目标失败' });
  }
});

module.exports = router;
