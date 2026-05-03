const router = require('express').Router();
const { body } = require('express-validator');
const pool = require('../db/pool');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

// Guard: user must be a project member to touch its tasks
async function memberOfProject(projectId, userId, role) {
  if (role === 'admin') return true;
  const { rows } = await pool.query(
    'SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2',
    [projectId, userId]
  );
  return rows.length > 0;
}

const taskFields = [
  body('title').trim().isLength({ min: 2 }).withMessage('Title required (min 2 chars)'),
  body('description').optional().trim(),
  body('status').optional().isIn(['todo','in-progress','done']).withMessage('Invalid status'),
  body('assignedTo').optional().isUUID(),
  body('dueDate').optional({ nullable: true }).isISO8601().withMessage('Invalid date format'),
  body('projectId').isUUID().withMessage('projectId required'),
];

// GET /api/tasks  — my tasks or all (admin). Filters: status, projectId, assignedTo, overdue
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, projectId, assignedTo, overdue } = req.query;
    const conditions = [];
    const values = [];
    let idx = 1;

    if (req.user.role !== 'admin') {
      conditions.push(`pm.user_id=$${idx++}`);
      values.push(req.user.id);
    }
    if (status) { conditions.push(`t.status=$${idx++}`); values.push(status); }
    if (projectId) { conditions.push(`t.project_id=$${idx++}`); values.push(projectId); }
    if (assignedTo) { conditions.push(`t.assigned_to=$${idx++}`); values.push(assignedTo); }
    if (overdue === 'true') {
      conditions.push(`t.status != 'done' AND t.due_date < CURRENT_DATE`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const q = await pool.query(`
      SELECT t.*,
        u.name AS assignee_name,
        p.name AS project_name,
        c.name AS creator_name
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      LEFT JOIN project_members pm ON pm.project_id = t.project_id
      LEFT JOIN users u ON u.id = t.assigned_to
      LEFT JOIN users c ON c.id = t.created_by
      ${where}
      GROUP BY t.id, u.name, p.name, c.name
      ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC
    `, values);

    res.json(q.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks  — project members can create
router.post('/', authenticate, taskFields, validate, async (req, res) => {
  const { title, description, projectId, assignedTo, dueDate, status = 'todo' } = req.body;
  try {
    const allowed = await memberOfProject(projectId, req.user.id, req.user.role);
    if (!allowed) return res.status(403).json({ error: 'Not a member of this project' });

    const { rows } = await pool.query(`
      INSERT INTO tasks (title, description, project_id, assigned_to, due_date, status, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
    `, [title, description, projectId, assignedTo || null, dueDate || null, status, req.user.id]);

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT t.*, u.name AS assignee_name, p.name AS project_name
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      LEFT JOIN users u ON u.id = t.assigned_to
      WHERE t.id=$1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Task not found' });

    const task = rows[0];
    const allowed = await memberOfProject(task.project_id, req.user.id, req.user.role);
    if (!allowed) return res.status(403).json({ error: 'Access denied' });

    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/tasks/:id  — assignee or admin can update
router.put('/:id', authenticate, [
  body('title').optional().trim().isLength({ min: 2 }),
  body('status').optional().isIn(['todo','in-progress','done']),
  body('dueDate').optional({ nullable: true }).isISO8601(),
], validate, async (req, res) => {
  try {
    const { rows: taskRows } = await pool.query('SELECT * FROM tasks WHERE id=$1', [req.params.id]);
    if (!taskRows.length) return res.status(404).json({ error: 'Task not found' });
    const task = taskRows[0];

    const isAdmin = req.user.role === 'admin';
    const isAssignee = task.assigned_to === req.user.id;
    const isCreator = task.created_by === req.user.id;
    if (!isAdmin && !isAssignee && !isCreator) {
      return res.status(403).json({ error: 'You cannot edit this task' });
    }

    const { title, description, status, assignedTo, dueDate } = req.body;
    const fields = [];
    const vals = [];
    let idx = 1;
    if (title !== undefined) { fields.push(`title=$${idx++}`); vals.push(title); }
    if (description !== undefined) { fields.push(`description=$${idx++}`); vals.push(description); }
    if (status !== undefined) { fields.push(`status=$${idx++}`); vals.push(status); }
    if (isAdmin && assignedTo !== undefined) { fields.push(`assigned_to=$${idx++}`); vals.push(assignedTo || null); }
    if (dueDate !== undefined) { fields.push(`due_date=$${idx++}`); vals.push(dueDate || null); }
    if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });

    vals.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE tasks SET ${fields.join(',')} WHERE id=$${idx} RETURNING *`,
      vals
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tasks/:id  — admin only
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM tasks WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/tasks/:id/status  — quick status update for assignee
router.patch('/:id/status', authenticate, [
  body('status').isIn(['todo','in-progress','done']).withMessage('Invalid status'),
], validate, async (req, res) => {
  try {
    const { rows: taskRows } = await pool.query('SELECT * FROM tasks WHERE id=$1', [req.params.id]);
    if (!taskRows.length) return res.status(404).json({ error: 'Task not found' });
    const task = taskRows[0];

    const allowed = req.user.role === 'admin' || task.assigned_to === req.user.id || task.created_by === req.user.id;
    if (!allowed) return res.status(403).json({ error: 'Cannot update this task' });

    const { rows } = await pool.query(
      'UPDATE tasks SET status=$1 WHERE id=$2 RETURNING *',
      [req.body.status, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
