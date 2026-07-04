const express = require('express');
const { db } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// All routes require auth
router.use(authMiddleware);

// POST /api/messages/:partnershipId - send message
router.post('/:partnershipId', async (req, res) => {
  try {
    const { partnershipId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ success: false, error: '消息内容不能为空' });
    }

    // Verify user is part of partnership
    const partnership = await db.get(
      'SELECT * FROM partnerships WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
      [partnershipId, userId, userId]
    );

    if (!partnership) {
      return res.status(403).json({ success: false, error: '你不属于该搭档关系' });
    }

    const result = await db.run(
      'INSERT INTO messages (partnership_id, sender_id, content) VALUES (?, ?, ?)',
      [partnershipId, userId, content.trim()]
    );

    const message = await db.get(`
      SELECT m.*, u.username as sender_username
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.id = ?
    `, [result.lastInsertRowid]);

    res.status(201).json({ success: true, data: message });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ success: false, error: '发送消息失败' });
  }
});

// GET /api/messages/:partnershipId - get messages for partnership
router.get('/:partnershipId', async (req, res) => {
  try {
    const { partnershipId } = req.params;
    const userId = req.user.id;

    // Verify user is part of partnership
    const partnership = await db.get(
      'SELECT * FROM partnerships WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
      [partnershipId, userId, userId]
    );

    if (!partnership) {
      return res.status(403).json({ success: false, error: '你不属于该搭档关系' });
    }

    const messages = await db.all(`
      SELECT m.*, u.username as sender_username
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.partnership_id = ?
      ORDER BY m.created_at ASC
    `, [partnershipId]);

    res.json({ success: true, data: { messages } });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ success: false, error: '获取消息失败' });
  }
});

module.exports = router;
