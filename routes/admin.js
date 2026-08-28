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
    const stats = await db.get(`
      SELECT
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM partnerships WHERE status = 'active') as active_partnerships,
        (SELECT COUNT(*) FROM goals) as total_goals,
        (SELECT COUNT(*) FROM checkins) as total_checkins
    `);

    res.json({
      success: true,
      data: {
        total_users: parseInt(stats.total_users || 0),
        active_partnerships: parseInt(stats.active_partnerships || 0),
        total_goals: parseInt(stats.total_goals || 0),
        total_checkins: parseInt(stats.total_checkins || 0)
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
    const users = await db.all('SELECT id, username, avatar, is_admin, created_at FROM users ORDER BY created_at DESC LIMIT 30');
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

// DELETE /api/admin/goals/:id - admin delete a goal and its checkins
router.delete('/goals/:id', async (req, res) => {
  try {
    const goalId = parseInt(req.params.id);
    await db.transaction(async (tx) => {
      await tx.run('DELETE FROM checkins WHERE goal_id = ?', [goalId]);
      const result = await tx.run('DELETE FROM goals WHERE id = ?', [goalId]);
      if (result.rowCount === 0) {
        throw new Error('未找到目标或未执行删除');
      }
    });

    console.log(`[ADMIN DELETE GOAL SUCCESS] goalId=${goalId}`);
    res.json({ success: true, data: { message: '目标及打卡记录已成功物理清除' } });
  } catch (err) {
    console.error('Admin delete goal error:', err);
    res.status(500).json({ success: false, error: '删除目标失败：' + err.message });
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

    // Use atomic transaction to execute cascading deletion in exact dependency order
    await db.transaction(async (tx) => {
      // 1. Messages sent by user or in partnerships involving user
      await tx.run(`
        DELETE FROM messages WHERE sender_id = ? OR partnership_id IN (
          SELECT id FROM partnerships WHERE user1_id = ? OR user2_id = ?
        )
      `, [targetUserId, targetUserId, targetUserId]);

      // 2. Checkins on goals of user, or created by user, or verified by user
      await tx.run(`
        DELETE FROM checkins WHERE user_id = ? OR verified_by = ? OR goal_id IN (
          SELECT id FROM goals WHERE user_id = ?
        )
      `, [targetUserId, targetUserId, targetUserId]);

      // 3. Partner requests sent by or to user
      await tx.run(`
        DELETE FROM partner_requests WHERE from_user_id = ? OR to_user_id = ?
      `, [targetUserId, targetUserId]);

      // 4. Partnerships involving user
      await tx.run(`
        DELETE FROM partnerships WHERE user1_id = ? OR user2_id = ?
      `, [targetUserId, targetUserId]);

      // 5. Goals created by user
      await tx.run(`
        DELETE FROM goals WHERE user_id = ?
      `, [targetUserId]);

      // 6. User record
      const result = await tx.run(`
        DELETE FROM users WHERE id = ?
      `, [targetUserId]);

      if (result.rowCount === 0) {
        throw new Error('数据库未执行用户删除操作');
      }
    });

    console.log(`[ADMIN DELETE USER SUCCESS] targetUserId=${targetUserId}`);
    res.json({ success: true, data: { message: '用户及其所有相关历史记录已彻底成功清除' } });
  } catch (err) {
    console.error('Admin delete user error:', err);
    res.status(500).json({ success: false, error: '删除用户失败：' + err.message });
  }
});

// GET /api/admin/partnerships - list all partnerships with user info
router.get('/partnerships', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const partnerships = await db.all(`
      SELECT
        p.id,
        p.status,
        p.created_at,
        p.dissolved_at,
        p.dissolved_reason,
        u1.id   AS user1_id,
        u1.username AS user1_username,
        u1.avatar   AS user1_avatar,
        u2.id   AS user2_id,
        u2.username AS user2_username,
        u2.avatar   AS user2_avatar
      FROM partnerships p
      JOIN users u1 ON u1.id = p.user1_id
      JOIN users u2 ON u2.id = p.user2_id
      ORDER BY p.status ASC, p.created_at DESC
      LIMIT 50
    `, []);
    res.json({ success: true, data: { partnerships } });
  } catch (err) {
    console.error('Admin list partnerships error:', err);
    res.status(500).json({ success: false, error: '获取搭档关系失败' });
  }
});

// DELETE /api/admin/partnerships/:id - dissolve a partnership
router.delete('/partnerships/:id', async (req, res) => {
  try {
    const partnershipId = parseInt(req.params.id);
    await db.run(
      "UPDATE partnerships SET status = 'dissolved', dissolved_reason = 'admin_action', dissolved_at = CURRENT_TIMESTAMP WHERE id = ?",
      [partnershipId]
    );
    res.json({ success: true, data: { message: '搭档关系已强制解除' } });
  } catch (err) {
    console.error('Admin dissolve partnership error:', err);
    res.status(500).json({ success: false, error: '解除搭档关系失败' });
  }
});

module.exports = router;
