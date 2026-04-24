# Step School CRM

Step School CRM is a lightweight Express + MongoDB application for managing:

- boss/admin authentication
- teachers and staff
- students
- groups
- payments and summary reports

## Stack

- Node.js
- Express
- MongoDB Atlas
- Mongoose
- Vanilla JS frontend

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create your environment file:

```powershell
Copy-Item .env.example .env
```

3. Fill `.env` with:

- `MONGO_URI`
- `JWT_SECRET`
- `PORT`

4. Start the app:

```bash
npm run dev
```

5. Open:

```text
http://localhost:3000
```

## Free deployment

Recommended path:

- Backend + frontend together on Render free web service
- Database on MongoDB Atlas free tier

### MongoDB Atlas

1. Create a free cluster.
2. Create a database user.
3. Add your IP for testing, then allow Render access as needed.
4. Copy the connection string into `MONGO_URI`.

### Render

1. Push this project to GitHub.
2. Sign in to Render.
3. Create a new `Web Service`.
4. Connect the GitHub repository.
5. Render should detect `render.yaml`, or you can configure manually:
   - Build command: `npm install`
   - Start command: `npm start`
   - Node version: `20`
6. Add environment variables:
   - `MONGO_URI`
   - `JWT_SECRET`
7. Deploy.

After first deploy:

1. Open the app URL.
2. If no boss user exists, the setup screen appears.
3. Create the boss account.
4. Start adding teachers, students, groups, and payments.

## Important security notes

- Do not commit your real `.env`.
- Rotate old MongoDB and JWT secrets if they were previously exposed.
- Use a long random `JWT_SECRET`.

## Current routes

- `GET /api/health`
- `GET /api/auth/status`
- `POST /api/auth/setup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/admin/overview`
- `GET /api/admin/reports`
- `GET /api/admin/teachers`
- `POST /api/admin/teachers`
- `PUT /api/admin/teachers/:id`
- `DELETE /api/admin/teachers/:id`
- `GET /api/admin/students`
- `POST /api/admin/students`
- `PUT /api/admin/students/:id`
- `DELETE /api/admin/students/:id`
- `GET /api/admin/groups`
- `POST /api/admin/groups`
- `PUT /api/admin/groups/:id`
- `DELETE /api/admin/groups/:id`
- `GET /api/admin/payments`
- `POST /api/admin/payments`
