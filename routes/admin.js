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
    const checkinId = parseInt(req.params.id);
    await db.run('DELETE FROM checkins WHERE id = ?', [checkinId]);
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
    const goalId = parseInt(req.params.id);
    const { status, title, description } = req.body;

    const updates = [];
    const params = [];
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (title !== undefined) { updates.push('title = ?'); params.push(title.trim()); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: '没有提供需要更新的参数' });
    }

    params.push(goalId);
    await db.run(`UPDATE goals SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ success: true, data: { message: '目标更新成功' } });
  } catch (err) {
    console.error('Admin update goal error:', err);
    res.status(500).json({ success: false, error: '修改目标失败' });
  }
});

// DELETE /api/admin/users/:id - admin delete user completely (cascade clearing all records)
router.delete('/users/:id', async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id);
    const adminId = parseInt(req.user.id);

    if (targetUserId === adminId) {
      return res.status(400).json({ success: false, error: '管理员不能删除自己' });
    }

    // Verify user exists
    const user = await db.get('SELECT * FROM users WHERE id = ?', [targetUserId]);
    if (!user) {
      return res.status(404).json({ success: false, error: '该用户不存在' });
    }

    // For SQLite: manually delete in correct FK order
    // For PostgreSQL: ON DELETE CASCADE handles everything automatically, but we still clean manually for safety
    await db.run('DELETE FROM messages WHERE sender_id = ?', [targetUserId]);
    await db.run(`
      DELETE FROM messages WHERE partnership_id IN (
        SELECT id FROM partnerships WHERE user1_id = ? OR user2_id = ?
      )
    `, [targetUserId, targetUserId]);
    await db.run('DELETE FROM checkins WHERE user_id = ? OR verified_by = ?', [targetUserId, targetUserId]);
    await db.run('DELETE FROM goals WHERE user_id = ?', [targetUserId]);
    await db.run('DELETE FROM partnerships WHERE user1_id = ? OR user2_id = ?', [targetUserId, targetUserId]);
    await db.run('DELETE FROM partner_requests WHERE from_user_id = ? OR to_user_id = ?', [targetUserId, targetUserId]);

    // Finally delete the user - CASCADE will clean anything remaining in PostgreSQL
    const result = await db.run('DELETE FROM users WHERE id = ?', [targetUserId]);

    if (result.rowCount === 0) {
      console.error(`[DELETE USER] rowCount=0 after delete, targetUserId=${targetUserId}`);
      return res.status(500).json({ success: false, error: '删除失败，数据库未执行删除操作' });
    }

    console.log(`[DELETE USER] Successfully deleted userId=${targetUserId}`);
    res.json({ success: true, data: { message: '用户及其所有相关历史记录已成功清除' } });
  } catch (err) {
    console.error('Admin delete user error:', err);
    res.status(500).json({ success: false, error: '删除用户失败' });
  }
});

module.exports = router;
