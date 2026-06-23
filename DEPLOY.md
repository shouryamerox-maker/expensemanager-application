# Deploy Student Finance for Free

Use this setup:

- App hosting: Render Free Web Service
- Database: Supabase Free Postgres
- Email reset: Gmail App Password

## 1. Create Supabase database

1. Go to Supabase.
2. Create a new project.
3. Open Project Settings.
4. Open Database.
5. Click **Connect**.
6. Copy the **Connection pooler** string, not the direct connection string.
7. Use **Shared Pooler / Session mode** on port `5432`.

It will look like this:

```text
postgresql://postgres.YOUR_PROJECT_ID:YOUR_PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres
```

Do not use the direct URL like `db.YOUR_PROJECT.supabase.co:5432` on Render Free. Supabase direct connections are IPv6 on free projects, and Render may fail with `ENETUNREACH`.

## 2. Push project to GitHub

Upload the `expense-manager` folder to a GitHub repository.

Do not upload:

```text
.env
data/
node_modules/
```

## 3. Create Render Web Service

1. Go to Render.
2. New > Web Service.
3. Connect your GitHub repo.
4. Use these settings:

```text
Root Directory: leave blank
Build Command: npm install && npm run build
Start Command: npm start
Health Check Path: /api/health
```

## 4. Add Render environment variables

```text
DATABASE_URL=your-supabase-postgres-url
GMAIL_USER=yourgmail@gmail.com
GMAIL_APP_PASSWORD=your-google-app-password
```

Do not add quotes around values unless Render adds them automatically.

## 5. Deploy

Click Deploy.

After deploy, Render gives a public URL like:

```text
https://your-app-name.onrender.com
```

Use that URL on your phone or any computer.

## Notes

- Local mode uses SQLite when `DATABASE_URL` is missing.
- Cloud mode uses Postgres when `DATABASE_URL` is present.
- Render Free may sleep when inactive, so the first load can take about a minute.
- Your data is stored in Supabase, not Render's local filesystem.
