# 🏗️ ARQUITETURA & FLUXOS

## Diagrama de Arquitetura Geral

```
┌──────────────────────────────────────────────────────────────┐
│                    CLIENTE (Navegador Web)                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ HTML5 (index.html) + CSS3 + Vanilla JS (app.js)       │  │
│  │ - Interface de usuário                                 │  │
│  │ - Cálculos de prioridade (frontend)                    │  │
│  │ - LocalStorage (fallback offline)                      │  │
│  │ - Renderização reativa (render())                      │  │
│  └────────────────────────────────────────────────────────┘  │
└────────────────┬───────────────────────────────────────────┘
                 │ HTTP/REST (JSON)
                 │
      ┌──────────▼───────────────┐
      │   REDE                    │
      │  localhost:3000           │
      └──────────┬─────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│              SERVIDOR (Node.js + Express)                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ROTAS                                                │  │
│  │ POST   /api/auth/login                              │  │
│  │ POST   /api/setup/admin                             │  │
│  │ POST   /api/vehicles                                │  │
│  │ PUT    /api/vehicles/:id                            │  │
│  │ DELETE /api/vehicles/:id                            │  │
│  │ PATCH  /api/vehicles/:id/status                     │  │
│  │ GET    /api/bootstrap                               │  │
│  │ POST   /api/vehicles/import                         │  │
│  │ PUT    /api/rules                                   │  │
│  │ ... + rotas de usuários e auditoria ...             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ AUTENTICAÇÃO & SEGURANÇA                             │  │
│  │ - PBKDF2 + Salt (120k iterações)                    │  │
│  │ - Validação de permissões                           │  │
│  │ - Sanitização de entrada                            │  │
│  │ - Auditoria de eventos                              │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────┬───────────────────────────────────────────┘
                 │
         ┌───────▼────────┐
         │ PERSISTÊNCIA   │
         └───────┬────────┘
                 │
     ┌───────────┴───────────┬──────────────┐
     │                       │              │
┌────▼────────┐      ┌──────▼──────┐   ┌──▼──────┐
│ data/        │      │ data/       │   │ data/   │
│ oficina.db   │      │ uploads/    │   │ backups/│
│              │      │ (fotos)     │   │ (auto)  │
│ SQLite3      │      │             │   │         │
│ - vehicles   │      │ Base64 →    │   │ Cópias  │
│ - history    │      │ JPEG/PNG    │   │ Diárias │
│ - users      │      │             │   │         │
│ - app_state  │      │ /uploads/   │   │         │
│ - user_audit │      │ id-ts-xxx   │   │         │
└──────────────┘      └─────────────┘   └─────────┘
```

---

## Fluxo de Login

```
┌─────────────┐
│   Cliente   │
│ (Navegador) │
└──────┬──────┘
       │ 1. Preenche formulário
       │    usuario: "admin"
       │    senha: "Senha@123"
       │
       ▼
   ┌─────────┐
   │ Frontend│ 2. Valida força de senha (front)
   │ app.js  │    ✓ 8+ chars, maiúscula, ...
   │         │
   └────┬────┘
        │ 3. Envia POST /api/auth/login
        │    {usuario, senha}
        │
        ▼
    ┌──────────┐
    │ Backend  │
    │ server.js│
    └────┬─────┘
         │ 4. Normaliza username
         │    "ADMIN" → "admin"
         │ 5. Busca usuário no BD
         │    SELECT * FROM users
         │    WHERE username = "admin"
         │
         ▼
    ┌──────────┐
    │  SQLite  │
    │ (users)  │ 6. Retorna registro
    │          │    {id, username, hash, salt}
    └─────┬────┘
          │ 7. Verifica senha
          │    pbkdf2(input, salt) == hash
          │    usando timing-safe compare
          │
          ▼
    ┌──────────┐
    │ Auditoria│
    │ user_    │ 8. Registra evento
    │ audit    │    "login_success"
    └─────┬────┘
          │ 9. Retorna HTTP 200
          │    {ok: true, nome, perfil}
          │
          ▼
    ┌──────────┐
    │ Frontend │  10. Salva em localStorage
    │ app.js   │      session: {nome, perfil, token}
    │          │  11. Redireciona para dashboard
    └──────────┘
```

---

## Fluxo de Cálculo de Prioridade

```
┌─────────────────┐
│ Dados Veículo   │
│                 │
│ placa: ABC1234  │
│ entrada: 2026.04.01
│ urgencia: 3     │
│ horas: 2        │
│ status: "Aguardando"
│ servicos: [...] │
│ valor_cobrado   │
│ custos: [...]   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│ calculateMetrics()          │
│ (app.js linha ~1030)        │
│                             │
│ 1. Calcular dias no pátio   │
│    diasNoPatio = hoje - entrada
│                             │
│ 2. Buscar perfil serviço    │
│    SERVICE_PROFILES[idx]    │
│    → pressure, margin       │
│                             │
│ 3. Calcular projeção        │
│ financeira (complexo)       │
│                             │
│ 4. Aplicar 9 fatores:       │
│    - agingPressure          │
│    - urgencyPressure        │
│    - servicePressure        │
│    - durationBoost          │
│    - quickWinBoost          │
│    - profitabilityBoost     │
│    - waitingPenalty         │
│    - statusBoost            │
│    - overdueBoost           │
│                             │
│ 5. Somar para PRIORIDADE    │
│    prioridade = score total │
│                             │
│ 6. Decidir RECOMENDAÇÃO     │
│    if lucro negativo        │
│    → "Não vale a pena"      │
│    else if dias >= 12       │
│    → "Alta prioridade"      │
│    else if rápido + rentável│
│    → "Execução rápida"      │
│    else                     │
│    → "Vale a pena"          │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────┐
│ Resultado:      │
│                 │
│ {               │
│   diasNoPatio:   │
│   lucroEstimado: │ ← Cálculo financeiro
│   prioridade:    │ ← Score 0-100
│   recomendacao:  │ ← Categoria
│   justificativa: │ ← Motivos
│   atingeMargem:  │ ← Viabilidade
│ }               │
└─────────────────┘
```

---

## Fluxo de Importação CSV

```
┌────────────────┐
│ Arquivo CSV    │  exemplo-veiculos.csv
│ Selecionado    │
└────────┬───────┘
         │
         ▼
┌────────────────────────────────────┐
│ frontend app.js                    │
│ csvInput.addEventListener("change")│
│                                    │
│ 1. Lê arquivo com FileReader       │
│ 2. Chama parseCSV(content)         │
│    - Detecta ";" vs ","            │
│    - Cria mapa de colunas (fuzzy)  │
│    - SPLIT em linhas e valores     │
│                                    │
│ 3. Para CADA linha:                │
│    sanitizeVehicleRecord()         │
│    - Normaliza valores             │
│    - Valida tipos                  │
│    - Return item ou null           │
│                                    │
│ 4. Filter(Boolean) remove nulos    │
│ 5. Confirma: "Substituir tudo?"    │
└────────┬─────────────────────────────┘
         │ 6. Se OK: POST /api/vehicles/import
         │
         ▼
     ┌──────────────────────────────┐
     │ backend server.js            │
     │ POST /api/vehicles/import    │
     │                              │
     │ 1. Recebe items[] JSON       │
     │ 2. BEGIN TRANSACTION         │
     │ 3. DELETE FROM vehicles      │
     │ 4. Para CADA item:           │
     │    - persistPhotos()         │
     │    - upsertVehicle(db, item)│
     │    - INSERT/UPDATE           │
     │ 5. addHistory() log import   │
     │ 6. COMMIT ou ROLLBACK        │
     │                              │
     │ 7. Return {ok: true}         │
     └──────────┬───────────────────┘
                │
                ▼
     ┌──────────────────┐
     │ SQLite BD        │
     │ vehicles table   │
     │                  │
     │ [Dados inseridos]│
     └──────────────────┘
                │
                ▼
     ┌──────────────────────────────┐
     │ frontend                     │
     │ refreshData()                │
     │ render()                     │
     │                              │
     │ Tabela atualiza com          │
     │ dados importados             │
     └──────────────────────────────┘
```

---

## Modelo de Banco de Dados

```
┌───────────────────────────┐
│ vehicles                  │  (Serviços/Ordens)
├───────────────────────────┤
│ id (TEXT, PK)             │
│ placa (TEXT, UNIQUE)      │----- INDEX
│ marca, modelo, cor        │
│ status (TEXT)             │----- INDEX
│ cliente_tipo, cliente_nome│
│ entrada (TEXT - DATE)     │
│ urgencia, horas           │
│ pecas, mao_obra           │
│ custo_interno             │
│ valor_cobrado             │
│ servicos (JSON/TEXT)      │
│ quilometragem             │
│ estado_fisico             │
│ observacoes               │
│ fotos (JSON - URLs)       │
│ created_at, updated_at    │
└───────────────────────────┘
          │ 1 para N
          │
       ┌──▼─────────────────┐
       │ uploads/ (no FS)    │
       ├─────────────────────┤
       │ id-ts-random.jpg    │
       │ id-ts-random.png    │
       │ (armazenados em     │
       │  /data/uploads/)    │
       └─────────────────────┘


┌───────────────────────────┐
│ users                     │  (Credenciais)
├───────────────────────────┤
│ id (TEXT, PK)             │
│ username (TEXT, UNIQUE)   │----- INDEX
│ full_name                 │
│ role (admin|atendente|    │
│       |financeiro)        │
│ password_hash             │  (PBKDF2)
│ password_salt             │  (16 bytes)
│ is_active (0/1)           │
│ created_at (ISO)          │
└───────────────────────────┘
          │ 1 para N
          │
  ┌───────▼─────────────────┐
  │ user_audit              │  (Auditoria)
  ├─────────────────────────┤
  │ id (TEXT, PK)           │
  │ username                │
  │ action (login_success|  │
  │     |login_failed|etc)  │
  │ detail (mensagem)       │
  │ actor_name              │
  │ created_at              │----- INDEX
  └─────────────────────────┘


┌───────────────────────────┐
│ history                   │  (Eventos gerais)
├───────────────────────────┤
│ id (TEXT, PK)             │
│ tipo (Cadastro|Edição|    │
│     |Exclusão|etc)        │
│ descricao (mensagem)      │
│ por (ator)                │
│ created_at                │----- INDEX
└───────────────────────────┘


┌───────────────────────────┐
│ app_state                 │  (Configurações)
├───────────────────────────┤
│ key (TEXT, PK) = "rules"  │
│ value (JSON)              │  {pesoDias, urgencia, ...}
│ updated_at                │
└───────────────────────────┘
```

---

## Fluxo de Rendering (Frontend)

```
┌─────────────┐
│ Evento      │  click, input, tick
│ (30s ou    │
│  manual)    │
└─────┬───────┘
      │
      ▼
┌──────────────────┐
│ render()         │  (app.js linha ~1200)
│                  │
│ 1. Aplicar       │
│    filtros       │  - tipo cliente
│    - clienteTipo │  - recomendação
│    - recomend.   │  - viabilidade
│    - status      │  - status
│                  │
│ 2. buildCalculatedVehicles
│    Para cada veículo:
│    - sanitize
│    - calculateMetrics()
│    - filter(Boolean)
│    - sort by prioridade
│                  │
│ 3. renderKPIs()  │
│    Topbar: total, alta, em andamento
│    média dias, lucro
│                  │
│ 4. renderOpsSummary()
│    - Fazer agora (alta prioridade)
│    - Acompanhar (rápido/pecas)
│    - Sem retorno (não vale)
│                  │
│ 5. renderTable() │
│    tbody.innerHTML = ""
│    Para cada veículo (até 500):
│    - clone template
│    - preencher dados
│    - bind eventos
│    - append
│                  │
│ 6. renderKanban()│
│    4 colunas: Aguardando, Em andamento,
│                 Aguardando peças, Finalização
│    Para cada status:
│    - contar veículos
│    - renderizar cards
│                  │
│ 7. renderHistory()
│    Últimos 100 eventos
│    Format: timestamp - tipo - ator
│                  │
│ 8. renderUsers() │
│    Se admin: listar usuários
│                  │
│ 9. renderTabs()  │
│    Mostrar/esconder abas
│    (patio, kanban, historico, etc)
│                  │
└──────────────────┘
      │
      ▼ (DOM atualizado)
┌──────────────────┐
│ Navegador renderiza
│ novo estado visual
│
│ Tabela atualiza
│ KPIs mudam cores
│ Kanban reorganiza
│ Histórico rola
└──────────────────┘
```

---

## Matriz de Permissões

```
┌────────────────┬───────┬───────────┬──────────┐
│ Ação           │ Admin │ Atendente │ Financeir│
├────────────────┼───────┼───────────┼──────────┤
│ View pátio     │  ✅   │    ✅     │   ✅     │
│ View kanban    │  ✅   │    ✅     │   ✅     │
│ View histórico │  ✅   │    ❌     │   ❌     │
│ View usuários  │  ✅   │    ❌     │   ❌     │
│ View regras    │  ✅   │    ❌     │   ❌     │
│                │       │           │          │
│ Cadastrar      │  ✅   │    ✅     │   ❌     │
│ Editar         │  ✅   │    ✅     │   ❌     │
│ Deletar        │  ✅   │    ❌     │   ❌     │
│ Mudar status   │  ✅   │    ✅     │   ❌     │
│                │       │           │          │
│ Mudar regras   │  ✅   │    ❌     │   ❌     │
│ Criar usuário  │  ✅   │    ❌     │   ❌     │
│ Bloquear user  │  ✅   │    ❌     │   ❌     │
│ Mudar senha    │  ✅   │    ❌     │   ❌     │
│                │       │           │          │
│ Exportar CSV   │  ✅   │    ✅     │   ✅     │
│ Importar CSV   │  ✅   │    ✅     │   ❌     │
│ Assinatura     │  ✅   │    ✅     │   ❌     │
├────────────────┼───────┼───────────┼──────────┤
│ Visão dados    │ TUDO  │  FILTRADO │ READ-ONLY│
└────────────────┴───────┴───────────┴──────────┘
```

---

## Stack Tecnológico

```
┌──────────────────────────────────────────┐
│          LAYER PRESENTATION              │
├──────────────────────────────────────────┤
│ HTML5 | CSS3 Dark Mode | Vanilla JS      │
│ Responsivo (Grid + Flex)                 │
│ LocalStorage para cache offline          │
└──────────────────────────────────────────┘
                    ↕️ HTTP REST (JSON)
┌──────────────────────────────────────────┐
│          LAYER BUSINESS LOGIC            │
├──────────────────────────────────────────┤
│ Node.js Runtime                          │
│ Express.js (micro-framework)             │
│ Middleware: auth, CORS, body parser      │
│ Módulo: crypto (PBKDF2, randomBytes)    │
│ Módulo: fs (file storage)                │
│ Módulo: path (file paths)                │
└──────────────────────────────────────────┘
                    ↕️ SQL
┌──────────────────────────────────────────┐
│          LAYER DATA PERSISTENCE          │
├──────────────────────────────────────────┤
│ SQLite3 (embedded database)              │
│ sqlite (async wrapper)                   │
│ 5 tabelas: vehicles, users, history,     │
│            user_audit, app_state         │
│ Índices em: placa, status, created_at    │
└──────────────────────────────────────────┘
                    ↕️ FS
┌──────────────────────────────────────────┐
│          LAYER FILE STORAGE              │
├──────────────────────────────────────────┤
│ /data/oficina.db (SQLite)                │
│ /data/uploads/ (Fotos JPEG/PNG)          │
│ /data/backup-YYYY-MM-DD.db (snapshots)  │
└──────────────────────────────────────────┘
```

---

## Ciclo de Vida de Uma Sessão

```
T=0ms:  Usuário abre browser
        → Carrega index.html, css, js
        → Checa /api/setup/status
        
T=100ms: Se needsSetup=true:
        → Mostra tela de setup
        → Usuário cria admin
        
        Se needsSetup=false:
        → Mostra tela de login

T=500ms: Usuário faz login
        → POST /api/auth/login
        → Servidor valida + cria audit
        → Retorna {ok, nome, perfil}

T=600ms: Frontend salva em localStorage
        → session: {nome, perfil, usuario, at, lastActivityAt}
        → Esconde overlay de login

T=700ms: Chama /api/bootstrap
        → Carrega veículos (até 100)
        → Carrega histórico (300 items)
        → Carrega regras

T=1500ms: render()
        → Dashboard totalmente renderizado
        → Tabela, KPIs, História visíveis

T=30s:  AUTO-REFRESH
        → render() chamado automaticamente
        → Recalcula prioridades
        → Atualiza cores/badges

T=atividade: Qualquer clique/keystroke
        → touchSessionActivity()
        → session.lastActivityAt = agora

T=8h:   OU T=30min (inatividade):
        → sessionCheckInterval verifica
        → isSessionExpired() = true
        → forceLogout()
        → alert("Sessão expirada")
        → Limpa localStorage.session
        → Volta ao login

T=final: Botão "Sair"
        → btnLogout.addEventListener
        → forceLogout()
        → Limpa tudo
        → Volta ao login
```

---

## Tratamento de Erros

```
┌─────────────┐
│ Erro        │
│ Ocorre      │
└────┬────────┘
     │
 ┌───▼───────────────────────────────┐
 │ Onde ocorreu?                     │
 ├───────────────────────────────────┤
 │                                   │
 ├─ Frontend (app.js) ──────────────┐│
 │  try/catch em asyncs             ││
 │  apiFetch() retorna {ok: false}  ││
 │  alert() para usuário            ││
 │  console.error() para dev        ││
 │                            ┌─────┘│
 │                            │      │
 ├─ Backend (server.js) ──────┤      │
 │  try/catch em endpoints     │      │
 │  HTTP status code:          │      │
 │  - 400: Bad Request         │      │
 │  - 401: Unauthorized        │      │
 │  - 403: Forbidden           │      │
 │  - 404: Not Found           │      │
 │  - 409: Conflict (duplicado)│      │
 │  - 500: Internal Error      │      │
 │  JSON error: {ok, error}    │      │
 │                            │      │
 ├─ Database ─────────────────┘      │
 │  SELECT returns empty       │      │
 │  INSERT throws constraint   │      │
 │  ROLLBACK on transaction fail
 │                            │
 └────────────────────────────┘
```

---

## Performance Crítica

```
OPERAÇÃO                  TEMPO    PROBLEMA
─────────────────────────────────────────────
Login (validar)          <50ms    ✅ OK
Bootstrap 50 veícs       <200ms   ✅ OK
Bootstrap 500 veícs      ~2.5s    🟡 SLOW
Bootstrap 1000 veícs     >5s      🔴 BROKE

Render tabela 50          <100ms   ✅ OK
Render tabela 500        ~800ms   🟡 SLOW
Render kanban 500        TRAVA    🔴 BROKE

CSV import 100 linhas     <200ms   ✅ OK
CSV import 1000 linhas    ~800ms   🟡 SLOW

Filtrar veículos         <50ms    ✅ OK (com índices)
Query sem índice         >500ms   🔴 BROKE

Sem paginação:
  - Memory: ~2MB por 100 veículos
  - DOM: 1000 NÓS (td, tr, etc)
  - Renders: FULL refresh each time
```

---

**Fim da Documentação de Arquitetura**

