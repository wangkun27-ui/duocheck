const express = require('express');
const { db } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Admin verification middleware
function adminMiddleware(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ success: false, error: '权限不足，只有管理员可执行此操作' });
  }
  next();
}

router.use(authMiddleware);
router.use(adminMiddleware);

// GET /api/admin/stats - get system overview stats (online/total users, active partnerships)
router.get('/stats', async (req, res) => {
  try {
    const totalUsersResult = await db.get('SELECT COUNT(*) as count FROM users');
    const totalUsers = parseInt(totalUsersResult.count || 0);

    const activePartnershipsResult = await db.get("SELECT COUNT(*) as count FROM partnerships WHERE status = 'active'");
    const activePartnerships = parseInt(activePartnershipsResult.count || 0);

    const totalGoalsResult = await db.get('SELECT COUNT(*) as count FROM goals');
    const totalGoals = parseInt(totalGoalsResult.count || 0);

    const totalCheckinsResult = await db.get('SELECT COUNT(*) as count FROM checkins');
    const totalCheckins = parseInt(totalCheckinsResult.count || 0);

    res.json({
      success: true,
      data: {
        total_users: totalUsers,
        active_partnerships: activePartnerships,
        total_goals: totalGoals,
        total_checkins: totalCheckins
      }
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ success: false, error: '获取统计数据失败' });
  }
});

// GET /api/admin/users - list latest registered users (limit to 30 for speed)
router.get('/users', async (req, res) => {
  try {
    const users = await db.all('SELECT id, username, is_admin, created_at FROM users ORDER BY created_at DESC LIMIT 30');
    res.json({ success: true, data: { users } });
  } catch (err) {
    console.error('Admin list users error:', err);
    res.status(500).json({ success: false, error: '获取用户列表失败' });
  }
});

// GET /api/admin/checkins - list latest checkins (limit to 30 for speed)
router.get('/checkins', async (req, res) => {
  try {
    const checkins = await db.all(`
      SELECT c.*, u.username as username, g.title as goal_title, v.username as verified_username
      FROM checkins c
      JOIN users u ON u.id = c.user_id
      JOIN goals g ON g.id = c.goal_id
      LEFT JOIN users v ON v.id = c.verified_by
      ORDER BY c.created_at DESC
      LIMIT 30
    `);

    const parsed = checkins.map(c => ({
      ...c,
      images: c.images ? JSON.parse(c.images) : []
    }));

    res.json({ success: true, data: { checkins: parsed } });
  } catch (err) {
    console.error('Admin list checkins error:', err);
    res.status(500).json({ success: false, error: '获取打卡记录失败' });
  }
});

// DELETE /api/admin/checkins/:id - delete a checkin record
router.delete('/checkins/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.run('DELETE FROM checkins WHERE id = ?', [id]);
    res.json({ success: true, data: { message: '打卡记录已删除' } });
  } catch (err) {
    console.error('Admin delete checkin error:', err);
    res.status(500).json({ success: false, error: '删除打卡记录失败' });
  }
});

// GET /api/admin/goals - list latest goals (limit to 30 for speed)
router.get('/goals', async (req, res) => {
  try {
    const goals = await db.all(`
      SELECT g.*, u.username as username
      FROM goals g
      JOIN users u ON u.id = g.user_id
      ORDER BY g.created_at DESC
      LIMIT 30
    `);
    res.json({ success: true, data: { goals } });
  } catch (err) {
    console.error('Admin list goals error:', err);
    res.status(500).json({ success: false, error: '获取目标列表失败' });
  }
});

// PUT /api/admin/goals/:id - modify/suspend a goal
router.put('/goals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, title, description } = req.body;

    const updates = [];
    const params = [];
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (title !== undefined) { updates.push('title = ?'); params.push(title.trim()); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: '没有提供需要更新的参数' });
    }

    params.push(id);
    await db.run(`UPDATE goals SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ success: true, data: { message: '目标更新成功' } });
  } catch (err) {
    console.error('Admin update goal error:', err);
    res.status(500).json({ success: false, error: '修改目标失败' });
  }
});

module.exports = router;
