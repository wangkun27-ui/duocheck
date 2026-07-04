const express = require('express');
const multer = require('multer');
const path = require('path');
const { db } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Multer configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const fileFilter = function (req, file, cb) {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('只支持 JPEG、PNG、GIF、WebP 格式的图片'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// All routes require auth
router.use(authMiddleware);

// POST /api/checkins/ - create checkin with optional image upload
router.post('/', upload.array('images', 3), async (req, res) => {
  try {
    const { goal_id, note } = req.body;
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    if (!goal_id) {
      return res.status(400).json({ success: false, error: '请指定打卡目标' });
    }

    // Verify goal belongs to user
    const goal = await db.get('SELECT * FROM goals WHERE id = ? AND user_id = ?', [goal_id, userId]);
    if (!goal) {
      return res.status(404).json({ success: false, error: '目标不存在或无权打卡' });
    }

    if (goal.status !== 'active') {
      return res.status(400).json({ success: false, error: '该目标已不再活跃' });
    }

    // Check only one checkin per goal per day
    const existing = await db.get(
      'SELECT id FROM checkins WHERE goal_id = ? AND user_id = ? AND date = ?',
      [goal_id, userId, today]
    );
    if (existing) {
      return res.status(400).json({ success: false, error: '今天已经为该目标打过卡了' });
    }

    // Process uploaded images
    const images = req.files ? req.files.map(f => `/uploads/${f.filename}`) : [];
    const imagesJson = images.length > 0 ? JSON.stringify(images) : null;

    const result = await db.run(
      'INSERT INTO checkins (goal_id, user_id, date, note, images) VALUES (?, ?, ?, ?, ?)',
      [goal_id, userId, today, note || null, imagesJson]
    );

    const checkin = await db.get('SELECT * FROM checkins WHERE id = ?', [result.lastInsertRowid]);

    res.status(201).json({ success: true, data: checkin });
  } catch (err) {
    console.error('Create checkin error:', err);
    res.status(500).json({ success: false, error: '打卡失败' });
  }
});

// Handle multer errors
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, error: '图片大小不能超过5MB' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ success: false, error: '最多上传3张图片' });
    }
    return res.status(400).json({ success: false, error: err.message });
  }
  if (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
  next();
});

// GET /api/checkins/?goal_id=&month= - get checkins for a goal by month
router.get('/', async (req, res) => {
  try {
    const { goal_id, month } = req.query;

    if (!goal_id) {
      return res.status(400).json({ success: false, error: '请指定目标ID' });
    }

    let query = `
      SELECT c.*, u.username as verified_by_username
      FROM checkins c
      LEFT JOIN users u ON u.id = c.verified_by
      WHERE c.goal_id = ?
    `;
    const params = [goal_id];

    if (month) {
      // month format: YYYY-MM
      query += ' AND c.date LIKE ?';
      params.push(`${month}%`);
    }

    query += ' ORDER BY c.date DESC';

    const checkins = await db.all(query, params);

    // Parse images JSON
    const parsed = checkins.map(c => ({
      ...c,
      images: c.images ? JSON.parse(c.images) : []
    }));

    res.json({ success: true, data: parsed });
  } catch (err) {
    console.error('Get checkins error:', err);
    res.status(500).json({ success: false, error: '获取打卡记录失败' });
  }
});

// GET /api/checkins/partner/:partnerId/today - get partner's today checkins
router.get('/partner/:partnerId/today', async (req, res) => {
  try {
    const partnerId = parseInt(req.params.partnerId);
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    // Verify they are partners
    const partnership = await db.get(`
      SELECT id FROM partnerships
      WHERE ((user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?))
        AND status = 'active'
    `, [userId, partnerId, partnerId, userId]);

    if (!partnership) {
      return res.status(403).json({ success: false, error: '你们不是搭档关系' });
    }

    // Get partner's active goals
    const goals = await db.all(
      'SELECT * FROM goals WHERE user_id = ? AND status = ?',
      [partnerId, 'active']
    );

    const partnerCheckins = [];
    for (const g of goals) {
      const checkin = await db.get(
        'SELECT * FROM checkins WHERE goal_id = ? AND date = ?',
        [g.id, today]
      );

      if (checkin) {
        partnerCheckins.push({
          id: checkin.id,
          goal_id: g.id,
          goal_title: g.title,
          user_id: checkin.user_id,
          date: checkin.date,
          note: checkin.note,
          images: checkin.images ? JSON.parse(checkin.images) : [],
          verified_by: checkin.verified_by,
          verified_status: checkin.verified_status,
          verify_comment: checkin.verify_comment,
          created_at: checkin.created_at
        });
      }
    }

    res.json({ success: true, data: { checkins: partnerCheckins } });
  } catch (err) {
    console.error('Get partner today checkins error:', err);
    res.status(500).json({ success: false, error: '获取搭档打卡记录失败' });
  }
});

// PUT /api/checkins/:id/verify - partner verifies a checkin
router.put('/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    const { verified_status, verify_comment } = req.body;
    const userId = req.user.id;

    if (!['confirmed', 'questioned'].includes(verified_status)) {
      return res.status(400).json({ success: false, error: '无效的验证状态' });
    }

    // Get the checkin
    const checkin = await db.get('SELECT * FROM checkins WHERE id = ?', [id]);
    if (!checkin) {
      return res.status(404).json({ success: false, error: '打卡记录不存在' });
    }

    // Must not be the checkin owner
    if (checkin.user_id === userId) {
      return res.status(403).json({ success: false, error: '不能验证自己的打卡' });
    }

    // Must be partners
    const partnership = await db.get(`
      SELECT id FROM partnerships
      WHERE ((user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?))
        AND status = 'active'
    `, [userId, checkin.user_id, checkin.user_id, userId]);

    if (!partnership) {
      return res.status(403).json({ success: false, error: '你们不是搭档关系' });
    }

    await db.run(
      'UPDATE checkins SET verified_by = ?, verified_status = ?, verify_comment = ? WHERE id = ?',
      [userId, verified_status, verify_comment || null, id]
    );

    const updated = await db.get(`
      SELECT c.*, u.username as verified_by_username
      FROM checkins c
      LEFT JOIN users u ON u.id = c.verified_by
      WHERE c.id = ?
    `, [id]);

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Verify checkin error:', err);
    res.status(500).json({ success: false, error: '验证打卡失败' });
  }
});

// GET /api/checkins/dashboard - dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    // Today's goals and checkin status
    const goals = await db.all(
      'SELECT * FROM goals WHERE user_id = ? AND status = ? ORDER BY created_at ASC',
      [userId, 'active']
    );

    const todayGoals = await Promise.all(goals.map(async g => {
      const checkin = await db.get(
        'SELECT * FROM checkins WHERE goal_id = ? AND date = ?',
        [g.id, today]
      );
      return {
        ...g,
        checked_in: !!checkin,
        today_checked_in: !!checkin,
        today_checkin: checkin ? {
          ...checkin,
          images: checkin.images ? JSON.parse(checkin.images) : []
        } : null
      };
    }));

    // Calculate streak efficiently in-memory to reduce database queries
    let streak = 0;
    const checkinDatesList = await db.all('SELECT DISTINCT date FROM checkins WHERE user_id = ? ORDER BY date DESC', [userId]);
    const checkinDates = new Set(checkinDatesList.map(c => c.date));
    
    const checkDate = new Date(today);
    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (checkinDates.has(dateStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        // Allow streak to continue if they haven't checked in yet *today*, but did yesterday
        if (dateStr === today && streak === 0) {
          checkDate.setDate(checkDate.getDate() - 1);
          continue;
        }
        break;
      }
    }

    // Partner activities - get active partnership partner's today checkins
    const partnership = await db.get(`
      SELECT p.*,
        CASE WHEN p.user1_id = ? THEN p.user2_id ELSE p.user1_id END as partner_id,
        CASE WHEN p.user1_id = ? THEN u2.username ELSE u1.username END as partner_username
      FROM partnerships p
      JOIN users u1 ON u1.id = p.user1_id
      JOIN users u2 ON u2.id = p.user2_id
      WHERE (p.user1_id = ? OR p.user2_id = ?) AND p.status = 'active'
    `, [userId, userId, userId, userId]);

    let partnerActivity = null;
    const partnerActivities = [];
    if (partnership) {
      const partnerId = partnership.partner_id;
      const partnerGoals = await db.all(
        'SELECT * FROM goals WHERE user_id = ? AND status = ?',
        [partnerId, 'active']
      );

      const partnerCheckins = await Promise.all(partnerGoals.map(async g => {
        const checkin = await db.get(
          'SELECT * FROM checkins WHERE goal_id = ? AND date = ?',
          [g.id, today]
        );

        if (checkin) {
          partnerActivities.push({
            partner_id: partnerId,
            partner_username: partnership.partner_username,
            goal_id: g.id,
            goal_title: g.title,
            verified: checkin.verified_status !== null,
            note: checkin.note,
            checkin_id: checkin.id
          });
        }

        return {
          goal: g,
          checked_in: !!checkin,
          checkin: checkin ? {
            ...checkin,
            images: checkin.images ? JSON.parse(checkin.images) : []
          } : null
        };
      }));

      partnerActivity = {
        partnership_id: partnership.id,
        partner_id: partnerId,
        partner_username: partnership.partner_username,
        goals: partnerCheckins
      };
    }

    // Check dissolved partnerships from today (missed_checkin)
    const dissolvedTodaySql = db.isPg ? `
      SELECT p.*,
        CASE WHEN p.user1_id = ? THEN u2.username ELSE u1.username END as partner_username
      FROM partnerships p
      JOIN users u1 ON u1.id = p.user1_id
      JOIN users u2 ON u2.id = p.user2_id
      WHERE (p.user1_id = ? OR p.user2_id = ?)
        AND p.status = 'dissolved'
        AND p.dissolved_reason = 'missed_checkin'
        AND p.dissolved_at::date = ?
    ` : `
      SELECT p.*,
        CASE WHEN p.user1_id = ? THEN u2.username ELSE u1.username END as partner_username
      FROM partnerships p
      JOIN users u1 ON u1.id = p.user1_id
      JOIN users u2 ON u2.id = p.user2_id
      WHERE (p.user1_id = ? OR p.user2_id = ?)
        AND p.status = 'dissolved'
        AND p.dissolved_reason = 'missed_checkin'
        AND DATE(p.dissolved_at) = ?
    `;

    const dissolvedToday = await db.all(dissolvedTodaySql, [userId, userId, userId, today]);

    res.json({
      success: true,
      data: {
        today: today,
        goals: todayGoals,
        today_goals: todayGoals,
        streak,
        partnerActivity,
        partner_activities: partnerActivities,
        dissolvedPartnerships: dissolvedToday,
        dissolved_partnerships: dissolvedToday
      }
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ success: false, error: '获取仪表盘数据失败' });
  }
});

module.exports = router;
