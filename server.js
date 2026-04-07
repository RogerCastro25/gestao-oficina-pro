const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";
const JSON_LIMIT = process.env.JSON_LIMIT || "40mb";
const LOGIN_RATE_WINDOW_MS = parsePositiveInt(process.env.LOGIN_RATE_WINDOW_MS, 15 * 60 * 1000);
const LOGIN_RATE_MAX_ATTEMPTS = parsePositiveInt(process.env.LOGIN_RATE_MAX_ATTEMPTS, 20);
const AUTH_TOKEN_TTL_SECONDS = parsePositiveInt(process.env.AUTH_TOKEN_TTL_SECONDS, 8 * 60 * 60);
const REFRESH_TOKEN_TTL_SECONDS = parsePositiveInt(process.env.REFRESH_TOKEN_TTL_SECONDS, 30 * 24 * 60 * 60);
const AUTH_SECRET = String(process.env.AUTH_SECRET || "").trim() || "dev-only-change-me";
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "oficina.db");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

const defaultRules = {
  pesoDias: 2.4,
  pesoUrgencia: 7,
  bonusRapido: 8,
  penalidadePecas: -6,
  limiteRapidoHoras: 6,
  rentabRapida: 120,
  diasAlta: 12,
  horasNaoVale: 14,
  rentabNaoVale: 40,
  margemMinimaSobreCusto: 0.5,
  custoHoraTecnicaBase: 22,
  custoDiaPatioBase: 18
};

const allowedRoles = new Set(["admin", "atendente", "financeiro"]);
const allowedVehicleStatuses = new Set(["Aguardando", "Em andamento", "Aguardando pecas", "Finalizacao"]);
const allowedClientTypes = new Set(["Particular", "Seguradora", "Locadora"]);
const allowedEstadoFisico = new Set(["Bom", "Regular", "Critico"]);

start().catch((error) => {
  console.error("Falha ao iniciar servidor:", error);
  process.exit(1);
});

async function start() {
  if (AUTH_SECRET === "dev-only-change-me") {
    console.warn("AUTH_SECRET não definido. Configure uma chave forte em produção.");
  }

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  const db = await open({ filename: DB_PATH, driver: sqlite3.Database });
  await setupSchema(db);
  await seedIfEmpty(db);

  const app = express();
  app.disable("x-powered-by");
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  }));
  app.use(express.json({ limit: JSON_LIMIT }));

  const loginLimiter = rateLimit({
    windowMs: LOGIN_RATE_WINDOW_MS,
    max: LOGIN_RATE_MAX_ATTEMPTS,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      ok: false,
      error: "Muitas tentativas de login. Aguarde alguns minutos e tente novamente."
    }
  });

  const authRequired = requireAuth(db);

  app.use((req, res, next) => {
    if (!req.path.startsWith("/api/")) {
      next();
      return;
    }

    const origin = req.headers.origin || "*";
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    next();
  });

  app.use("/uploads", express.static(UPLOADS_DIR));
  app.use(express.static(__dirname, {
    etag: false,
    setHeaders(res, filePath) {
      if (/\.(html|js|css)$/.test(filePath)) {
        res.setHeader("Cache-Control", "no-store");
      }
    }
  }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, ts: new Date().toISOString() });
  });

  app.get("/api/setup/status", async (_req, res) => {
    const row = await db.get("SELECT COUNT(*) AS total FROM users");
    res.json({ needsSetup: Number(row?.total || 0) === 0 });
  });

  app.post("/api/setup/admin", async (req, res) => {
    const row = await db.get("SELECT COUNT(*) AS total FROM users");
    if (Number(row?.total || 0) > 0) {
      res.status(409).json({ ok: false, error: "A configuração inicial já foi concluída." });
      return;
    }

    const username = String(req.body?.username || "").trim().toLowerCase();
    const fullName = String(req.body?.fullName || "").trim();
    const password = String(req.body?.password || "");

    if (!username || !fullName || !password) {
      res.status(400).json({ ok: false, error: "Dados obrigatórios ausentes." });
      return;
    }

    if (!isStrongPassword(password)) {
      res.status(400).json({ ok: false, error: "Senha fraca. Use no mínimo 8 caracteres com maiúscula, minúscula, número e símbolo." });
      return;
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const hash = hashPassword(password, salt);
    await db.run(
      "INSERT INTO users(id, username, full_name, role, password_hash, password_salt, is_active, created_at) VALUES(?, ?, ?, ?, ?, ?, 1, ?)",
      [cryptoRandom(), username, fullName, "admin", hash, salt, isoNow()]
    );

    await addUserAudit(db, {
      username,
      action: "setup_admin_created",
      detail: "Administrador inicial criado no primeiro acesso",
      actorName: fullName
    });

    res.json({ ok: true });
  });

  app.post("/api/auth/login", loginLimiter, async (req, res) => {
    const { usuario, senha } = req.body || {};
    const normalizedUsername = String(usuario || "").trim().toLowerCase();
    if (!normalizedUsername || !senha) {
      await addUserAudit(db, {
        username: normalizedUsername || "",
        action: "login_failed",
        detail: "Credenciais ausentes",
        actorName: normalizedUsername || "anônimo"
      });
      res.status(400).json({ ok: false, error: "Credenciais obrigatórias." });
      return;
    }

    const user = await db.get("SELECT * FROM users WHERE username = ?", [normalizedUsername]);
    if (!user) {
      await addUserAudit(db, {
        username: normalizedUsername,
        action: "login_failed",
        detail: "Usuário inexistente",
        actorName: normalizedUsername
      });
      res.status(401).json({ ok: false });
      return;
    }

    if (!Number(user.is_active)) {
      await addUserAudit(db, {
        username: usuario,
        action: "login_blocked",
        detail: "Usuário bloqueado",
        actorName: user.full_name
      });
      res.status(403).json({ ok: false, error: "Usuário bloqueado." });
      return;
    }

    const valid = verifyPassword(senha, user.password_hash, user.password_salt);
    if (!valid) {
      await addUserAudit(db, {
        username: normalizedUsername,
        action: "login_failed",
        detail: "Senha inválida",
        actorName: user.full_name
      });
      res.status(401).json({ ok: false });
      return;
    }

    await addUserAudit(db, {
      username: normalizedUsername,
      action: "login_success",
      detail: "Login realizado",
      actorName: user.full_name,
      actorUserId: user.id
    });

    const sessionId = cryptoRandom();
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const accessExpiresAt = isoFromEpochSeconds(nowEpochSeconds() + AUTH_TOKEN_TTL_SECONDS);
    const refreshExpiresAt = isoFromEpochSeconds(nowEpochSeconds() + REFRESH_TOKEN_TTL_SECONDS);

    await db.run(
      "INSERT INTO auth_sessions(id, user_id, refresh_token_hash, access_expires_at, refresh_expires_at, created_at, last_seen_at, revoked_at) VALUES(?, ?, ?, ?, ?, ?, ?, NULL)",
      [sessionId, user.id, refreshTokenHash, accessExpiresAt, refreshExpiresAt, isoNow(), isoNow()]
    );

    const token = signAuthToken({
      userId: user.id,
      sessionId,
      username: user.username,
      fullName: user.full_name,
      role: user.role
    });

    res.json({
      ok: true,
      nome: user.full_name,
      perfil: user.role,
      token,
      refreshToken,
      expiresIn: AUTH_TOKEN_TTL_SECONDS
    });
  });

  app.post("/api/auth/refresh", async (req, res) => {
    const refreshToken = String(req.body?.refreshToken || "").trim();
    if (!refreshToken) {
      res.status(400).json({ ok: false, error: "Refresh token obrigatório." });
      return;
    }

    const refreshTokenHash = hashRefreshToken(refreshToken);
    const session = await db.get(
      `
      SELECT s.id, s.user_id, s.refresh_expires_at, s.revoked_at,
             u.username, u.full_name, u.role, u.is_active
      FROM auth_sessions s
      INNER JOIN users u ON u.id = s.user_id
      WHERE s.refresh_token_hash = ?
      `,
      [refreshTokenHash]
    );

    if (!session || session.revoked_at || !Number(session.is_active)) {
      res.status(401).json({ ok: false, error: "Sessão inválida. Faça login novamente." });
      return;
    }

    if (new Date(session.refresh_expires_at).getTime() <= Date.now()) {
      await db.run("UPDATE auth_sessions SET revoked_at = ? WHERE id = ?", [isoNow(), session.id]);
      res.status(401).json({ ok: false, error: "Sessão expirada. Faça login novamente." });
      return;
    }

    const newRefreshToken = generateRefreshToken();
    const newRefreshHash = hashRefreshToken(newRefreshToken);
    const accessExpiresAt = isoFromEpochSeconds(nowEpochSeconds() + AUTH_TOKEN_TTL_SECONDS);
    const refreshExpiresAt = isoFromEpochSeconds(nowEpochSeconds() + REFRESH_TOKEN_TTL_SECONDS);

    await db.run(
      "UPDATE auth_sessions SET refresh_token_hash = ?, access_expires_at = ?, refresh_expires_at = ?, last_seen_at = ? WHERE id = ?",
      [newRefreshHash, accessExpiresAt, refreshExpiresAt, isoNow(), session.id]
    );

    const token = signAuthToken({
      userId: session.user_id,
      sessionId: session.id,
      username: session.username,
      fullName: session.full_name,
      role: session.role
    });

    await addUserAudit(db, {
      username: session.username,
      action: "token_refreshed",
      detail: "Token de acesso renovado",
      actorName: session.full_name,
      actorUserId: session.user_id
    });

    res.json({ ok: true, token, refreshToken: newRefreshToken, expiresIn: AUTH_TOKEN_TTL_SECONDS });
  });

  app.post("/api/auth/logout", authRequired, async (req, res) => {
    await db.run("UPDATE auth_sessions SET revoked_at = ?, last_seen_at = ? WHERE id = ?", [isoNow(), isoNow(), req.auth.sessionId]);

    await addUserAudit(db, {
      username: req.auth.username,
      action: "logout",
      detail: "Logout realizado",
      actorName: req.auth.fullName,
      actorUserId: req.auth.userId
    });

    res.json({ ok: true });
  });

  app.get("/api/users", authRequired, async (req, res) => {
    const guard = requireAdmin(req, res);
    if (!guard.ok) return;

    const users = await db.all("SELECT id, username, full_name, role, is_active, created_at FROM users ORDER BY datetime(created_at) DESC");
    res.json({
      users: users.map((user) => ({
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        active: Boolean(user.is_active),
        createdAt: user.created_at
      }))
    });
  });

  app.post("/api/users", authRequired, async (req, res) => {
    const guard = requireAdmin(req, res);
    if (!guard.ok) return;

    const { username, fullName, role, password } = req.body || {};
    const normalizedUsername = String(username || "").trim().toLowerCase();
    const normalizedFullName = String(fullName || "").trim();
    const normalizedRole = String(role || "").trim().toLowerCase();

    if (!normalizedUsername || !normalizedFullName || !normalizedRole || !password) {
      res.status(400).json({ ok: false, error: "Dados obrigatórios ausentes." });
      return;
    }
    if (!allowedRoles.has(normalizedRole)) {
      res.status(400).json({ ok: false, error: "Perfil inválido." });
      return;
    }
    if (!isStrongPassword(password)) {
      res.status(400).json({ ok: false, error: "Senha fraca. Use no mínimo 8 caracteres com maiúscula, minúscula, número e símbolo." });
      return;
    }

    const exists = await db.get("SELECT id FROM users WHERE username = ?", [normalizedUsername]);
    if (exists) {
      res.status(409).json({ ok: false, error: "Usuário já existe." });
      return;
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const hash = hashPassword(password, salt);
    await db.run(
      "INSERT INTO users(id, username, full_name, role, password_hash, password_salt, is_active, created_at) VALUES(?, ?, ?, ?, ?, ?, 1, ?)",
      [cryptoRandom(), normalizedUsername, normalizedFullName, normalizedRole, hash, salt, isoNow()]
    );

    await addUserAudit(db, {
      username: normalizedUsername,
      action: "user_created",
      detail: `Perfil ${normalizedRole}`,
      actorName: req.auth.fullName,
      actorUserId: req.auth.userId
    });

    res.json({ ok: true });
  });

  app.patch("/api/users/:id/password", authRequired, async (req, res) => {
    const guard = requireAdmin(req, res);
    if (!guard.ok) return;

    const { id } = req.params;
    const { newPassword } = req.body || {};
    if (!isStrongPassword(newPassword || "")) {
      res.status(400).json({ ok: false, error: "Senha fraca. Use no mínimo 8 caracteres com maiúscula, minúscula, número e símbolo." });
      return;
    }

    const target = await db.get("SELECT id, username FROM users WHERE id = ?", [id]);
    if (!target) {
      res.status(404).json({ ok: false, error: "Usuário não encontrado." });
      return;
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const hash = hashPassword(newPassword, salt);
    await db.run("UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?", [hash, salt, id]);

    await addUserAudit(db, {
      username: target.username,
      action: "password_changed",
      detail: "Senha alterada por administrador",
      actorName: req.auth.fullName,
      actorUserId: req.auth.userId
    });

    res.json({ ok: true });
  });

  app.patch("/api/users/:id/status", authRequired, async (req, res) => {
    const guard = requireAdmin(req, res);
    if (!guard.ok) return;

    const { id } = req.params;
    const { active } = req.body || {};
    const target = await db.get("SELECT id, username FROM users WHERE id = ?", [id]);
    if (!target) {
      res.status(404).json({ ok: false, error: "Usuário não encontrado." });
      return;
    }

    await db.run("UPDATE users SET is_active = ? WHERE id = ?", [active ? 1 : 0, id]);

    await addUserAudit(db, {
      username: target.username,
      action: active ? "user_reactivated" : "user_blocked",
      detail: active ? "Usuário reativado" : "Usuário bloqueado",
      actorName: req.auth.fullName,
      actorUserId: req.auth.userId
    });

    res.json({ ok: true });
  });

  app.get("/api/bootstrap", authRequired, async (_req, res) => {
    const vehicles = await db.all("SELECT * FROM vehicles ORDER BY datetime(updated_at) DESC");
    const history = await db.all("SELECT * FROM history ORDER BY datetime(created_at) DESC LIMIT 300");
    const rawRules = await db.get("SELECT value FROM app_state WHERE key = 'rules'");
    const rules = rawRules ? JSON.parse(rawRules.value) : defaultRules;

    res.json({
      vehicles: vehicles.map(mapVehicleFromDb),
      history: history.map(mapHistoryFromDb),
      rules
    });
  });

  app.post("/api/vehicles", authRequired, async (req, res) => {
    const roleGuard = requireEditor(req, res);
    if (!roleGuard.ok) return;

    const actor = req.auth.fullName;
    const item = sanitizeVehicleRecord(req.body?.item);
    if (!item?.id || !item?.placa) {
      res.status(400).json({ error: "Dados do veículo inválidos." });
      return;
    }

    item.photos = await persistPhotos(item.id, item.photos || []);
    await upsertVehicle(db, item);
    await addHistory(db, {
      tipo: "Cadastro",
      descricao: `${item.placa} adicionado por ${actor || "Sistema"}.`,
      por: actor || "Sistema",
      userId: req.auth.userId
    });

    res.json({ ok: true });
  });

  app.post("/api/vehicles/import", authRequired, async (req, res) => {
    const roleGuard = requireEditor(req, res);
    if (!roleGuard.ok) return;

    const { items } = req.body || {};
    const actor = req.auth.fullName;
    if (!Array.isArray(items)) {
      res.status(400).json({ error: "Formato de importação inválido." });
      return;
    }

    const sanitizedItems = items.map((item) => sanitizeVehicleRecord(item)).filter(Boolean);
    if (sanitizedItems.length === 0) {
      res.status(400).json({ error: "Nenhum registro válido encontrado para importação." });
      return;
    }

    await db.exec("BEGIN");
    try {
      await db.run("DELETE FROM vehicles");
      for (const item of sanitizedItems) {
        item.photos = await persistPhotos(item.id, item.photos || []);
        await upsertVehicle(db, item);
      }

      await addHistory(db, {
        tipo: "Importação",
        descricao: `${sanitizedItems.length} registros importados por ${actor || "Sistema"}.`,
        por: actor || "Sistema",
        userId: req.auth.userId
      });

      await db.exec("COMMIT");
    } catch (error) {
      await db.exec("ROLLBACK");
      console.error("Falha ao importar veículos:", error);
      res.status(500).json({ ok: false, error: "Falha ao importar veículos." });
      return;
    }

    res.json({ ok: true });
  });

  app.patch("/api/vehicles/:id/status", authRequired, async (req, res) => {
    const roleGuard = requireEditor(req, res);
    if (!roleGuard.ok) return;

    const { id } = req.params;
    const actor = req.auth.fullName;
    const status = normalizeStatus(req.body?.status);

    const target = await db.get("SELECT placa FROM vehicles WHERE id = ?", [id]);
    if (!target) {
      res.status(404).json({ error: "Veículo não encontrado." });
      return;
    }

    await db.run("UPDATE vehicles SET status = ?, updated_at = ? WHERE id = ?", [status, isoNow(), id]);
    await addHistory(db, {
      tipo: "Status",
      descricao: `${target.placa} movido para ${status}.`,
      por: actor || "Sistema",
      userId: req.auth.userId
    });

    res.json({ ok: true });
  });

  app.put("/api/vehicles/:id", authRequired, async (req, res) => {
    const roleGuard = requireEditor(req, res);
    if (!roleGuard.ok) return;

    const { id } = req.params;
    const actor = req.auth.fullName;
    const item = sanitizeVehicleRecord(req.body?.item);
    if (!item || item.id !== id) {
      res.status(400).json({ error: "Dados inválidos para atualização." });
      return;
    }

    const target = await db.get("SELECT placa FROM vehicles WHERE id = ?", [id]);
    if (!target) {
      res.status(404).json({ error: "Veículo não encontrado." });
      return;
    }

    item.photos = await persistPhotos(item.id, item.photos || []);
    await upsertVehicle(db, item);
    await addHistory(db, {
      tipo: "Edição",
      descricao: `${item.placa} editado por ${actor || "Sistema"}.`,
      por: actor || "Sistema",
      userId: req.auth.userId
    });

    res.json({ ok: true });
  });

  app.delete("/api/vehicles/:id", authRequired, async (req, res) => {
    const roleGuard = requireEditor(req, res);
    if (!roleGuard.ok) return;

    const { id } = req.params;
    const actor = req.auth.fullName;

    const target = await db.get("SELECT placa FROM vehicles WHERE id = ?", [id]);
    if (!target) {
      res.status(404).json({ error: "Veículo não encontrado." });
      return;
    }

    await db.run("DELETE FROM vehicles WHERE id = ?", [id]);
    await addHistory(db, {
      tipo: "Exclusão",
      descricao: `${target.placa} removido por ${actor || "Sistema"}.`,
      por: actor || "Sistema",
      userId: req.auth.userId
    });

    res.json({ ok: true });
  });

  app.put("/api/rules", authRequired, async (req, res) => {
    const guard = requireAdmin(req, res);
    if (!guard.ok) return;

    const { rules } = req.body || {};
    const actor = req.auth.fullName;
    if (!rules || typeof rules !== "object") {
      res.status(400).json({ error: "Regras inválidas." });
      return;
    }

    await db.run(
      "INSERT INTO app_state(key, value, updated_at) VALUES('rules', ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
      [JSON.stringify(rules), isoNow()]
    );

    await addHistory(db, {
      tipo: "Regras",
      descricao: `Regras atualizadas por ${actor || "Sistema"}.`,
      por: actor || "Sistema",
      userId: req.auth.userId
    });

    res.json({ ok: true });
  });

  app.all("/api/*", (req, res) => {
    res.status(405).json({ ok: false, error: `Método ${req.method} não permitido para ${req.path}.` });
  });

  app.use((error, req, res, _next) => {
    console.error("Erro interno na API:", error);
    if (res.headersSent) return;
    if (req.path.startsWith("/api/")) {
      res.status(500).json({ ok: false, error: "Erro interno do servidor." });
      return;
    }
    res.status(500).send("Erro interno do servidor.");
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor online em http://localhost:${PORT}`);
    console.log(`Ambiente: ${NODE_ENV}`);
    console.log("Acesso pelo celular: use http://<IP-DO-PC>:" + PORT + " na mesma rede Wi-Fi.");
  });
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function setupSchema(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      placa TEXT NOT NULL,
      marca TEXT NOT NULL,
      modelo TEXT NOT NULL,
      cor TEXT NOT NULL,
      status TEXT NOT NULL,
      cliente_tipo TEXT NOT NULL,
      cliente_nome TEXT NOT NULL,
      entrada TEXT NOT NULL,
      urgencia REAL NOT NULL,
      horas REAL NOT NULL,
      pecas REAL NOT NULL,
      mao_obra REAL NOT NULL,
      custo_interno REAL NOT NULL,
      valor_cobrado REAL DEFAULT 0,
      servicos TEXT NOT NULL,
      quilometragem REAL DEFAULT 0,
      estado_fisico TEXT DEFAULT 'Bom',
      observacoes TEXT DEFAULT '',
      fotos TEXT DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS history (
      id TEXT PRIMARY KEY,
      tipo TEXT NOT NULL,
      descricao TEXT NOT NULL,
      por TEXT NOT NULL,
      user_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_audit (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      action TEXT NOT NULL,
      detail TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      actor_user_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      refresh_token_hash TEXT UNIQUE NOT NULL,
      access_expires_at TEXT NOT NULL,
      refresh_expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      revoked_at TEXT
    );
  `);

  const state = await db.get("SELECT key FROM app_state WHERE key = 'rules'");
  if (!state) {
    await db.run("INSERT INTO app_state(key, value, updated_at) VALUES('rules', ?, ?)", [JSON.stringify(defaultRules), isoNow()]);
  }

  await ensureColumn(db, "vehicles", "quilometragem", "REAL DEFAULT 0");
  await ensureColumn(db, "vehicles", "estado_fisico", "TEXT DEFAULT 'Bom'");
  await ensureColumn(db, "vehicles", "observacoes", "TEXT DEFAULT ''");
  await ensureColumn(db, "vehicles", "fotos", "TEXT DEFAULT '[]'");
  await ensureColumn(db, "vehicles", "valor_cobrado", "REAL DEFAULT 0");
  await ensureColumn(db, "users", "is_active", "INTEGER NOT NULL DEFAULT 1");
  await ensureColumn(db, "history", "user_id", "TEXT");
  await ensureColumn(db, "user_audit", "actor_user_id", "TEXT");

  await seedUsers(db);
}

async function seedIfEmpty(db) {
  const row = await db.get("SELECT COUNT(*) AS total FROM vehicles");
  if (row.total === 0) {
    await addHistory(db, {
      tipo: "Sistema",
      descricao: "Base inicial pronta para uso.",
      por: "Sistema"
    });
  }
}

async function upsertVehicle(db, item) {
  await db.run(
    `
    INSERT INTO vehicles(
      id, placa, marca, modelo, cor, status,
      cliente_tipo, cliente_nome, entrada, urgencia, horas,
      pecas, mao_obra, custo_interno, valor_cobrado, servicos, quilometragem,
      estado_fisico, observacoes, fotos, created_at, updated_at
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      placa = excluded.placa,
      marca = excluded.marca,
      modelo = excluded.modelo,
      cor = excluded.cor,
      status = excluded.status,
      cliente_tipo = excluded.cliente_tipo,
      cliente_nome = excluded.cliente_nome,
      entrada = excluded.entrada,
      urgencia = excluded.urgencia,
      horas = excluded.horas,
      pecas = excluded.pecas,
      mao_obra = excluded.mao_obra,
      custo_interno = excluded.custo_interno,
      valor_cobrado = excluded.valor_cobrado,
      servicos = excluded.servicos,
      quilometragem = excluded.quilometragem,
      estado_fisico = excluded.estado_fisico,
      observacoes = excluded.observacoes,
      fotos = excluded.fotos,
      updated_at = excluded.updated_at
    `,
    [
      item.id,
      item.placa,
      item.marca,
      item.modelo,
      item.cor,
      item.status,
      item.clienteTipo,
      item.clienteNome,
      item.entrada,
      item.urgencia,
      item.horas,
      item.pecas,
      item.maoObra,
      item.custoInterno,
      item.valorCobrado || 0,
      JSON.stringify(item.servicos || []),
      item.quilometragem || 0,
      item.estadoFisico || "Bom",
      item.observacoes || "",
      JSON.stringify(item.photos || []),
      item.createdAt || isoNow(),
      item.updatedAt || isoNow()
    ]
  );
}

async function addHistory(db, event) {
  await db.run("INSERT INTO history(id, tipo, descricao, por, user_id, created_at) VALUES(?, ?, ?, ?, ?, ?)", [
    cryptoRandom(),
    event.tipo,
    event.descricao,
    event.por,
    event.userId || null,
    isoNow()
  ]);
}

function mapVehicleFromDb(row) {
  return {
    id: row.id,
    placa: row.placa,
    marca: row.marca,
    modelo: row.modelo,
    cor: row.cor,
    status: row.status,
    clienteTipo: row.cliente_tipo,
    clienteNome: row.cliente_nome,
    entrada: row.entrada,
    urgencia: Number(row.urgencia),
    horas: Number(row.horas),
    pecas: Number(row.pecas),
    maoObra: Number(row.mao_obra),
    custoInterno: Number(row.custo_interno),
    valorCobrado: Number(row.valor_cobrado || 0),
    quilometragem: Number(row.quilometragem || 0),
    estadoFisico: row.estado_fisico || "Bom",
    observacoes: row.observacoes || "",
    photos: safeParseJsonArray(row.fotos),
    servicos: safeParseJsonArray(row.servicos),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeLookupKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseNumericValue(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const sanitized = raw.replace(/\s|R\$/g, "");
  const hasComma = sanitized.includes(",");
  const hasDot = sanitized.includes(".");

  if (hasComma && hasDot) {
    if (sanitized.lastIndexOf(",") > sanitized.lastIndexOf(".")) {
      return Number(sanitized.replace(/\./g, "").replace(/,/g, ".")) || 0;
    }
    return Number(sanitized.replace(/,/g, "")) || 0;
  }

  if (hasComma) return Number(sanitized.replace(/,/g, ".")) || 0;
  return Number(sanitized) || 0;
}

function clampNumber(value, min, max, fallback = min) {
  const number = parseNumericValue(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function normalizeStatus(value) {
  const normalized = normalizeLookupKey(value);
  if (normalized === "aguardando") return "Aguardando";
  if (normalized === "em andamento") return "Em andamento";
  if (normalized === "aguardando pecas" || normalized === "ag pecas") return "Aguardando pecas";
  if (normalized === "finalizacao" || normalized === "em finalizacao") return "Finalizacao";
  return "Aguardando";
}

function normalizeClientType(value) {
  const normalized = normalizeLookupKey(value);
  if (normalized === "locadora") return "Locadora";
  if (normalized === "seguradora") return "Seguradora";
  return "Particular";
}

function normalizeEstadoFisico(value) {
  const normalized = normalizeLookupKey(value);
  if (normalized === "regular") return "Regular";
  if (normalized === "critico") return "Critico";
  return "Bom";
}

function normalizeDateInput(value) {
  const raw = String(value || "").trim();
  if (!raw) return isoNow().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return isoNow().slice(0, 10);
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function sanitizeServices(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(/[;|,]/);
  const services = [...new Set(list.map((item) => String(item || "").trim()).filter(Boolean))];
  return services.length > 0 ? services : ["Mecânica"];
}

function sanitizeVehicleRecord(raw) {
  if (!raw || typeof raw !== "object") return null;

  const placa = String(raw.placa || "").toUpperCase().replace(/\s+/g, "").trim();
  const marca = String(raw.marca || "").trim();
  const modelo = String(raw.modelo || "").trim();
  const cor = String(raw.cor || "").trim();
  const clienteNome = String(raw.clienteNome || "").trim();

  if (!placa || !marca || !modelo || !cor || !clienteNome) return null;

  const record = {
    id: String(raw.id || cryptoRandom()),
    placa,
    marca,
    modelo,
    cor,
    status: normalizeStatus(raw.status),
    clienteTipo: normalizeClientType(raw.clienteTipo),
    clienteNome,
    entrada: normalizeDateInput(raw.entrada),
    urgencia: clampNumber(raw.urgencia, 1, 5, 3),
    horas: Math.max(0.5, parseNumericValue(raw.horas || 0.5)),
    pecas: Math.max(0, parseNumericValue(raw.pecas)),
    maoObra: Math.max(0, parseNumericValue(raw.maoObra)),
    custoInterno: Math.max(0, parseNumericValue(raw.custoInterno)),
    valorCobrado: Math.max(0, parseNumericValue(raw.valorCobrado)),
    servicos: sanitizeServices(raw.servicos),
    quilometragem: Math.max(0, parseNumericValue(raw.quilometragem)),
    estadoFisico: normalizeEstadoFisico(raw.estadoFisico),
    observacoes: String(raw.observacoes || "").trim(),
    photos: Array.isArray(raw.photos) ? raw.photos : [],
    createdAt: raw.createdAt || isoNow(),
    updatedAt: raw.updatedAt || isoNow()
  };

  if (!allowedVehicleStatuses.has(record.status)) return null;
  if (!allowedClientTypes.has(record.clienteTipo)) return null;
  if (!allowedEstadoFisico.has(record.estadoFisico)) return null;
  if (!record.valorCobrado) {
    record.valorCobrado = record.pecas + record.maoObra;
  }
  return record;
}

async function ensureColumn(db, tableName, columnName, definition) {
  const columns = await db.all(`PRAGMA table_info(${tableName})`);
  const exists = columns.some((column) => column.name === columnName);
  if (!exists) {
    await db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

async function persistPhotos(vehicleId, photos) {
  const stored = [];

  for (const photo of photos) {
    if (photo?.url && !photo.dataUrl) {
      stored.push(photo);
      continue;
    }

    if (!photo?.dataUrl) {
      continue;
    }

    const match = String(photo.dataUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      continue;
    }

    const mimeType = match[1];
    const extension = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
    const filename = `${vehicleId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
    const absolutePath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(absolutePath, Buffer.from(match[2], "base64"));

    stored.push({
      name: photo.name || filename,
      type: mimeType,
      url: `/uploads/${filename}`
    });
  }

  return stored;
}

function mapHistoryFromDb(row) {
  return {
    id: row.id,
    tipo: row.tipo,
    descricao: row.descricao,
    por: row.por,
    userId: row.user_id || null,
    data: row.created_at
  };
}

function safeParseJsonArray(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isoNow() {
  return new Date().toISOString();
}

function cryptoRandom() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function seedUsers(db) {
  const users = await db.get("SELECT COUNT(*) AS total FROM users");
  if (users.total > 0) {
    return;
  }

  const username = String(process.env.ADMIN_USERNAME || "").trim().toLowerCase();
  const fullName = String(process.env.ADMIN_FULL_NAME || "").trim();
  const password = String(process.env.ADMIN_PASSWORD || "");

  if (!username || !fullName || !isStrongPassword(password)) {
    console.warn("Nenhum usuário inicial foi criado por ambiente. Utilize o primeiro acesso na tela para cadastrar o administrador.");
    return;
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const hash = hashPassword(password, salt);
  await db.run(
    "INSERT INTO users(id, username, full_name, role, password_hash, password_salt, is_active, created_at) VALUES(?, ?, ?, ?, ?, ?, 1, ?)",
    [cryptoRandom(), username, fullName, "admin", hash, salt, isoNow()]
  );

  console.log(`Usuário administrador inicial criado: ${username}`);
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");
}

function verifyPassword(password, storedHash, salt) {
  const hash = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(storedHash, "hex"));
}

function isStrongPassword(password) {
  if (String(password).length < 8) return false;
  const upper = /[A-Z]/.test(password);
  const lower = /[a-z]/.test(password);
  const digit = /\d/.test(password);
  const symbol = /[^A-Za-z0-9]/.test(password);
  return upper && lower && digit && symbol;
}

function requireAdmin(req, res) {
  const role = String(req.auth?.role || "").toLowerCase();
  if (role !== "admin") {
    res.status(403).json({ ok: false, error: "Somente administrador pode executar esta ação." });
    return { ok: false };
  }
  return { ok: true };
}

function requireEditor(req, res) {
  const role = String(req.auth?.role || "").toLowerCase();
  if (role !== "admin" && role !== "atendente") {
    res.status(403).json({ ok: false, error: "Seu perfil não pode alterar dados operacionais." });
    return { ok: false };
  }
  return { ok: true };
}

function requireAuth(db) {
  return async (req, res, next) => {
    const authHeader = String(req.headers.authorization || "");
    if (!authHeader.startsWith("Bearer ")) {
      res.status(401).json({ ok: false, error: "Sessão inválida. Faça login novamente." });
      return false;
    }

    const token = authHeader.slice(7).trim();
    const payload = verifyAuthToken(token);
    if (!payload?.userId) {
      res.status(401).json({ ok: false, error: "Sessão inválida ou expirada. Faça login novamente." });
      return false;
    }

    const user = await db.get(
      "SELECT id, username, full_name, role, is_active FROM users WHERE id = ?",
      [payload.userId]
    );
    if (!user || !Number(user.is_active)) {
      res.status(401).json({ ok: false, error: "Usuário sem acesso. Faça login novamente." });
      return false;
    }

    req.auth = {
      userId: user.id,
      sessionId: payload.sessionId,
      username: user.username,
      fullName: user.full_name,
      role: user.role
    };

    const serverSession = await db.get(
      "SELECT id, revoked_at, refresh_expires_at FROM auth_sessions WHERE id = ? AND user_id = ?",
      [payload.sessionId, payload.userId]
    );
    if (!serverSession || serverSession.revoked_at) {
      res.status(401).json({ ok: false, error: "Sessão inválida. Faça login novamente." });
      return false;
    }
    if (new Date(serverSession.refresh_expires_at).getTime() <= Date.now()) {
      await db.run("UPDATE auth_sessions SET revoked_at = ? WHERE id = ?", [isoNow(), payload.sessionId]);
      res.status(401).json({ ok: false, error: "Sessão expirada. Faça login novamente." });
      return false;
    }

    await db.run("UPDATE auth_sessions SET last_seen_at = ? WHERE id = ?", [isoNow(), payload.sessionId]);

    if (typeof next === "function") {
      next();
    }
    return true;
  };
}

function signAuthToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    userId: user.userId,
    sessionId: user.sessionId,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    iat: now,
    exp: now + AUTH_TOKEN_TTL_SECONDS
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", AUTH_SECRET).update(payloadBase64).digest("base64url");
  return `${payloadBase64}.${signature}`;
}

function verifyAuthToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return null;

  const [payloadBase64, signature] = parts;
  const expectedSignature = crypto.createHmac("sha256", AUTH_SECRET).update(payloadBase64).digest("base64url");
  if (!safeEqual(signature, expectedSignature)) return null;

  try {
    const payloadJson = Buffer.from(payloadBase64, "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson);
    const now = Math.floor(Date.now() / 1000);
    if (!payload?.exp || payload.exp <= now) return null;
    if (!payload?.sessionId) return null;
    return payload;
  } catch {
    return null;
  }
}

function safeEqual(a, b) {
  const aBuffer = Buffer.from(String(a), "utf8");
  const bBuffer = Buffer.from(String(b), "utf8");
  if (aBuffer.length !== bBuffer.length) return false;
  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

async function addUserAudit(db, entry) {
  await db.run(
    "INSERT INTO user_audit(id, username, action, detail, actor_name, actor_user_id, created_at) VALUES(?, ?, ?, ?, ?, ?, ?)",
    [cryptoRandom(), entry.username || "", entry.action, entry.detail, entry.actorName || "sistema", entry.actorUserId || null, isoNow()]
  );
}

function nowEpochSeconds() {
  return Math.floor(Date.now() / 1000);
}

function isoFromEpochSeconds(seconds) {
  return new Date(seconds * 1000).toISOString();
}

function generateRefreshToken() {
  return crypto.randomBytes(48).toString("base64url");
}

function hashRefreshToken(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}
