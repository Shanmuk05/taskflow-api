import { useState, useEffect } from 'react'
import { Layout, Folder, CheckSquare, Users, Plus, LogOut, Trash2, CheckCircle2, Clock } from 'lucide-react'
import './index.css'

const API_URL = import.meta.env.PROD ? '/api' : 'https://taskflow-api-production-3753.up.railway.app/api';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [view, setView] = useState('dashboard'); // dashboard, projects, tasks, users
  const [authMode, setAuthMode] = useState('login'); // login or signup
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Data states
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  
  // Modal states
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '' });
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', projectId: '', assignedTo: '' });

  useEffect(() => {
    if (token) {
      fetchInitialData();
    }
  }, [token]);

  const fetchInitialData = async () => {
    setLoading(true);
    await Promise.all([
      fetchUser(),
      fetchDashboard(),
      fetchProjects(),
      fetchTasks(),
      fetchUsers()
    ]);
    setLoading(false);
  };

  const fetchUser = async () => {
    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setUser(data);
      else handleLogout();
    } catch (err) { console.error(err); }
  };

  const fetchDashboard = async () => {
    try {
      const res = await fetch(`${API_URL}/users/dashboard/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setDashboardData(data);
    } catch (err) { console.error(err); }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API_URL}/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setProjects(data.value);
    } catch (err) { console.error(err); }
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_URL}/tasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setTasks(data.value);
    } catch (err) { console.error(err); }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setAllUsers(data.value);
    } catch (err) { console.error(err); }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const email = e.target.email.value;
    const password = e.target.password.value;
    const name = authMode === 'signup' ? e.target.name.value : undefined;
    
    const endpoint = authMode === 'signup' ? '/auth/signup' : '/auth/login';
    const bodyPayload = authMode === 'signup' ? { name, email, password } : { email, password };
    
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        localStorage.setItem('token', data.token);
      } else {
        setError(data.error || `${authMode === 'signup' ? 'Signup' : 'Login'} failed`);
      }
    } catch (err) {
      setError('Network error connecting to API');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newProject)
      });
      if (res.ok) {
        setShowProjectModal(false);
        setNewProject({ name: '', description: '' });
        fetchProjects();
        fetchDashboard();
      }
    } catch (err) { console.error(err); }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newTask)
      });
      if (res.ok) {
        setShowTaskModal(false);
        setNewTask({ title: '', description: '', projectId: '', assignedTo: '' });
        fetchTasks();
        fetchDashboard();
      }
    } catch (err) { console.error(err); }
  };

  const handleUpdateTaskStatus = async (taskId, status) => {
    try {
      const res = await fetch(`${API_URL}/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchTasks();
        fetchDashboard();
      }
    } catch (err) { console.error(err); }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
  };

  if (!token || !user) {
    return (
      <div className="auth-layout">
        <div className="card">
          <div style={{textAlign: 'center', marginBottom: '24px'}}>
             <div className="avatar" style={{width: '64px', height: '64px', margin: '0 auto 16px', fontSize: '1.5rem'}}>TF</div>
             <h1 className="title">Welcome to TaskFlow</h1>
             <p className="subtitle">{authMode === 'login' ? 'Sign in to manage your team' : 'Create a new account'}</p>
          </div>
          
          <form onSubmit={handleAuth}>
            {authMode === 'signup' && (
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input name="name" type="text" className="form-input" placeholder="John Doe" required />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input name="email" type="email" className="form-input" placeholder="user@taskflow.com" required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input name="password" type="password" className="form-input" placeholder="••••••••" required />
            </div>
            {error && <div className="error-message">{error}</div>}
            <button type="submit" className="btn" style={{width: '100%', marginTop: '12px'}} disabled={loading}>
              {loading ? 'Authenticating...' : (authMode === 'login' ? 'Sign In' : 'Sign Up')}
            </button>
            <div style={{textAlign: 'center', marginTop: '16px', fontSize: '0.9rem'}}>
              {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
              <a href="#" onClick={(e) => { e.preventDefault(); setAuthMode(authMode === 'login' ? 'signup' : 'login'); setError(''); }} style={{color: 'var(--primary)', textDecoration: 'none'}}>
                {authMode === 'login' ? 'Sign up' : 'Log in'}
              </a>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container dashboard">
      <header className="header">
        <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
          <div className="avatar" style={{width: '40px', height: '40px'}}>TF</div>
          <div>
            <h1 className="title" style={{fontSize: '1.8rem', marginBottom: '0'}}>TaskFlow</h1>
          </div>
        </div>
        <div className="user-badge">
          <div className="avatar">{user.name.charAt(0)}</div>
          <div style={{marginRight: '12px'}}>
            <div style={{fontWeight: 600, fontSize: '0.9rem'}}>{user.name}</div>
            <div style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>{user.role}</div>
          </div>
          <button onClick={handleLogout} className="btn" style={{padding: '8px', background: 'transparent', border: '1px solid var(--border)'}}>
            <LogOut size={18} color="var(--error)" />
          </button>
        </div>
      </header>

      <nav className="nav-tabs">
        <div className={`nav-link ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}>
          <Layout size={18} style={{verticalAlign: 'middle', marginRight: '8px'}} /> Dashboard
        </div>
        <div className={`nav-link ${view === 'projects' ? 'active' : ''}`} onClick={() => setView('projects')}>
          <Folder size={18} style={{verticalAlign: 'middle', marginRight: '8px'}} /> Projects
        </div>
        <div className={`nav-link ${view === 'tasks' ? 'active' : ''}`} onClick={() => setView('tasks')}>
          <CheckSquare size={18} style={{verticalAlign: 'middle', marginRight: '8px'}} /> My Tasks
        </div>
        <div className={`nav-link ${view === 'users' ? 'active' : ''}`} onClick={() => setView('users')}>
          <Users size={18} style={{verticalAlign: 'middle', marginRight: '8px'}} /> Team
        </div>
      </nav>

      {view === 'dashboard' && dashboardData && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{dashboardData.projects?.count || 0}</div>
              <div className="stat-label">Active Projects</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{dashboardData.tasks?.total || 0}</div>
              <div className="stat-label">Total Tasks</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{dashboardData.tasks?.in_progress || 0}</div>
              <div className="stat-label">In Progress</div>
            </div>
            <div className="stat-card" style={{borderColor: 'var(--success)'}}>
              <div className="stat-value" style={{color: 'var(--success)'}}>{dashboardData.tasks?.done || 0}</div>
              <div className="stat-label">Completed</div>
            </div>
            <div className="stat-card" style={{borderColor: 'var(--error)'}}>
              <div className="stat-value" style={{color: 'var(--error)'}}>
                {tasks.filter(t => t.status !== 'done' && new Date(t.due_date || t.created_at) < new Date()).length}
              </div>
              <div className="stat-label">Overdue Tasks</div>
            </div>
          </div>

          <div style={{display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px'}}>
             <div className="card" style={{maxWidth: 'none'}}>
                <h3 className="title" style={{fontSize: '1.2rem'}}>Recent Projects</h3>
                <div className="project-grid" style={{gridTemplateColumns: '1fr', gap: '16px'}}>
                   {projects.slice(0, 3).map(p => (
                     <div key={p.id} className="user-badge" style={{justifyContent: 'space-between', padding: '16px'}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                           <Folder size={20} color="var(--primary)" />
                           <div>
                              <div style={{fontWeight: 600}}>{p.name}</div>
                              <div style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{p.task_count} tasks</div>
                           </div>
                        </div>
                        <div className="badge badge-in-progress">active</div>
                     </div>
                   ))}
                </div>
             </div>
             <div className="card" style={{maxWidth: 'none'}}>
                <h3 className="title" style={{fontSize: '1.2rem'}}>Team Activity</h3>
                <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
                   {allUsers.slice(0, 5).map(u => (
                     <div key={u.id} style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                        <div className="avatar" style={{width: '28px', height: '28px', fontSize: '0.7rem'}}>{u.name.charAt(0)}</div>
                        <div style={{fontSize: '0.9rem'}}>{u.name} joined the team</div>
                     </div>
                   ))}
                </div>
             </div>
          </div>
        </>
      )}

      {view === 'projects' && (
        <div>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px'}}>
            <h2 className="title" style={{fontSize: '1.5rem', marginBottom: 0}}>Projects</h2>
            {user.role === 'admin' && (
              <button className="btn" onClick={() => setShowProjectModal(true)}>
                <Plus size={18} /> New Project
              </button>
            )}
          </div>

          <div className="project-grid">
            {projects.map(p => (
              <div key={p.id} className="project-card">
                <div>
                  <h3 className="project-name">{p.name}</h3>
                  <p className="project-desc">{p.description}</p>
                </div>
                <div className="project-footer">
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <Users size={16} color="var(--text-muted)" />
                    <span style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{p.member_count} members</span>
                  </div>
                  <div className="badge badge-in-progress">{p.task_count} tasks</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'tasks' && (
        <div>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px'}}>
            <h2 className="title" style={{fontSize: '1.5rem', marginBottom: 0}}>My Tasks</h2>
            {user.role === 'admin' && (
              <button className="btn" onClick={() => setShowTaskModal(true)}>
                <Plus size={18} /> New Task
              </button>
            )}
          </div>
          <table className="task-table">
            <thead>
              <tr style={{textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.85rem'}}>
                <th style={{padding: '0 20px'}}>TASK</th>
                <th style={{padding: '0 20px'}}>PROJECT</th>
                <th style={{padding: '0 20px'}}>STATUS</th>
                <th style={{padding: '0 20px'}}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(t => (
                <tr key={t.id} className="task-row">
                  <td className="task-cell">
                    <div style={{fontWeight: 600}}>{t.title}</div>
                    <div style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{t.description}</div>
                  </td>
                  <td className="task-cell">
                    <div className="badge" style={{background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)'}}>{t.project_name}</div>
                  </td>
                  <td className="task-cell">
                    <span className={`badge badge-${t.status}`}>
                      {t.status.replace('-', ' ')}
                    </span>
                  </td>
                  <td className="task-cell">
                    <div style={{display: 'flex', gap: '12px'}}>
                      {t.status !== 'done' ? (
                        <button onClick={() => handleUpdateTaskStatus(t.id, 'done')} className="btn" style={{padding: '8px', background: 'var(--success)'}}>
                          <CheckCircle2 size={16} />
                        </button>
                      ) : (
                        <button onClick={() => handleUpdateTaskStatus(t.id, 'in-progress')} className="btn" style={{padding: '8px', background: 'var(--bg-surface-hover)'}}>
                          <Clock size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'users' && (
        <div>
          <h2 className="title" style={{fontSize: '1.5rem', marginBottom: '32px'}}>Team Members</h2>
          <div className="project-grid">
            {allUsers.map(u => (
              <div key={u.id} className="user-badge" style={{padding: '20px', justifyContent: 'flex-start', gap: '16px'}}>
                <div className="avatar" style={{width: '48px', height: '48px', fontSize: '1.2rem'}}>{u.name.charAt(0)}</div>
                <div>
                  <div style={{fontWeight: 700}}>{u.name}</div>
                  <div style={{fontSize: '0.85rem', color: 'var(--text-muted)'}}>{u.email}</div>
                  <div className="badge badge-in-progress" style={{marginTop: '8px', display: 'inline-block'}}>{u.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showProjectModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="title" style={{fontSize: '1.5rem'}}>Create Project</h2>
            <form onSubmit={handleCreateProject}>
              <div className="form-group">
                <label className="form-label">Project Name</label>
                <input 
                  className="form-input" 
                  value={newProject.name} 
                  onChange={e => setNewProject({...newProject, name: e.target.value})} 
                  placeholder="e.g. Mobile App"
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea 
                  className="form-input" 
                  rows="3" 
                  value={newProject.description} 
                  onChange={e => setNewProject({...newProject, description: e.target.value})} 
                  placeholder="What is this project about?"
                  style={{resize: 'none'}}
                />
              </div>
              <div style={{display: 'flex', gap: '16px', marginTop: '24px'}}>
                <button type="submit" className="btn" style={{flex: 1}}>Create</button>
                <button type="button" className="btn" style={{flex: 1, background: 'transparent', border: '1px solid var(--border)'}} onClick={() => setShowProjectModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTaskModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="title" style={{fontSize: '1.5rem'}}>Create Task</h2>
            <form onSubmit={handleCreateTask}>
              <div className="form-group">
                <label className="form-label">Task Title</label>
                <input 
                  className="form-input" 
                  value={newTask.title} 
                  onChange={e => setNewTask({...newTask, title: e.target.value})} 
                  placeholder="e.g. Design Login Page"
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea 
                  className="form-input" 
                  rows="3" 
                  value={newTask.description} 
                  onChange={e => setNewTask({...newTask, description: e.target.value})} 
                  placeholder="Task details..."
                  style={{resize: 'none'}}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Project</label>
                <select 
                  className="form-input" 
                  value={newTask.projectId} 
                  onChange={e => setNewTask({...newTask, projectId: e.target.value})}
                  required
                >
                  <option value="">Select a project...</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Assign To</label>
                <select 
                  className="form-input" 
                  value={newTask.assignedTo} 
                  onChange={e => setNewTask({...newTask, assignedTo: e.target.value})}
                  required
                >
                  <option value="">Select a team member...</option>
                  {allUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div style={{display: 'flex', gap: '16px', marginTop: '24px'}}>
                <button type="submit" className="btn" style={{flex: 1}}>Create Task</button>
                <button type="button" className="btn" style={{flex: 1, background: 'transparent', border: '1px solid var(--border)'}} onClick={() => setShowTaskModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
