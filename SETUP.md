# Student Finance Setup

## Local use on this computer

Create `.env` inside `expense-manager`:

```text
GMAIL_USER=yourgmail@gmail.com
GMAIL_APP_PASSWORD=your-google-app-password
```

Start:

```powershell
cd C:\Users\meroxio\.vscode\expense-manager
npm start
```

Open:

```text
http://localhost:3000
```

## React development mode

This branch uses Vite React for the frontend.

Terminal 1, start the backend API:

```powershell
npm start
```

Terminal 2, start the React dev server:

```powershell
npm run dev
```

Open the Vite URL, usually:

```text
http://localhost:5173
```

The Vite server proxies `/api` requests to the Node backend on port `3000`.

Without `DATABASE_URL`, the app uses local SQLite:

```text
data/expense-manager.sqlite
```

## Cloud database mode

For cloud hosting, use Supabase Postgres and add this to environment variables:

```text
DATABASE_URL=postgresql://postgres:password@db.project.supabase.co:5432/postgres
```

When `DATABASE_URL` exists, the server automatically uses Postgres instead of SQLite.

## Enable Gmail reset codes

Use a Google App Password, not your normal Gmail password.

1. Open your Google Account.
2. Go to Security.
3. Turn on 2-Step Verification.
4. Open App passwords.
5. Create an app password.
6. Use it as `GMAIL_APP_PASSWORD`.

If these are not set, password reset will show a setup error.

## Phone on same Wi-Fi

When the server starts, it prints:

```text
Same Wi-Fi access: http://192.168.x.x:3000
```

Open that URL on your phone while both devices are on the same Wi-Fi.

## Important

Do not upload:

```text
.env
data/
node_modules/
```

For real cloud use, deploy to Render and set `DATABASE_URL`, `GMAIL_USER`, and `GMAIL_APP_PASSWORD` in Render environment variables.
