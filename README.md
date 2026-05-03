# TaskFlow — Team Task Manager API

Full-stack REST API for managing projects and tasks with role-based access control (Admin/Member).

## Tech Stack
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL (hosted on Railway)
- **Auth**: JWT (7-day tokens)
- **Security**: bcrypt password hashing, Helmet headers, input validation

---

## Local Development

### Prerequisites
- Node.js 18+
- PostgreSQL (local or remote)

### Setup
```bash
git clone <your-repo>
cd taskflow-api
npm install
cp .env.example .env
# Fill in your .env values
npm run dev
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Long random secret for signing JWTs |
| `PORT` | Server port (default 4000) |
| `NODE_ENV` | `development` or `production` |
| `FRONTEND_URL` | Your frontend origin for CORS |

---

## Deploy to Railway

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add a **PostgreSQL** plugin — Railway auto-sets `DATABASE_URL`
4. Set environment variables: `JWT_SECRET`, `NODE_ENV=production`, `FRONTEND_URL`
5. Railway reads `railway.toml` and starts the server automatically
6. Your live URL: `https://<your-app>.up.railway.app`

---

## API Reference

### Authentication

#### POST `/api/auth/signup`
```json
{ "name": "Alice", "email": "alice@example.com", "password": "secret123", "role": "admin" }
```
Returns `{ token, user }`

#### POST `/api/auth/login`
```json
{ "email": "alice@example.com", "password": "secret123" }
```
Returns `{ token, user }`

#### GET `/api/auth/me`
Headers: `Authorization: Bearer <token>`
Returns current user object.

#### PUT `/api/auth/me`
Update own name or password.

---

### Projects (Admin-managed, Members can view)

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/projects` | Any | List accessible projects |
| POST | `/api/projects` | Admin | Create project |
| GET | `/api/projects/:id` | Member+ | Get project with members |
| PUT | `/api/projects/:id` | Admin | Update project |
| DELETE | `/api/projects/:id` | Admin | Delete project |
| POST | `/api/projects/:id/members` | Admin | Add member `{ userId }` |
| DELETE | `/api/projects/:id/members/:userId` | Admin | Remove member |

---

### Tasks

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/tasks` | Any | List tasks (filtered by membership) |
| POST | `/api/tasks` | Member+ | Create task |
| GET | `/api/tasks/:id` | Member+ | Get task detail |
| PUT | `/api/tasks/:id` | Assignee/Admin | Update task |
| PATCH | `/api/tasks/:id/status` | Assignee/Admin | Quick status update |
| DELETE | `/api/tasks/:id` | Admin | Delete task |

**Task filters** (query params on `GET /api/tasks`):
- `?status=todo|in-progress|done`
- `?projectId=<uuid>`
- `?assignedTo=<uuid>`
- `?overdue=true`

**Task body:**
```json
{
  "title": "Build login screen",
  "description": "Use React + Formik",
  "projectId": "<uuid>",
  "assignedTo": "<uuid>",
  "dueDate": "2024-12-31",
  "status": "todo"
}
```

---

### Users

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/users` | Any | List all users |
| GET | `/api/users/:id` | Any | User profile + stats |
| PUT | `/api/users/:id/role` | Admin | Change user role |
| DELETE | `/api/users/:id` | Admin | Remove user |
| GET | `/api/users/dashboard/summary` | Any | Logged-in user dashboard stats |

---

## Role-Based Access Control

| Action | Member | Admin |
|---|---|---|
| View own tasks | ✅ | ✅ |
| View all tasks | ❌ | ✅ |
| Create task | ✅ (in own projects) | ✅ |
| Update task status | ✅ (if assigned) | ✅ |
| Delete task | ❌ | ✅ |
| View projects | ✅ (own only) | ✅ (all) |
| Create/edit/delete project | ❌ | ✅ |
| Manage members | ❌ | ✅ |
| Manage users | ❌ | ✅ |

---

## Database Schema

```
users          — id, name, email, password, role, created_at
projects       — id, name, description, created_by, created_at
project_members — project_id, user_id (join table)
tasks          — id, project_id, title, description, status, assigned_to, due_date, created_by, created_at, updated_at
```

---

## Submission Checklist
- [x] Authentication (Signup / Login / JWT)
- [x] Role-based access control (Admin / Member)
- [x] Project & team management
- [x] Task creation, assignment & status tracking
- [x] Dashboard summary endpoint
- [x] REST APIs with proper HTTP status codes
- [x] Input validation & error handling
- [x] PostgreSQL with relational schema
- [x] Railway deployment config
