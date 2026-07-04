const express = require('express');
const { db } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// All routes require auth
router.use(authMiddleware);

// GET /api/users/search?q= - search users by username
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length === 0) {
      return res.json({ success: true, data: { users: [] } });
    }

    const users = await db.all(`
      SELECT u.id, u.username, u.created_at,
        CASE WHEN EXISTS (
          SELECT 1 FROM partnerships
          WHERE (user1_id = u.id OR user2_id = u.id) AND status = 'active'
        ) THEN 1 ELSE 0 END as has_partner
      FROM users u
      WHERE u.username LIKE ? AND u.id != ?
      LIMIT 10
    `, [`%${q}%`, req.user.id]);

    res.json({ success: true, data: { users } });
  } catch (err) {
    console.error('Search users error:', err);
    res.status(500).json({ success: false, error: '搜索用户失败' });
  }
});

// POST /api/partners/request - send partner request
router.post('/request', async (req, res) => {
  try {
    const { to_user_id } = req.body;
    const fromUserId = req.user.id;

    if (!to_user_id) {
      return res.status(400).json({ success: false, error: '请指定目标用户' });
    }

    if (to_user_id === fromUserId) {
      return res.status(400).json({ success: false, error: '不能向自己发送搭档请求' });
    }

    // Check target user exists
    const targetUser = await db.get('SELECT id FROM users WHERE id = ?', [to_user_id]);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: '目标用户不存在' });
    }

    // Check if sender already has an active partnership (one partner at a time)
    const senderPartnership = await db.get(
      'SELECT id FROM partnerships WHERE (user1_id = ? OR user2_id = ?) AND status = ?',
      [fromUserId, fromUserId, 'active']
    );
    if (senderPartnership) {
      return res.status(400).json({ success: false, error: '你已经有搭档了' });
    }

    // Check if target already has an active partnership
    const targetPartnership = await db.get(
      'SELECT id FROM partnerships WHERE (user1_id = ? OR user2_id = ?) AND status = ?',
      [to_user_id, to_user_id, 'active']
    );
    if (targetPartnership) {
      return res.status(400).json({ success: false, error: '对方已经有搭档了' });
    }

    // Check no existing pending request between these two users (either direction)
    const existingRequest = await db.get(`
      SELECT id FROM partner_requests
      WHERE ((from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?))
        AND status = 'pending'
    `, [fromUserId, to_user_id, to_user_id, fromUserId]);
    if (existingRequest) {
      return res.status(400).json({ success: false, error: '已存在待处理的搭档请求' });
    }

    const result = await db.run(
      'INSERT INTO partner_requests (from_user_id, to_user_id) VALUES (?, ?)',
      [fromUserId, to_user_id]
    );

    res.status(201).json({
      success: true,
      data: { id: result.lastInsertRowid }
    });
  } catch (err) {
    console.error('Send partner request error:', err);
    res.status(500).json({ success: false, error: '发送搭档请求失败' });
  }
});

// GET /api/partners/requests - get pending requests received
router.get('/requests', async (req, res) => {
  try {
    const requests = await db.all(`
      SELECT pr.*, u.username as from_username
      FROM partner_requests pr
      JOIN users u ON u.id = pr.from_user_id
      WHERE pr.to_user_id = ? AND pr.status = 'pending'
      ORDER BY pr.created_at DESC
    `, [req.user.id]);

    res.json({ success: true, data: { requests } });
  } catch (err) {
    console.error('Get requests error:', err);
    res.status(500).json({ success: false, error: '获取搭档请求失败' });
  }
});

// PUT /api/partners/requests/:id - accept or reject
router.put('/requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'accept' or 'reject'

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, error: '操作无效，请选择接受或拒绝' });
    }

    const request = await db.get(
      'SELECT * FROM partner_requests WHERE id = ? AND to_user_id = ? AND status = ?',
      [id, req.user.id, 'pending']
    );

    if (!request) {
      return res.status(404).json({ success: false, error: '搭档请求不存在或已处理' });
    }

    if (action === 'accept') {
      // Check neither user already has an active partnership
      const senderPartnership = await db.get(
        'SELECT id FROM partnerships WHERE (user1_id = ? OR user2_id = ?) AND status = ?',
        [request.from_user_id, request.from_user_id, 'active']
      );
      if (senderPartnership) {
        // Auto-reject since the sender already found a partner
        await db.run('UPDATE partner_requests SET status = ? WHERE id = ?', ['rejected', id]);
        return res.status(400).json({ success: false, error: '对方已经有搭档了' });
      }

      const receiverPartnership = await db.get(
        'SELECT id FROM partnerships WHERE (user1_id = ? OR user2_id = ?) AND status = ?',
        [req.user.id, req.user.id, 'active']
      );
      if (receiverPartnership) {
        return res.status(400).json({ success: false, error: '你已经有搭档了' });
      }

      // Use transaction to accept request and create partnership
      const partnershipId = await db.transaction(async (tx) => {
        await tx.run('UPDATE partner_requests SET status = ? WHERE id = ?', ['accepted', id]);
        const result = await tx.run(
          'INSERT INTO partnerships (user1_id, user2_id) VALUES (?, ?)',
          [request.from_user_id, req.user.id]
        );

        // Auto-reject all other pending requests for both users
        await tx.run(`
          UPDATE partner_requests SET status = 'rejected'
          WHERE status = 'pending'
            AND (from_user_id IN (?, ?) OR to_user_id IN (?, ?))
            AND id != ?
        `, [request.from_user_id, req.user.id, request.from_user_id, req.user.id, id]);

        return result.lastInsertRowid;
      });

      res.json({
        success: true,
        data: { partnership_id: partnershipId }
      });
    } else {
      await db.run('UPDATE partner_requests SET status = ? WHERE id = ?', ['rejected', id]);
      res.json({ success: true, data: { message: '已拒绝搭档请求' } });
    }
  } catch (err) {
    console.error('Handle request error:', err);
    res.status(500).json({ success: false, error: '处理搭档请求失败' });
  }
});

// GET /api/partners/ - list active partnerships with partner info
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const partnerships = await db.all(`
      SELECT p.*,
        CASE WHEN p.user1_id = ? THEN p.user2_id ELSE p.user1_id END as partner_id,
        CASE WHEN p.user1_id = ? THEN u2.username ELSE u1.username END as partner_username
      FROM partnerships p
      JOIN users u1 ON u1.id = p.user1_id
      JOIN users u2 ON u2.id = p.user2_id
      WHERE (p.user1_id = ? OR p.user2_id = ?) AND p.status = 'active'
    `, [userId, userId, userId, userId]);

    // Enrich with partner's streak and today's checkin status for their goals
    const enriched = await Promise.all(partnerships.map(async p => {
      const partnerId = p.partner_id;

      // Calculate partner's streak
      let streak = 0;
      const checkDate = new Date(today);
      while (true) {
        const dateStr = checkDate.toISOString().split('T')[0];
        const hasCheckin = await db.get(
          'SELECT COUNT(*) as count FROM checkins WHERE user_id = ? AND date = ?',
          [partnerId, dateStr]
        );
        if (parseInt(hasCheckin.count || 0) > 0) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }

      // Partner's active goals with today's checkin status
      const goals = await db.all(
        'SELECT * FROM goals WHERE user_id = ? AND status = ?',
        [partnerId, 'active']
      );

      const goalsWithCheckins = await Promise.all(goals.map(async g => {
        const todayCheckin = await db.get(
          'SELECT * FROM checkins WHERE goal_id = ? AND date = ?',
          [g.id, today]
        );
        return {
          ...g,
          today_checked_in: !!todayCheckin,
          today_checkin: todayCheckin || null
        };
      }));

      return {
        ...p,
        streak: streak, // Match frontend expectation
        partner_streak: streak,
        partner_goals: goalsWithCheckins,
        today_checkins: goalsWithCheckins.filter(g => g.today_checked_in).length // Add this helper
      };
    }));

    res.json({ success: true, data: { partners: enriched } });
  } catch (err) {
    console.error('Get partnerships error:', err);
    res.status(500).json({ success: false, error: '获取搭档列表失败' });
  }
});

// DELETE /api/partners/:id - manually dissolve partnership
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const partnership = await db.get(
      'SELECT * FROM partnerships WHERE id = ? AND (user1_id = ? OR user2_id = ?) AND status = ?',
      [id, userId, userId, 'active']
    );

    if (!partnership) {
      return res.status(404).json({ success: false, error: '搭档关系不存在或已解散' });
    }

    await db.run(
      'UPDATE partnerships SET status = ?, dissolved_reason = ?, dissolved_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['dissolved', 'manual', id]
    );

    res.json({ success: true, data: { message: '搭档关系已解散' } });
  } catch (err) {
    console.error('Dissolve partnership error:', err);
    res.status(500).json({ success: false, error: '解散搭档关系失败' });
  }
});

module.exports = router;
