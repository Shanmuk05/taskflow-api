const router = require('express').Router();
const { body, param } = require('express-validator');
const pool = require('../db/pool');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

// Middleware: verify user is a member of the project (or admin)
async function projectMember(req, res, next) {
  const { id } = req.params;
  if (req.user.role === 'admin') return next();
  const { rows } = await pool.query(
    'SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2',
    [id, req.user.id]
  );
  if (!rows.length) return res.status(403).json({ error: 'Not a member of this project' });
  next();
}

const projectFields = [
  body('name').trim().isLength({ min: 2 }).withMessage('Name required (min 2 chars)'),
  body('description').optional().trim(),
  body('memberIds').optional().isArray(),
];

// GET /api/projects  — projects where the user is a member (or all for admin)
router.get('/', authenticate, async (req, res) => {
  try {
    let q;
    if (req.user.role === 'admin') {
      q = await pool.query(`
        SELECT p.*, u.name AS creator_name,
          COUNT(DISTINCT pm.user_id) AS member_count,
          COUNT(DISTINCT t.id) AS task_count,
          COUNT(DISTINCT t.id) FILTER (WHERE t.status='done') AS done_count
        FROM projects p
        JOIN users u ON u.id = p.created_by
        LEFT JOIN project_members pm ON pm.project_id = p.id
        LEFT JOIN tasks t ON t.project_id = p.id
        GROUP BY p.id, u.name ORDER BY p.created_at DESC
      `);
    } else {
      q = await pool.query(`
        SELECT p.*, u.name AS creator_name,
          COUNT(DISTINCT pm2.user_id) AS member_count,
          COUNT(DISTINCT t.id) AS task_count,
          COUNT(DISTINCT t.id) FILTER (WHERE t.status='done') AS done_count
        FROM projects p
        JOIN users u ON u.id = p.created_by
        JOIN project_members pm ON pm.project_id = p.id AND pm.user_id=$1
        LEFT JOIN project_members pm2 ON pm2.project_id = p.id
        LEFT JOIN tasks t ON t.project_id = p.id
        GROUP BY p.id, u.name ORDER BY p.created_at DESC
      `, [req.user.id]);
    }
    res.json(q.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects  — admin only
router.post('/', authenticate, requireAdmin, projectFields, validate, async (req, res) => {
  const { name, description, memberIds = [] } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'INSERT INTO projects (name, description, created_by) VALUES ($1,$2,$3) RETURNING *',
      [name, description, req.user.id]
    );
    const project = rows[0];
    const allMembers = [...new Set([req.user.id, ...memberIds])];
    await Promise.all(allMembers.map(uid =>
      client.query('INSERT INTO project_members (project_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [project.id, uid])
    ));
    await client.query('COMMIT');
    res.status(201).json({ ...project, member_count: allMembers.length });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET /api/projects/:id
router.get('/:id', authenticate, projectMember, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, u.name AS creator_name FROM projects p
      JOIN users u ON u.id = p.created_by WHERE p.id=$1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Project not found' });

    const members = await pool.query(`
      SELECT u.id, u.name, u.email, u.role FROM users u
      JOIN project_members pm ON pm.user_id = u.id WHERE pm.project_id=$1
    `, [req.params.id]);

    res.json({ ...rows[0], members: members.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/projects/:id  — admin only
router.put('/:id', authenticate, requireAdmin, projectFields, validate, async (req, res) => {
  const { name, description } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE projects SET name=$1, description=$2 WHERE id=$3 RETURNING *',
      [name, description, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Project not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:id  — admin only
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM projects WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Project not found' });
    res.json({ message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:id/members  — admin only
router.post('/:id/members', authenticate, requireAdmin, async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(422).json({ error: 'userId required' });
  try {
    await pool.query(
      'INSERT INTO project_members (project_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.params.id, userId]
    );
    res.json({ message: 'Member added' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:id/members/:userId  — admin only
router.delete('/:id/members/:userId', authenticate, requireAdmin, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM project_members WHERE project_id=$1 AND user_id=$2',
      [req.params.id, req.params.userId]
    );
    res.json({ message: 'Member removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
