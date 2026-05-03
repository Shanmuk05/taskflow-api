const router = require('express').Router();
const { body } = require('express-validator');
const pool = require('../db/pool');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

// GET /api/users  — all users (any authenticated)
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, created_at FROM users ORDER BY name'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/dashboard/summary  — logged-in user's overview
// NOTE: Must be registered BEFORE /:id to avoid 'dashboard' being captured as a UUID param
router.get('/dashboard/summary', authenticate, async (req, res) => {
  try {
    const tasks = await pool.query(`
      SELECT
        COUNT(*)                                                  AS total,
        COUNT(*) FILTER (WHERE status='done')                    AS done,
        COUNT(*) FILTER (WHERE status='in-progress')             AS in_progress,
        COUNT(*) FILTER (WHERE status='todo')                    AS todo,
        COUNT(*) FILTER (WHERE status!='done' AND due_date < CURRENT_DATE) AS overdue
      FROM tasks WHERE assigned_to=$1
    `, [req.user.id]);

    const projects = await pool.query(`
      SELECT COUNT(DISTINCT pm.project_id) AS count
      FROM project_members pm WHERE pm.user_id=$1
    `, [req.user.id]);

    res.json({ tasks: tasks.rows[0], projects: projects.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:id  — with task/project stats
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id=$1',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    const stats = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE t.status = 'todo')        AS todo_count,
        COUNT(*) FILTER (WHERE t.status = 'in-progress') AS in_progress_count,
        COUNT(*) FILTER (WHERE t.status = 'done')        AS done_count,
        COUNT(*) FILTER (WHERE t.status != 'done' AND t.due_date < CURRENT_DATE) AS overdue_count
      FROM tasks t WHERE t.assigned_to=$1
    `, [req.params.id]);

    const projects = await pool.query(`
      SELECT p.id, p.name FROM projects p
      JOIN project_members pm ON pm.project_id = p.id
      WHERE pm.user_id=$1 ORDER BY p.name
    `, [req.params.id]);

    res.json({ ...rows[0], stats: stats.rows[0], projects: projects.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id/role  — admin only: change role
router.put('/:id/role', authenticate, requireAdmin, [
  body('role').isIn(['admin','member']).withMessage('Role must be admin or member'),
], validate, async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Cannot change your own role' });
  }
  try {
    const { rows } = await pool.query(
      'UPDATE users SET role=$1 WHERE id=$2 RETURNING id, name, email, role',
      [req.body.role, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:id  — admin only
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  try {
    const { rowCount } = await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
