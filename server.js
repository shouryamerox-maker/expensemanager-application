const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const nodemailer = require("nodemailer");
const os = require("os");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DIST_DIR = path.join(ROOT, "dist");
const DATA_DIR = path.join(ROOT, "data");
const SQLITE_PATH = path.join(DATA_DIR, "expense-manager.sqlite");
const LEGACY_JSON_PATH = path.join(DATA_DIR, "database.json");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

loadEnvFile();

let db;
let databaseType = "sqlite";

async function start() {
  db = await openDatabase();
  await migrateLegacyJson();

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);

      if (url.pathname.startsWith("/api/")) {
        await handleApi(req, res, url);
        return;
      }

      serveStatic(res, url.pathname);
    } catch (error) {
      sendJson(res, 500, { error: "Server error", detail: error.message });
    }
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Student Finance running at http://localhost:${PORT}`);
    console.log(`Database: ${databaseType}${databaseType === "sqlite" ? ` (${SQLITE_PATH})` : ""}`);
    getNetworkUrls().forEach((url) => console.log(`Same Wi-Fi access: ${url}`));
  });
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      database: databaseType,
      uptime: process.uptime(),
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/login") {
    const body = await readJson(req);
    const email = normalizeEmail(body.email);
    const user = await getUser(email);

    if (!user || user.passwordHash !== hashPassword(body.password, user.salt)) {
      sendJson(res, 401, { error: "Invalid Gmail or password" });
      return;
    }

    sendJson(res, 200, { ok: true, email, state: user.state || emptyState(email) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/register") {
    const body = await readJson(req);
    const email = normalizeEmail(body.email);

    if (!email || !body.password || body.password.length < 4) {
      sendJson(res, 400, { error: "Gmail and password are required" });
      return;
    }

    if (await getUser(email)) {
      sendJson(res, 409, { error: "Account already exists. Use login." });
      return;
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const state = emptyState(email);
    await createUser({
      email,
      salt,
      passwordHash: hashPassword(body.password, salt),
      resetCode: "",
      state,
    });
    sendJson(res, 200, { ok: true, email, state });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/state") {
    const email = normalizeEmail(url.searchParams.get("email"));
    const user = await getUser(email);

    if (!user) {
      sendJson(res, 404, { error: "Account not found" });
      return;
    }

    sendJson(res, 200, { ok: true, state: user.state || emptyState(email) });
    return;
  }

  if (req.method === "PUT" && url.pathname === "/api/state") {
    const body = await readJson(req);
    const email = normalizeEmail(body.email);

    if (!(await getUser(email))) {
      sendJson(res, 404, { error: "Account not found" });
      return;
    }

    await updateState(email, sanitizeState(body.state, email));
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/request-reset") {
    const body = await readJson(req);
    const email = normalizeEmail(body.email);
    const user = await getUser(email);

    if (!user) {
      sendJson(res, 404, { error: "Account not found" });
      return;
    }

    const resetCode = String(Math.floor(100000 + Math.random() * 900000));
    await updateResetCode(email, resetCode);

    try {
      await sendResetEmail(email, resetCode);
    } catch (error) {
      sendJson(res, 503, {
        error: error.message,
        setup: "Set GMAIL_USER and GMAIL_APP_PASSWORD, then restart the server.",
      });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      email,
      note: "Reset code sent to your Gmail.",
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/reset-password") {
    const body = await readJson(req);
    const email = normalizeEmail(body.email);
    const user = await getUser(email);

    if (!user || !user.resetCode || user.resetCode !== String(body.code || "")) {
      sendJson(res, 401, { error: "Invalid reset code" });
      return;
    }

    const salt = crypto.randomBytes(16).toString("hex");
    await updatePassword(email, salt, hashPassword(body.password, salt));
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { error: "Not found" });
}

function serveStatic(res, pathname) {
  const cleanPath = pathname === "/" ? "/index.html" : pathname;
  const staticRoot = fs.existsSync(path.join(DIST_DIR, "index.html")) ? DIST_DIR : ROOT;
  const fullPath = path.join(staticRoot, cleanPath);

  if (!fullPath.startsWith(staticRoot) || !fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
    sendText(res, 404, "Not found");
    return;
  }

  const ext = path.extname(fullPath);
  res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
  fs.createReadStream(fullPath).pipe(res);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function openDatabase() {
  if (process.env.DATABASE_URL) {
    databaseType = "postgres";
    const { Pool } = require("pg");
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: shouldUsePostgresSsl(process.env.DATABASE_URL) ? { rejectUnauthorized: false } : false,
    });
    await pool.query(postgresSchema);
    return { kind: "postgres", pool };
  }

  databaseType = "sqlite";
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const { DatabaseSync } = require("node:sqlite");
  const sqlite = new DatabaseSync(SQLITE_PATH);
  sqlite.exec(sqliteSchema);
  return { kind: "sqlite", sqlite };
}

async function migrateLegacyJson() {
  if (db.kind !== "sqlite") return;
  if (!fs.existsSync(LEGACY_JSON_PATH)) return;
  if (db.sqlite.prepare("SELECT COUNT(*) AS count FROM users").get().count > 0) return;

  const legacy = JSON.parse(fs.readFileSync(LEGACY_JSON_PATH, "utf8"));
  for (const user of Object.values(legacy.users || {})) {
    await createUser({
      email: normalizeEmail(user.email),
      salt: user.salt,
      passwordHash: user.passwordHash,
      resetCode: user.resetCode || "",
      state: user.state || emptyState(user.email),
    });
  }
  console.log("Migrated legacy JSON data into SQLite.");
}

async function getUser(email) {
  if (!email) return null;

  if (db.kind === "postgres") {
    const result = await db.pool.query(
      "SELECT email, salt, password_hash, reset_code, state_json FROM users WHERE email = $1",
      [email]
    );
    const row = result.rows[0];
    return row ? rowToUser(row) : null;
  }

  const row = db.sqlite
    .prepare("SELECT email, salt, password_hash, reset_code, state_json FROM users WHERE email = ?")
    .get(email);
  return row ? rowToUser(row) : null;
}

async function createUser(user) {
  if (db.kind === "postgres") {
    await db.pool.query(
      `INSERT INTO users (email, salt, password_hash, reset_code, state_json)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.email, user.salt, user.passwordHash, user.resetCode || "", JSON.stringify(user.state)]
    );
    return;
  }

  db.sqlite
    .prepare(
      `INSERT INTO users (email, salt, password_hash, reset_code, state_json)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(user.email, user.salt, user.passwordHash, user.resetCode || "", JSON.stringify(user.state));
}

async function updateState(email, state) {
  if (db.kind === "postgres") {
    await db.pool.query("UPDATE users SET state_json = $1, updated_at = NOW() WHERE email = $2", [
      JSON.stringify(state),
      email,
    ]);
    return;
  }

  db.sqlite
    .prepare("UPDATE users SET state_json = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?")
    .run(JSON.stringify(state), email);
}

async function updateResetCode(email, resetCode) {
  if (db.kind === "postgres") {
    await db.pool.query("UPDATE users SET reset_code = $1, updated_at = NOW() WHERE email = $2", [resetCode, email]);
    return;
  }

  db.sqlite.prepare("UPDATE users SET reset_code = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?").run(resetCode, email);
}

async function updatePassword(email, salt, passwordHash) {
  if (db.kind === "postgres") {
    await db.pool.query(
      `UPDATE users
       SET salt = $1, password_hash = $2, reset_code = '', updated_at = NOW()
       WHERE email = $3`,
      [salt, passwordHash, email]
    );
    return;
  }

  db.sqlite
    .prepare(
      `UPDATE users
       SET salt = ?, password_hash = ?, reset_code = '', updated_at = CURRENT_TIMESTAMP
       WHERE email = ?`
    )
    .run(salt, passwordHash, email);
}

function rowToUser(row) {
  return {
    email: row.email,
    salt: row.salt,
    passwordHash: row.password_hash,
    resetCode: row.reset_code || "",
    state: typeof row.state_json === "string" ? JSON.parse(row.state_json) : row.state_json,
  };
}

function loadEnvFile() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) return;
    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) process.env[key] = value;
  });
}

function shouldUsePostgresSsl(databaseUrl) {
  return !/localhost|127\.0\.0\.1/i.test(databaseUrl);
}

function hashPassword(password, salt) {
  return crypto.createHash("sha256").update(`${salt}:${password}`).digest("hex");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function emptyState(email) {
  return {
    walletEntries: [],
    expenses: [],
    feeEntries: [],
    owedEntries: [],
    budgets: { monthly: 5000, categories: {} },
    goals: [],
    debts: [],
    reports: [],
    settings: { currency: "INR", theme: "dark" },
    achievements: [],
    profile: { email },
  };
}

function sanitizeState(state, email) {
  const clean = state && typeof state === "object" ? state : {};
  return {
    walletEntries: Array.isArray(clean.walletEntries) ? clean.walletEntries : [],
    expenses: Array.isArray(clean.expenses) ? clean.expenses : [],
    feeEntries: Array.isArray(clean.feeEntries) ? clean.feeEntries : [],
    owedEntries: Array.isArray(clean.owedEntries) ? clean.owedEntries : [],
    budgets: clean.budgets && typeof clean.budgets === "object" ? clean.budgets : { monthly: 5000, categories: {} },
    goals: Array.isArray(clean.goals) ? clean.goals : [],
    debts: Array.isArray(clean.debts) ? clean.debts : [],
    reports: Array.isArray(clean.reports) ? clean.reports : [],
    settings: clean.settings && typeof clean.settings === "object" ? clean.settings : { currency: "INR", theme: "dark" },
    achievements: Array.isArray(clean.achievements) ? clean.achievements : [],
    profile: {
      ...(clean.profile && typeof clean.profile === "object" ? clean.profile : {}),
      email,
    },
  };
}

async function sendResetEmail(toEmail, code) {
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailAppPassword) {
    throw new Error("Gmail sending is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD before requesting reset codes.");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  });

  await transporter.sendMail({
    from: `"Student Finance" <${gmailUser}>`,
    to: toEmail,
    subject: "Your Student Finance reset code",
    text: `Your Student Finance reset code is: ${code}\n\nIf you did not request this, ignore this email.`,
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function getNetworkUrls() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => item && item.family === "IPv4" && !item.internal)
    .map((item) => `http://${item.address}:${PORT}`);
}

const postgresSchema = `
  CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY,
    salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    reset_code TEXT DEFAULT '',
    state_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    note TEXT DEFAULT '',
    payment_method TEXT DEFAULT 'Cash',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#22C55E',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_email, name)
  );

  CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    month TEXT NOT NULL,
    category TEXT DEFAULT 'Monthly',
    amount NUMERIC NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_email, month, category)
  );

  CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_amount NUMERIC NOT NULL,
    saved_amount NUMERIC NOT NULL DEFAULT 0,
    target_date TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS debts (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    person TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    due_date TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Pending',
    note TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    month TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_email, date);
  CREATE INDEX IF NOT EXISTS idx_expenses_user_category ON expenses(user_email, category);
  CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON budgets(user_email, month);
  CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_email);
  CREATE INDEX IF NOT EXISTS idx_debts_user_status ON debts(user_email, status);
  CREATE INDEX IF NOT EXISTS idx_reports_user_month ON reports(user_email, month);
`;

const sqliteSchema = `
  CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY,
    salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    reset_code TEXT DEFAULT '',
    state_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    note TEXT DEFAULT '',
    payment_method TEXT DEFAULT 'Cash',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#22C55E',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_email, name),
    FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    month TEXT NOT NULL,
    category TEXT DEFAULT 'Monthly',
    amount REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_email, month, category),
    FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    name TEXT NOT NULL,
    target_amount REAL NOT NULL,
    saved_amount REAL NOT NULL DEFAULT 0,
    target_date TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS debts (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    person TEXT NOT NULL,
    amount REAL NOT NULL,
    due_date TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Pending',
    note TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    month TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_email, date);
  CREATE INDEX IF NOT EXISTS idx_expenses_user_category ON expenses(user_email, category);
  CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON budgets(user_email, month);
  CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_email);
  CREATE INDEX IF NOT EXISTS idx_debts_user_status ON debts(user_email, status);
  CREATE INDEX IF NOT EXISTS idx_reports_user_month ON reports(user_email, month);
`;

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
