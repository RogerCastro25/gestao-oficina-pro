# 🛠️ GUIA DE MELHORIAS PRIORITÁRIAS

## Ações concretas que você pode implementar agora

---

## 1️⃣ SEGURANÇA - Rate Limiting (CRÍTICO)

**Problema:** Qualquer pessoa pode tentar 1000x senhas diferentes sem restrição.

**Solução rápida** - Adicionar ao `server.js` depois das imports:

```javascript
// Rate limiting simples
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutos

function checkRateLimit(username) {
  const now = Date.now();
  const key = username;
  
  if (!loginAttempts.has(key)) {
    loginAttempts.set(key, []);
  }
  
  const attempts = loginAttempts.get(key).filter(t => now - t < WINDOW_MS);
  loginAttempts.set(key, attempts);
  
  if (attempts.length >= MAX_ATTEMPTS) {
    return false;
  }
  
  attempts.push(now);
  return true;
}
```

**Usar em** `app.post("/api/auth/login"...)`:

```javascript
app.post("/api/auth/login", async (req, res) => {
  const { usuario, senha } = req.body || {};
  const normalizedUsername = String(usuario || "").trim().toLowerCase();
  
  // ✨ ADICIONAR ISTO:
  if (!checkRateLimit(normalizedUsername)) {
    res.status(429).json({ 
      ok: false, 
      error: "Muitas tentativas. Tente novamente em 15 minutos."
    });
    return;
  }
  
  // ... resto do código
})
```

---

## 2️⃣ SEGURANÇA - Corrigir Ator de Eventos

**Problema:** Qualquer um pode falsificar quem fez a ação.

```javascript
// ❌ ANTES (inseguro):
app.post("/api/vehicles", async (req, res) => {
  const { actor } = req.body || {}; // ← USUÁRIO DEFINE QUEM É!
  // ...
});

// ✅ DEPOIS (seguro):
app.post("/api/vehicles", async (req, res) => {
  const guard = requireAuth(req, res); // ← Usar middleware
  if (!guard.ok) return;
  
  const actor = guard.username; // ← De facto da sessão validada
  // ...
});
```

**Criar middleware de autenticação**:

```javascript
function requireAuth(req, res) {
  const username = req.headers["x-actor-name"];
  const role = req.headers["x-actor-role"];
  
  if (!username || !role) {
    res.status(401).json({ ok: false, error: "Autenticação requerida." });
    return { ok: false };
  }
  
  return { ok: true, username, role };
}
```

---

## 3️⃣ PERFORMANCE - Adicionar Índices SQL

**Problema:** Queries sequenciais em tabelas grandes ficam lentas.

**Adicionar ao `setupSchema()`**:

```javascript
async function setupSchema(db) {
  // ... CREATE TABLE statements ...
  
  // ✨ ADICIONAR:
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_vehicles_placa ON vehicles(placa);
    CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
    CREATE INDEX IF NOT EXISTS idx_vehicles_updated_at ON vehicles(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_history_created_at ON history(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_user_audit_created_at ON user_audit(created_at DESC);
  `);
}
```

---

## 4️⃣ PERFORMANCE - Adicionar Paginação na API

**Problema:** Com 1000 veículos, `/api/bootstrap` retorna tudo e fica lento.

**Novo endpoint**:

```javascript
app.get("/api/vehicles", async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 50), 500);
  const offset = Number(req.query.offset || 0);
  
  const vehicles = await db.all(
    "SELECT * FROM vehicles ORDER BY updated_at DESC LIMIT ? OFFSET ?",
    [limit, offset]
  );
  
  const count = await db.get("SELECT COUNT(*) as total FROM vehicles");
  
  res.json({
    vehicles: vehicles.map(mapVehicleFromDb),
    total: count.total,
    offset,
    limit
  });
});
```

**No frontend** (`app.js`), ajustar bootstrap:

```javascript
async bootstrap() {
  const payload = await apiFetch("/api/vehicles?limit=100&offset=0", { method: "GET" });
  if (Array.isArray(payload?.vehicles)) {
    backendOnline = true;
    // Carregar mais sob demanda (implementar infinite scroll depois)
    return payload;
  }
  // ...
}
```

---

## 5️⃣ VALIDAÇÃO - Validar Placa

**Problema:** Aceita qualquer coisa como placa.

**Adicionar função em `server.js`**:

```javascript
function isValidPlaca(placa) {
  // Aceita: ABC-1234 ou ABC1234
  const patterns = [
    /^[A-Z]{2,3}-?\d{4}$/,        // Placa padrão: ABC-1234
    /^[A-Z]{2}\d{3}[A-Z]{2}$/     // Placa Mercosul: AB123CD
  ];
  return patterns.some(p => p.test(placa.toUpperCase()));
}
```

**Usar em `sanitizeVehicleRecord()`**:

```javascript
function sanitizeVehicleRecord(raw) {
  if (!raw || typeof raw !== "object") return null;

  const placa = String(raw.placa || "").toUpperCase().replace(/\s+/g, "").trim();
  
  // ✨ ADICIONAR:
  if (!isValidPlaca(placa)) return null;
  
  // ... resto ...
}
```

---

## 6️⃣ COMPORTAMENTO - Deduplicar Placas na Importação

**Problema:** Importar 2x com mesma placa cria duplicatas.

**Ajustar em `app.post("/api/vehicles/import")`**:

```javascript
app.post("/api/vehicles/import", async (req, res) => {
  const { items, actor } = req.body || {};
  if (!Array.isArray(items)) {
    res.status(400).json({ error: "Formato inválido." });
    return;
  }

  // ✨ DEDUPLICAR POR PLACA:
  const placasVistas = new Set();
  const sanitizedItems = items
    .map((item) => sanitizeVehicleRecord(item))
    .filter(Boolean)
    .filter((item) => {
      if (placasVistas.has(item.placa)) return false;
      placasVistas.add(item.placa);
      return true;
    });

  if (sanitizedItems.length === 0) {
    res.status(400).json({ error: "Nenhum registro válido." });
    return;
  }

  // ... resto do import ...
});
```

---

## 7️⃣ UX - Adicionar Busca Rápida

**Frontend** - Adicionar ao HTML perto do `<input csvInput>`:

```html
<input type="search" id="searchInput" placeholder="🔍 Buscar placa..." style="max-width: 200px;" />
```

**Em `app.js` no `start()`:**

```javascript
const searchInput = document.getElementById("searchInput");

searchInput?.addEventListener("input", (e) => {
  const query = String(e.target.value || "").toLowerCase();
  
  if (!query) {
    // Limpar filtro
    filtroCliente.value = "Todos";
    filtroRecomendacao.value = "Todos";
    render();
    return;
  }
  
  // Buscar em placa, marca, modelo, cliente
  const filtered = vehicles.filter(v => 
    v.placa.toLowerCase().includes(query) ||
    v.marca.toLowerCase().includes(query) ||
    v.modelo.toLowerCase().includes(query) ||
    v.clienteNome.toLowerCase().includes(query)
  );
  
  // Renderizar apenas filtrados (ou implementar novo estado)
  console.log(`Encontrados: ${filtered.length}`);
});
```

---

## 8️⃣ SEGURANÇA - Limitar Tamanho de Arquivo Individual

**Problema:** Alguém pode fazer upload de arquivo 40MB único.

**Em `server.js`** criar middleware customizado:

```javascript
function fileSizeLimit(maxMB) {
  return (req, res, next) => {
    const maxBytes = maxMB * 1024 * 1024;
    let bytesReceived = 0;
    
    req.on('data', (chunk) => {
      bytesReceived += chunk.length;
      if (bytesReceived > maxBytes) {
        res.status(413).json({ error: `Arquivo > ${maxMB}MB rejeitado.` });
        req.destroy();
      }
    });
    
    next();
  };
}

// Usar ANTES do express.json():
app.use(fileSizeLimit(5)); // máx 5MB por arquivo
app.use(express.json({ limit: "40mb" }));
```

---

## 9️⃣ BANCO DE DADOS - Backup Automático

**Adicionar função em `server.js`**:

```javascript
async function backupDatabase() {
  const src = DB_PATH;
  const timestamp = new Date().toISOString().slice(0, 10);
  const dest = path.join(DATA_DIR, `backup-${timestamp}.db`);
  
  // Não faça backup 2x no mesmo dia
  if (fs.existsSync(dest)) return;
  
  fs.copyFileSync(src, dest);
  console.log(`Backup criado: ${dest}`);
  
  // Manter apenas últimos 7 backups
  const backups = fs.readdirSync(DATA_DIR)
    .filter(f => f.startsWith('backup-'))
    .sort()
    .reverse();
  
  for (const old of backups.slice(7)) {
    fs.unlinkSync(path.join(DATA_DIR, old));
  }
}

// Chamar no início de `start()`:
await backupDatabase();
```

---

## 🔟 DOCUMENTAÇÃO - Adicionar .env.example

**Criar arquivo `.env.example`:**

```env
# Servidor
PORT=3000
NODE_ENV=development

# Admin inicial (uso opcional, só seedIfEmpty)
ADMIN_USERNAME=admin
ADMIN_FULL_NAME=Administrador
ADMIN_PASSWORD=SenhaForte@123
```

**Mencionar no README**:

```markdown
### Configuração (Opcional)

Copie `.env.example` para `.env` e customize:

\`\`\`bash
cp .env.example .env
nano .env  # editar valores
\`\`\`
```

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

- [ ] Rate-limiting em login
- [ ] Corrigir ator de eventos (usar session, não input)
- [ ] Adicionar índices SQL
- [ ] Implementar paginação `/api/vehicles`
- [ ] Validar formato de placa
- [ ] Deduplicar placas in import
- [ ] Adicionar busca rápida
- [ ] Limitar tamanho individual de arquivo
- [ ] Backup automático
- [ ] Documentar com `.env.example`

---

## 📈 Impacto Esperado

| Melhoria | Esforço | Impacto | Prazo |
|----------|---------|--------|-------|
| Rate-limiting | 15 min | 🔴 Crítico | Hoje |
| Ator de eventos | 20 min | 🔴 Crítico | Hoje |
| Índices SQL | 10 min | 🟡 Alto | Hoje |
| Paginação | 30 min | 🟡 Alto | Amanhã |
| Validação placa | 15 min | 🟠 Médio | Hoje |
| Deduplicação CSV | 10 min | 🟠 Médio | Hoje |
| Busca | 20 min | 🟢 Bom | 2-3 dias |
| Limite arquivo | 20 min | 🟠 Médio | Hoje |
| Backup auto | 15 min | 🟠 Médio | Hoje |

**Total: ~2.5 horas** para implementar tudo

