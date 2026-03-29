const express = require('express');
const router  = express.Router();
const { getPool } = require('../db/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// ── GET /api/availability?start=YYYY-MM-DD&end=YYYY-MM-DD
// Public: returns blocked dates/times for the given range (used by booking form)
router.get('/', async (req, res) => {
  try {
    const db = getPool();
    const { start, end } = req.query;
    let query = 'SELECT * FROM blocked_times';
    const params = [];
    if (start && end) {
      query += ' WHERE block_date >= $1 AND block_date <= $2';
      params.push(start, end);
    } else if (start) {
      query += ' WHERE block_date >= $1';
      params.push(start);
    }
    query += ' ORDER BY block_date, start_time';
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('GET /availability error:', err);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

// ── GET /api/availability/check?date=YYYY-MM-DD&time=HH:MM
// Public: check if a specific date/time is blocked
router.get('/check', async (req, res) => {
  try {
    const db = getPool();
    const { date, time } = req.query;
    if (!date) return res.status(400).json({ error: 'date required' });

    // Check for all-day blocks
    const { rows: allDay } = await db.query(
      'SELECT * FROM blocked_times WHERE block_date = $1 AND all_day = TRUE',
      [date]
    );
    if (allDay.length > 0) {
      return res.json({ blocked: true, reason: allDay[0].reason || 'Not available', all_day: true });
    }

    // Check for time-specific blocks
    if (time) {
      const { rows: timed } = await db.query(
        `SELECT * FROM blocked_times
         WHERE block_date = $1
           AND all_day = FALSE
           AND start_time IS NOT NULL
           AND end_time IS NOT NULL
           AND $2::time >= start_time
           AND $2::time < end_time`,
        [date, time]
      );
      if (timed.length > 0) {
        return res.json({ blocked: true, reason: timed[0].reason || 'Not available', all_day: false });
      }
    }

    res.json({ blocked: false });
  } catch (err) {
    console.error('GET /availability/check error:', err);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

// ── GET /api/availability/month?year=YYYY&month=MM
// Public: returns all blocked dates for a given month (for calendar display)
router.get('/month', async (req, res) => {
  try {
    const db = getPool();
    const { year, month } = req.query;
    if (!year || !month) return res.status(400).json({ error: 'year and month required' });
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate   = new Date(year, month, 0).toISOString().slice(0, 10); // last day of month
    const { rows } = await db.query(
      'SELECT * FROM blocked_times WHERE block_date >= $1 AND block_date <= $2 ORDER BY block_date, start_time',
      [startDate, endDate]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch month availability' });
  }
});

// ── POST /api/availability/block  (admin only)
// Block a date or time slot
router.post('/block', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getPool();
    const { block_date, start_time, end_time, all_day = true, reason = '' } = req.body;
    if (!block_date) return res.status(400).json({ error: 'block_date required' });

    // Check for duplicate all-day block
    if (all_day) {
      const { rows: existing } = await db.query(
        'SELECT id FROM blocked_times WHERE block_date = $1 AND all_day = TRUE',
        [block_date]
      );
      if (existing.length > 0) {
        return res.json({ id: existing[0].id, message: 'Already blocked' });
      }
    }

    const { rows } = await db.query(
      `INSERT INTO blocked_times (block_date, start_time, end_time, all_day, reason, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [block_date, start_time || null, end_time || null, all_day, reason, req.user?.id || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /availability/block error:', err);
    res.status(500).json({ error: 'Failed to block time' });
  }
});

// ── DELETE /api/availability/block/:id  (admin only)
// Unblock a specific blocked time entry
router.delete('/block/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getPool();
    await db.query('DELETE FROM blocked_times WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unblock time' });
  }
});

// ── DELETE /api/availability/block/date/:date  (admin only)
// Unblock all entries for a specific date
router.delete('/block/date/:date', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getPool();
    const { rows } = await db.query(
      'DELETE FROM blocked_times WHERE block_date = $1 RETURNING id',
      [req.params.date]
    );
    res.json({ deleted: rows.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unblock date' });
  }
});

// ── PUT /api/availability/block/:id  (admin only)
// Update a blocked time entry (e.g., change reason or time range)
router.put('/block/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getPool();
    const { start_time, end_time, all_day, reason } = req.body;
    const { rows } = await db.query(
      `UPDATE blocked_times SET start_time=$1, end_time=$2, all_day=$3, reason=$4 WHERE id=$5 RETURNING *`,
      [start_time || null, end_time || null, all_day ?? true, reason || '', req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update block' });
  }
});

module.exports = router;
