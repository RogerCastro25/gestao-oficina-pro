const STORAGE_KEYS = {
  vehicles: "oficina_veiculos_v2",
  rules: "oficina_regras_v1",
  history: "oficina_historico_v1",
  session: "oficina_sessao_v1",
  onboardingShown: "oficina_onboarding_shown"
};

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

const roles = {
  admin: { canEdit: true, canDelete: true, canRules: true },
  atendente: { canEdit: true, canDelete: false, canRules: false },
  financeiro: { canEdit: false, canDelete: false, canRules: false }
};

const VALID_STATUSES = ["Aguardando", "Em andamento", "Aguardando pecas", "Finalizacao"];
const VALID_CLIENT_TYPES = ["Particular", "Seguradora", "Locadora"];
const VALID_ESTADO_FISICO = ["Bom", "Regular", "Critico"];
const SERVICE_PROFILES = {
  Funilaria: { pressure: 5, quick: -2, margin: 2 },
  Pintura: { pressure: 4, quick: -1, margin: 1 },
  Mecanica: { pressure: 6, quick: 1, margin: 3 },
  Suspensao: { pressure: 7, quick: 2, margin: 2 },
  Freio: { pressure: 9, quick: 3, margin: 2 },
  Motor: { pressure: 8, quick: -3, margin: 4 },
  Cambio: { pressure: 7, quick: -2, margin: 4 },
  Eletrica: { pressure: 7, quick: 2, margin: 2 },
  Ar: { pressure: 5, quick: 1, margin: 1 }
};

const SERVICE_ICON_MAP = {
  funilaria: "assets/service-icons/funilaria.svg?v=2",
  pintura: "assets/service-icons/pintura.svg?v=2",
  mecanica: "assets/service-icons/mecanica.svg?v=2",
  suspensao: "assets/service-icons/suspensao.svg?v=2",
  freio: "assets/service-icons/freio.svg?v=2",
  motor: "assets/service-icons/motor.svg?v=2",
  cambio: "assets/service-icons/cambio.svg?v=2",
  eletrica: "assets/service-icons/eletrica.svg?v=2",
  ar: "assets/service-icons/ar.svg?v=2"
};

const form = document.getElementById("vehicleForm");
const tableBody = document.getElementById("vehicleTableBody");
const template = document.getElementById("rowTemplate");
const topbarKpis = document.getElementById("topbarKpis");
const patioInfo = document.getElementById("patioInfo");
const emptyState = document.getElementById("emptyState");
const opsNowCount = document.getElementById("opsNowCount");
const opsNowText = document.getElementById("opsNowText");
const opsWatchCount = document.getElementById("opsWatchCount");
const opsWatchText = document.getElementById("opsWatchText");
const opsStopCount = document.getElementById("opsStopCount");
const opsStopText = document.getElementById("opsStopText");
const filtroCliente = document.getElementById("filtroCliente");
const filtroRecomendacao = document.getElementById("filtroRecomendacao");
const filtroViabilidade = document.getElementById("filtroViabilidade");
const filtroStatus = document.getElementById("filtroStatus");
const btnExport = document.getElementById("btnExport");
const btnLogout = document.getElementById("btnLogout");
const btnAddVehicle = document.getElementById("btnAddVehicle");
const btnRulesView = document.getElementById("btnRulesView");
const csvInput = document.getElementById("csvInput");
const loginOverlay = document.getElementById("loginOverlay");
const loginForm = document.getElementById("loginForm");
const setupAdminForm = document.getElementById("setupAdminForm");
const loginHint = document.getElementById("loginHint");
const userBadge = document.getElementById("userBadge");
const sidePanel = document.getElementById("sidePanel");
const panelOverlay = document.getElementById("panelOverlay");
const panelClose = document.getElementById("panelClose");
const panelTitle = document.getElementById("panelTitle");
const detailPanelOverlay = document.getElementById("detailPanelOverlay");
const lucroPreview = document.getElementById("lucroPreview");
const tabs = Array.from(document.querySelectorAll(".tab-nav .tab"));
const views = Array.from(document.querySelectorAll(".main-body .view"));
const kanbanBoard = document.getElementById("kanbanBoard");
const historyList = document.getElementById("historyList");
const recentHistoryList = document.getElementById("recentHistoryList");
const rulesForm = document.getElementById("rulesForm");
const photoInput = document.getElementById("photoInput");
const photoPreview = document.getElementById("photoPreview");
const submitVehicleBtn = document.getElementById("submitVehicleBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const detailOverlay = document.getElementById("detailOverlay");
const detailClose = document.getElementById("detailClose");
const detailTitle = document.getElementById("detailTitle");
const detailMeta = document.getElementById("detailMeta");
const detailGallery = document.getElementById("detailGallery");
const printInspectionBtn = document.getElementById("printInspectionBtn");
const clearSignatureBtn = document.getElementById("clearSignatureBtn");
const signatureCanvas = document.getElementById("signatureCanvas");
const usersTabBtn = document.getElementById("usersTabBtn");
const usersList = document.getElementById("usersList");
const newUserForm = document.getElementById("newUserForm");

const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const AUTO_PRIORITY_REFRESH_MS = 30 * 1000;
const STATIC_DEMO_MODE = isStaticDemoMode();
const API_BASE_URL = resolveApiBaseUrl();

let vehicles = [];
let history = [];
let rules = { ...defaultRules };
let session = null;
let activeTab = "patio";
let backendOnline = false;
let pendingPhotos = [];
let editingVehicleId = null;
let detailVehicle = null;
let signState = { drawing: false, hasStroke: false };
let users = [];
let sessionCheckInterval = null;
let setupRequired = false;
let autoPriorityInterval = null;
let startupConnectionIssue = "";
let refreshInFlight = null;
let toastHost = null;
let isBootstrapping = true;

const dataApi = {
  async bootstrap() {
    const payload = await apiFetch("/api/bootstrap", { method: "GET" });
    if (Array.isArray(payload?.vehicles)) {
      backendOnline = true;
      return payload;
    }

    return {
      vehicles: loadJson(STORAGE_KEYS.vehicles, []),
      rules: { ...defaultRules, ...loadJson(STORAGE_KEYS.rules, {}) },
      history: loadJson(STORAGE_KEYS.history, [])
    };
  },
  async createVehicle(item, actor) {
    if (backendOnline) {
      await apiFetch("/api/vehicles", {
        method: "POST",
        body: JSON.stringify({ item })
      });
      return;
    }

    vehicles.push(item);
    saveJson(STORAGE_KEYS.vehicles, vehicles);
    addHistoryLocal("Cadastro", `${item.placa} adicionado por ${actor}.`);
  },
  async replaceVehicles(newList, actor) {
    if (backendOnline) {
      await apiFetch("/api/vehicles/import", {
        method: "POST",
        body: JSON.stringify({ items: newList })
      });
      return;
    }

    vehicles = newList;
    saveJson(STORAGE_KEYS.vehicles, vehicles);
    addHistoryLocal("Importação", `${newList.length} registros importados por ${actor}.`);
  },
  async updateStatus(id, status, actor) {
    if (backendOnline) {
      await apiFetch(`/api/vehicles/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      return;
    }

    vehicles = vehicles.map((item) => (item.id === id ? { ...item, status, updatedAt: new Date().toISOString() } : item));
    saveJson(STORAGE_KEYS.vehicles, vehicles);
    addHistoryLocal("Status", `${id} alterado para ${status} por ${actor}.`);
  },
  async deleteVehicle(id, actor) {
    if (backendOnline) {
      await apiFetch(`/api/vehicles/${id}`, {
        method: "DELETE"
      });
      return;
    }

    vehicles = vehicles.filter((item) => item.id !== id);
    saveJson(STORAGE_KEYS.vehicles, vehicles);
    addHistoryLocal("Exclusão", `${id} removido por ${actor}.`);
  },
  async updateVehicle(item, actor) {
    if (backendOnline) {
      await apiFetch(`/api/vehicles/${item.id}`, {
        method: "PUT",
        body: JSON.stringify({ item })
      });
      return;
    }

    vehicles = vehicles.map((current) => (current.id === item.id ? item : current));
    saveJson(STORAGE_KEYS.vehicles, vehicles);
    addHistoryLocal("Edição", `${item.placa} editado por ${actor}.`);
  },
  async login(usuario, senha) {
    return apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ usuario, senha })
    });
  },
  async getSetupStatus() {
    return apiFetch("/api/setup/status", { method: "GET" });
  },
  async createInitialAdmin(payload) {
    return apiFetch("/api/setup/admin", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  async listUsers() {
    return apiFetch("/api/users", { method: "GET" });
  },
  async createUser(payload) {
    return apiFetch("/api/users", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  async changePassword(id, newPassword) {
    return apiFetch(`/api/users/${id}/password`, {
      method: "PATCH",
      body: JSON.stringify({ newPassword })
    });
  },
  async toggleUserStatus(id, active) {
    return apiFetch(`/api/users/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ active })
    });
  },
  async saveRules(newRules, actor) {
    if (backendOnline) {
      await apiFetch("/api/rules", {
        method: "PUT",
        body: JSON.stringify({ rules: newRules })
      });
      return;
    }

    saveJson(STORAGE_KEYS.rules, newRules);
    addHistoryLocal("Regras", `Regras atualizadas por ${actor}.`);
  },
  async getLatest() {
    if (backendOnline) {
      const payload = await apiFetch("/api/bootstrap", { method: "GET" });
      if (Array.isArray(payload?.vehicles)) return payload;
    }

    return {
      vehicles: loadJson(STORAGE_KEYS.vehicles, []),
      rules: { ...defaultRules, ...loadJson(STORAGE_KEYS.rules, {}) },
      history: loadJson(STORAGE_KEYS.history, [])
    };
  },
  async logout() {
    return apiFetch("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({})
    });
  }
};

start().catch(() => {
  alert("Falha ao iniciar o app.");
});

async function start() {
  ensureToastHost();
  setLoadingState(true);
  session = loadJson(STORAGE_KEYS.session, null);
  if (session && isSessionExpired(session)) {
    session = null;
    localStorage.removeItem(STORAGE_KEYS.session);
  }

  if (STATIC_DEMO_MODE) {
    setupRequired = false;
    startupConnectionIssue = "";
    if (!session?.nome || !session?.perfil) {
      session = {
        nome: "Modo Demo",
        perfil: "admin",
        at: new Date().toISOString(),
        lastActivityAt: new Date().toISOString()
      };
      saveJson(STORAGE_KEYS.session, session);
    }
    vehicles = loadJson(STORAGE_KEYS.vehicles, []);
    rules = { ...defaultRules, ...loadJson(STORAGE_KEYS.rules, {}) };
    history = loadJson(STORAGE_KEYS.history, []);
  } else {
    const setupStatus = await dataApi.getSetupStatus();
    if (!setupStatus?.ok) {
      setupRequired = false;
      startupConnectionIssue = setupStatus?.error || "Falha de conexão com a API.";
    } else {
      setupRequired = Boolean(setupStatus?.needsSetup);
      startupConnectionIssue = "";
    }

    if (session?.token && !setupRequired) {
      const boot = await dataApi.bootstrap();
      vehicles = boot.vehicles;
      rules = { ...defaultRules, ...boot.rules };
      history = boot.history;
    } else {
      vehicles = [];
      rules = { ...defaultRules };
      history = [];
    }
  }

  hydrateRules();
  setupSignatureCanvas();
  setupSessionWatchers();
  applySessionState();
  await refreshUsers();
  bindEvents();
  startAutoPriorityRefresh();
  setDefaultEntryDate();
  setLoadingState(false);
  render();

  if (STATIC_DEMO_MODE) {
    notify("Modo demo ativo no GitHub Pages (sem backend). Dados salvos no navegador.", "info");
  }
}

function bindEvents() {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!getPermission().canEdit) {
      alert("Seu perfil não pode cadastrar veículos.");
      return;
    }

    const data = new FormData(form);
    const servicos = data.getAll("servico");
    if (servicos.length === 0) {
      notify("Selecione ao menos um tipo de serviço.", "warning");
      return;
    }

    const nowIso = new Date().toISOString();
    const item = sanitizeVehicleRecord({
      id: editingVehicleId || crypto.randomUUID(),
      placa: String(data.get("placa")).toUpperCase().trim(),
      marca: String(data.get("marca")).trim(),
      modelo: String(data.get("modelo")).trim(),
      cor: String(data.get("cor")).trim(),
      status: String(data.get("status")),
      clienteTipo: String(data.get("clienteTipo")),
      clienteNome: String(data.get("clienteNome")).trim(),
      entrada: String(data.get("entrada")),
      urgencia: Number(data.get("urgencia")),
      horas: Number(data.get("horas")),
      pecas: Number(data.get("pecas")),
      maoObra: Number(data.get("maoObra")),
      custoInterno: Number(data.get("custoInterno")),
      valorCobrado: Number(data.get("valorCobrado")),
      quilometragem: Number(data.get("quilometragem") || 0),
      estadoFisico: String(data.get("estadoFisico") || "Bom"),
      observacoes: String(data.get("observacoes") || "").trim(),
      photos: mergePhotos(editingVehicleId, pendingPhotos),
      servicos,
      createdAt: getCreatedAt(editingVehicleId) || nowIso,
      updatedAt: nowIso
    });

    if (!item) {
      highlightInvalidRequired(form);
      notify("Revise os dados do veículo. Há campos obrigatórios ausentes ou inválidos.", "error");
      return;
    }

    if (editingVehicleId) {
      await dataApi.updateVehicle(item, getActor());
    } else {
      await dataApi.createVehicle(item, getActor());
    }

    await refreshData();
    closePanel();
    notify(editingVehicleId ? "Serviço atualizado com sucesso." : "Serviço cadastrado com sucesso.", "success");
    activeTab = "patio";
    render();
  });

  photoInput.addEventListener("change", async (event) => {
    pendingPhotos = await filesToPayload(event.target.files);
    renderPhotoPreview();
  });

  filtroCliente.addEventListener("change", render);
  filtroRecomendacao.addEventListener("change", render);
  if (filtroViabilidade) filtroViabilidade.addEventListener("change", render);
  if (filtroStatus) filtroStatus.addEventListener("change", render);

  // ── Painel lateral: abrir / fechar ───────────────────
  btnAddVehicle.addEventListener("click", () => {
    resetFormState();
    openPanel(false);
  });
  btnRulesView?.addEventListener("click", () => {
    activeTab = "regras";
    renderTabs();
  });
  panelClose.addEventListener("click", closePanel);
  panelOverlay.addEventListener("click", closePanel);
  cancelEditBtn.addEventListener("click", closePanel);
  if (detailPanelOverlay) detailPanelOverlay.addEventListener("click", closeDetail);

  // ── Cálculo ao vivo do lucro estimado ────────────────
  ["pecas", "maoObra", "custoInterno", "valorCobrado", "horas", "entrada"].forEach((name) => {
    form.elements[name]?.addEventListener("input", updateLucroPreview);
    form.elements[name]?.addEventListener("change", updateLucroPreview);
  });

  btnExport.addEventListener("click", () => {
    const excel = toExcelHtml(vehicles);
    const dataAtual = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
    downloadFile(
      `oficina-veiculos-${dataAtual}.xls`,
      excel,
      "application/vnd.ms-excel;charset=utf-8;"
    );
  });

  csvInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    try {
      const imported = parseCSV(text);
      if (imported.length === 0) {
        notify("CSV sem registros válidos.", "warning");
        return;
      }

      if (!confirm("Importar CSV substituirá os registros atuais. Continuar?")) {
        return;
      }

      await dataApi.replaceVehicles(imported, getActor());
      await refreshData();
      notify("Planilha importada com sucesso.", "success");
      render();
    } catch {
      notify("Falha ao importar CSV.", "error");
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (setupRequired) {
      alert("Finalize o primeiro acesso criando o usuário administrador.");
      return;
    }

    const data = new FormData(loginForm);

    const usuario = String(data.get("usuario") || "").trim().toLowerCase();
    const senha = String(data.get("senha") || "");
    const auth = await dataApi.login(usuario, senha);
    if (!auth?.ok) {
      notify(auth?.error || "Usuário ou senha inválidos.", "error");
      return;
    }

    session = {
      nome: auth.nome,
      perfil: auth.perfil,
      token: auth.token,
      refreshToken: auth.refreshToken,
      usuario,
      at: new Date().toISOString(),
      lastActivityAt: new Date().toISOString()
    };

    saveJson(STORAGE_KEYS.session, session);
    addHistoryLocal("Sessão", `${session.nome} entrou como ${session.perfil}.`);
    await refreshData();
    notify(`Bem-vindo, ${auth.nome}.`, "success");
    applySessionState();
    touchSessionActivity();
    await refreshUsers();
    render();
  });

  setupAdminForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(setupAdminForm);
    const payload = {
      username: String(data.get("username") || "").trim().toLowerCase(),
      fullName: String(data.get("fullName") || "").trim(),
      password: String(data.get("password") || "")
    };

    if (!isStrongPassword(payload.password)) {
      highlightInvalidRequired(setupAdminForm);
      notify("Senha fraca. Use no mínimo 8 caracteres com maiúscula, minúscula, número e símbolo.", "warning");
      return;
    }

    const result = await dataApi.createInitialAdmin(payload);
    if (!result?.ok) {
      notify(result?.error || "Falha ao criar administrador inicial.", "error");
      return;
    }

    setupRequired = false;
    setupAdminForm.reset();
    notify("Administrador criado com sucesso. Faça login para continuar.", "success");
    applySessionState();
  });

  cancelEditBtn.addEventListener("click", () => {
    resetFormState();
  });

  detailClose.addEventListener("click", closeDetail);
  clearSignatureBtn.addEventListener("click", clearSignature);
  printInspectionBtn.addEventListener("click", () => {
    if (!detailVehicle) return;
    generateInspectionPdf(detailVehicle);
  });

  btnLogout.addEventListener("click", async () => {
    if (session) {
      addHistoryLocal("Sessão", `${session.nome} encerrou a sessão.`);
    }

    if (backendOnline && session?.token) {
      await dataApi.logout();
    }

    forceLogout();
    notify("Sessão encerrada com sucesso.", "info");
  });

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activeTab = tab.dataset.tab;
      renderTabs();
    });
  });

  bindKeyboardShortcuts();

  rulesForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!getPermission().canRules) {
      alert("Seu perfil não pode alterar regras.");
      return;
    }

    const data = new FormData(rulesForm);
    const newRules = {
      pesoDias: Number(data.get("pesoDias")),
      pesoUrgencia: Number(data.get("pesoUrgencia")),
      bonusRapido: Number(data.get("bonusRapido")),
      penalidadePecas: Number(data.get("penalidadePecas")),
      limiteRapidoHoras: Number(data.get("limiteRapidoHoras")),
      rentabRapida: Number(data.get("rentabRapida")),
      diasAlta: Number(data.get("diasAlta")),
      horasNaoVale: Number(data.get("horasNaoVale")),
      rentabNaoVale: Number(data.get("rentabNaoVale")),
      margemMinimaSobreCusto: Number(data.get("margemMinimaSobreCusto")) / 100,
      custoHoraTecnicaBase: Number(data.get("custoHoraTecnicaBase")),
      custoDiaPatioBase: Number(data.get("custoDiaPatioBase"))
    };

    await dataApi.saveRules(newRules, getActor());
    await refreshData();
    hydrateRules();
    render();
  });

  newUserForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (session?.perfil !== "admin") {
      alert("Somente administrador pode gerenciar usuários.");
      return;
    }

    const data = new FormData(newUserForm);
    const payload = {
      username: String(data.get("username") || "").trim().toLowerCase(),
      fullName: String(data.get("fullName") || "").trim(),
      role: String(data.get("role") || "atendente"),
      password: String(data.get("password") || "")
    };

    if (!isStrongPassword(payload.password)) {
      highlightInvalidRequired(newUserForm);
      notify("Senha fraca. Use no mínimo 8 caracteres com maiúscula, minúscula, número e símbolo.", "warning");
      return;
    }

    const result = await dataApi.createUser(payload);
    if (!result?.ok) {
      notify(result?.error || "Falha ao criar usuário.", "error");
      return;
    }

    newUserForm.reset();
    notify("Usuário criado com sucesso.", "success");
    await refreshUsers();
    renderUsers();
  });
}

function openPanel(isEdit) {
  panelTitle.textContent = isEdit ? "Editar Serviço" : "Novo Serviço";
  sidePanel.classList.remove("hidden");
  panelOverlay.classList.remove("hidden");
  // foca no primeiro campo
  setTimeout(() => form.elements.marca?.focus(), 100);
}

function closePanel() {
  sidePanel.classList.add("hidden");
  panelOverlay.classList.add("hidden");
  resetFormState();
}

function updateLucroPreview() {
  const pecas = Number(form.elements.pecas?.value || 0);
  const mao = Number(form.elements.maoObra?.value || 0);
  const custoInterno = Number(form.elements.custoInterno?.value || 0);
  const valorCobrado = Number(form.elements.valorCobrado?.value || 0);
  const horas = Number(form.elements.horas?.value || 0.5);
  const entrada = String(form.elements.entrada?.value || getTodayLocalDateString());
  const diasNoPatio = Math.max(0, Math.floor((new Date() - new Date(`${entrada}T00:00:00`)) / (1000 * 60 * 60 * 24)));
  const servicos = Array.from(form.querySelectorAll("input[name='servico']:checked")).map((input) => input.value);
  const serviceProfile = getServiceProfile(servicos);
  const financeRules = getFinanceRules(rules);
  const financeiro = calculateFinancialProjection({
    receitaPecas: pecas,
    receitaMaoObra: mao,
    valorCobrado,
    custoInterno,
    horas,
    diasNoPatio,
    serviceProfile,
    financeRules
  });

  if (lucroPreview) {
    lucroPreview.textContent = `Lucro estimado: ${currency(financeiro.lucroEstimado)} | Meta (50%): ${currency(financeiro.lucroMinimo50)} | Margem: ${(financeiro.margemSobreCusto * 100).toFixed(1)}%`;
    lucroPreview.style.color = financeiro.atingeMargemMinima ? "var(--ok)" : "var(--danger)";
  }
}

async function refreshData() {
  const latest = await dataApi.getLatest();
  if (!latest) return;
  vehicles = latest.vehicles;
  rules = { ...defaultRules, ...latest.rules };
  history = latest.history;
}

function applySessionState() {
  const hasSession = Boolean(session?.perfil && session?.nome);
  loginOverlay.classList.toggle("hidden", hasSession);
  userBadge.textContent = hasSession ? `${session.nome} (${capitalize(session.perfil)})` : "—";

  if (startupConnectionIssue) {
    loginForm.classList.remove("hidden");
    setupAdminForm.classList.add("hidden");
    if (loginHint) loginHint.textContent = `${startupConnectionIssue} Acesse pelo endereço correto: http://localhost:3000`;
    return;
  }

  if (setupRequired) {
    loginForm.classList.add("hidden");
    setupAdminForm.classList.remove("hidden");
    if (loginHint) loginHint.textContent = "Crie o administrador para começar.";
  } else {
    loginForm.classList.remove("hidden");
    setupAdminForm.classList.add("hidden");
    if (loginHint) loginHint.textContent = "Acesso restrito a usuários cadastrados.";
  }

  const permission = getPermission();
  form.classList.toggle("readonly", !permission.canEdit);
  rulesForm.classList.toggle("readonly", !permission.canRules);
  usersTabBtn.hidden = session?.perfil !== "admin";
  btnRulesView?.classList.toggle("hidden", session?.perfil !== "admin");

  if (session) startSessionCheck();

  if (session?.perfil !== "admin" && (activeTab === "usuarios" || activeTab === "regras")) {
    activeTab = "patio";
    renderTabs();
  }
}

function resetFormState() {
  editingVehicleId = null;
  pendingPhotos = [];
  form.reset();
  setDefaultEntryDate();
  renderPhotoPreview();
  if (submitVehicleBtn) submitVehicleBtn.textContent = "💾 Salvar";
  if (lucroPreview) lucroPreview.textContent = "Lucro estimado: —";
}

function setDefaultEntryDate() {
  if (!form?.elements?.entrada) return;
  if (!form.elements.entrada.value) {
    form.elements.entrada.value = getTodayLocalDateString();
  }
}

function getTodayLocalDateString() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function mergePhotos(vehicleId, newPhotos) {
  if (!vehicleId) {
    return newPhotos;
  }
  const current = vehicles.find((v) => v.id === vehicleId);
  return [...(current?.photos || []), ...newPhotos];
}

function startAutoPriorityRefresh() {
  if (autoPriorityInterval) {
    clearInterval(autoPriorityInterval);
  }

  autoPriorityInterval = setInterval(() => {
    if (document.hidden) return;
    render();
  }, AUTO_PRIORITY_REFRESH_MS);
}

function getCreatedAt(vehicleId) {
  const current = vehicles.find((v) => v.id === vehicleId);
  return current?.createdAt;
}

function addHistoryLocal(tipo, descricao) {
  history.unshift({
    id: crypto.randomUUID(),
    tipo,
    descricao,
    por: getActor(),
    data: new Date().toISOString()
  });
  saveJson(STORAGE_KEYS.history, history.slice(0, 300));
}

function render() {
  if (isBootstrapping) {
    renderSkeletonState();
    return;
  }

  const filtroStatusVal = filtroStatus?.value || "Todos";
  const filtroViabilidadeVal = filtroViabilidade?.value || "Todos";
  const calculated = buildCalculatedVehicles(vehicles, rules)
    .filter((v) => filtroCliente.value === "Todos" || v.clienteTipo === filtroCliente.value)
    .filter((v) => filtroRecomendacao.value === "Todos" || normalizeRecommendation(v.metrics.recomendacao) === normalizeRecommendation(filtroRecomendacao.value))
    .filter((v) => {
      if (filtroViabilidadeVal === "Todos") return true;
      if (filtroViabilidadeVal === "Viavel") return v.metrics.atingeMargemMinima;
      if (filtroViabilidadeVal === "AbaixoMinimo") return !v.metrics.atingeMargemMinima;
      return true;
    })
    .filter((v) => filtroStatusVal === "Todos" || v.status === filtroStatusVal);

  renderKPIs(calculated);
  renderOpsSummary(calculated);
  renderTable(calculated);
  renderKanban(calculated);
  renderHistory();
  renderUsers();
  renderTabs();
}

function renderTabs() {
  tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === activeTab);
  });
  views.forEach((view) => {
    const isActive = view.dataset.view === activeTab;
    view.classList.toggle("active", isActive);
    view.classList.toggle("hidden", !isActive);
  });
}

function renderKPIs(data) {
  const total = vehicles.length; // total sem filtros
  const alta = data.filter((v) => v.metrics.recomendacao === "Alta prioridade").length;
  const andamento = data.filter((v) => v.status === "Em andamento").length;
  const lucroTotal = data.reduce((acc, v) => acc + (v.metrics.lucroEstimado || 0), 0);
  const mediaDias = data.length ? Math.round(data.reduce((acc, v) => acc + v.metrics.diasNoPatio, 0) / data.length) : 0;

  if (!topbarKpis) return;
  topbarKpis.innerHTML = "";

  const items = [
    { label: "No pátio", value: total, cls: total > 0 ? "amber" : "" },
    { label: "Alta prioridade", value: alta, cls: alta > 0 ? "red" : "" },
    { label: "Em andamento", value: andamento, cls: andamento > 0 ? "green" : "" },
    { label: "Média no pátio", value: `${mediaDias}d`, cls: mediaDias >= rules.diasAlta ? "red" : "amber" },
    { label: "Lucro estimado", value: currency(lucroTotal), cls: "green" }
  ];

  for (const item of items) {
    const chip = document.createElement("div");
    chip.className = "kpi-chip";
    chip.innerHTML = `<span class="kpi-label">${item.label}</span><span class="kpi-value ${item.cls}">${item.value}</span>`;
    topbarKpis.append(chip);
  }
}

function renderOpsSummary(data) {
  if (!opsNowCount || !opsWatchCount || !opsStopCount) return;

  const nowList = data.filter((item) => item.metrics.recomendacao === "Alta prioridade").slice(0, 3);
  const watchList = data.filter((item) => item.metrics.recomendacao === "Execucao rapida" || item.status === "Aguardando pecas").slice(0, 3);
  const stopList = data.filter((item) => item.metrics.recomendacao === "Não vale a pena").slice(0, 3);

  opsNowCount.textContent = String(data.filter((item) => item.metrics.recomendacao === "Alta prioridade").length);
  opsWatchCount.textContent = String(data.filter((item) => item.metrics.recomendacao === "Execucao rapida" || item.status === "Aguardando pecas").length);
  opsStopCount.textContent = String(data.filter((item) => item.metrics.recomendacao === "Não vale a pena").length);

  opsNowText.textContent = summarizeOpsList(nowList, "Priorize os mais urgentes e perto da entrega.");
  opsWatchText.textContent = summarizeOpsList(watchList, "Monitore peças, encaixes rápidos e próximos passos.");
  opsStopText.textContent = summarizeOpsList(stopList, "Revise margem, aprove novamente ou encerre.");
}

function renderTable(data) {
  tableBody.innerHTML = "";
  const permission = getPermission();

  // Atualizar contador
  if (patioInfo) patioInfo.textContent = `${data.length} veículo${data.length !== 1 ? "s" : ""} · ordenado por prioridade`;
  if (emptyState) {
    emptyState.classList.toggle("hidden", data.length > 0);
    if (data.length === 0) {
      emptyState.innerHTML = `
        <div class="empty-illustrated">
          <div class="empty-icon">🚗</div>
          <strong>Pátio vazio no momento</strong>
          <p>Comece cadastrando o primeiro serviço e o sistema organiza a prioridade automaticamente.</p>
          ${getPermission().canEdit ? '<button class="btn btn-accent" type="button" data-action="empty-new">+ Novo Serviço</button>' : ''}
        </div>`;

      const cta = emptyState.querySelector("[data-action='empty-new']");
      if (cta) {
        cta.addEventListener("click", () => {
          resetFormState();
          openPanel(false);
        });
      }
    }
  }

  for (const [index, v] of data.entries()) {
    const row = template.content.firstElementChild.cloneNode(true);

    // Prioridade colorida
    const prioNum = Math.round(v.metrics.prioridade);
    const prioCell = row.querySelector(".prio");
    const prioStack = document.createElement("div");
    prioStack.className = "prio-stack";
    const badge = document.createElement("span");
    badge.className = `prio-badge ${prioNum >= 50 ? "high" : prioNum >= 25 ? "med" : "low"}`;
    badge.textContent = index + 1;
    badge.title = v.metrics.justificativa;
    const prioLabel = document.createElement("small");
    prioLabel.className = "prio-label";
    prioLabel.textContent = priorityBandLabel(prioNum);
    prioStack.append(badge, prioLabel);
    prioCell.append(prioStack);

    // Veículo
    const veiculoCell = row.querySelector(".veiculo");
    veiculoCell.innerHTML = `<div class="vehicle-name">${v.marca} ${v.modelo}</div><div class="vehicle-plate">${v.placa} · ${v.cor}</div>`;

    // Cliente
    row.querySelector(".cliente").innerHTML = `<div>${v.clienteNome}</div><div style="font-size:.75rem;color:var(--muted)">${v.clienteTipo}</div>`;

    // Data de entrada
    row.querySelector(".entrada").textContent = formatDateOnly(v.entrada);

    // Serviços
    const serviceCell = row.querySelector(".servico");
    const chipsDiv = document.createElement("div");
    chipsDiv.className = "service-chips";
    (v.servicos || []).forEach((s) => {
      const chip = document.createElement("span");
      chip.className = "s-chip";
      const icon = document.createElement("img");
      icon.className = "s-chip-icon";
      icon.src = getServiceIconUrl(s);
      icon.alt = formatServiceName(s);
      icon.loading = "lazy";

      const text = document.createElement("span");
      text.textContent = formatServiceName(s);

      chip.append(icon, text);
      chipsDiv.append(chip);
    });
    serviceCell.append(chipsDiv);

    // Dias
    row.querySelector(".tempo").textContent = `${v.metrics.diasNoPatio}d`;

    // Valor cobrado
    const valorCobradoCell = row.querySelector(".valorCobrado");
    const valorCobrado = Number(v.valorCobrado || 0);
    const valorMinimo = Number(v.metrics.valorMinimoCobrado || 0);
    const valorOk = valorCobrado >= valorMinimo;
    const valorColor = valorOk ? "var(--ok)" : "var(--danger)";
    valorCobradoCell.innerHTML = `<span style="color:${valorColor}" title="Mínimo recomendado: ${currency(valorMinimo)}">${currency(valorCobrado)}</span>`;

    // Lucro
    const lucroVal = v.metrics.lucroEstimado;
    const lucroCell = row.querySelector(".lucro");
    const lucroColor = v.metrics.atingeMargemMinima ? "var(--ok)" : "var(--danger)";
    lucroCell.innerHTML = `<span style="color:${lucroColor}" title="Meta mínima de 50% sobre custo: ${currency(v.metrics.lucroMinimo50)}">${currency(lucroVal)}</span>`;

    // Recomendação
    const rec = row.querySelector(".recomendacao");
    const span = document.createElement("span");
    span.className = `tag ${toTagClass(v.metrics.recomendacao)}`;
    span.textContent = formatRecommendation(v.metrics.recomendacao);
    span.title = v.metrics.justificativa;
    rec.append(span);

    // Status select
    const statusSelect = row.querySelector(".status-select");
    statusSelect.value = v.status;
    statusSelect.disabled = !permission.canEdit;
    statusSelect.addEventListener("change", async () => {
      await dataApi.updateStatus(v.id, statusSelect.value, getActor());
      await refreshData();
      render();
    });

    // Ações
    const detailBtn = row.querySelector(".btn-detail");
    detailBtn.addEventListener("click", () => openDetail(v));

    const editBtn = row.querySelector(".btn-edit");
    editBtn.disabled = !permission.canEdit;
    editBtn.addEventListener("click", () => { if (permission.canEdit) startEditVehicle(v); });

    const deleteBtn = row.querySelector(".btn-delete");
    deleteBtn.disabled = !permission.canDelete;
    deleteBtn.addEventListener("click", async () => {
      if (!permission.canDelete) { alert("Seu perfil não pode excluir registros."); return; }
      if (!confirm("Deseja excluir este registro?")) return;
      await dataApi.deleteVehicle(v.id, getActor());
      await refreshData();
      render();
    });

    tableBody.append(row);
  }
}

function renderKanban(data) {
  const columns = [
    { status: "Aguardando", label: "⏳ Aguardando" },
    { status: "Em andamento", label: "🔧 Em andamento" },
    { status: "Aguardando pecas", label: "📦 Aguardando peças" },
    { status: "Finalizacao", label: "✅ Finalização" }
  ];
  kanbanBoard.innerHTML = "";

  columns.forEach(({ status, label }) => {
    const col = document.createElement("div");
    col.className = "kanban-col";
    const items = data.filter((v) => v.status === status);

    const header = document.createElement("div");
    header.className = "kanban-col-header";
    header.innerHTML = `<span>${label}</span><span class="col-count">${items.length}</span>`;
    col.append(header);

    if (items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-illustrated compact";
      empty.innerHTML = `<span class="empty-icon">🧩</span><strong>Sem veículos</strong><span>Arraste o fluxo pelo pátio para preencher esta coluna.</span>`;
      col.append(empty);
    } else {
      items.forEach((v) => {
        const card = document.createElement("div");
        card.className = "kanban-card";
        card.innerHTML = `
          <div class="kcard-plate">${v.placa}</div>
          <div class="kcard-name">${v.marca} ${v.modelo} · ${v.clienteNome}</div>
          <div class="kcard-meta">
            <span class="tag tag-muted">${v.metrics.diasNoPatio}d no pátio</span>
            <span class="tag ${toTagClass(v.metrics.recomendacao)}">${formatRecommendation(v.metrics.recomendacao)}</span>
          </div>`;
        card.title = v.metrics.justificativa;
        card.addEventListener("click", () => openDetail(v));
        col.append(card);
      });
    }

    kanbanBoard.append(col);
  });
}

function renderHistory() {
  historyList.innerHTML = "";
  if (recentHistoryList) recentHistoryList.innerHTML = "";

  if (history.length === 0) {
    historyList.innerHTML = `
      <div class="empty-illustrated compact">
        <span class="empty-icon">📜</span>
        <strong>Nenhum evento registrado</strong>
        <span>As ações da equipe vão aparecer aqui em tempo real.</span>
      </div>`;
    if (recentHistoryList) {
      recentHistoryList.innerHTML = `
        <div class="empty-illustrated compact">
          <span class="empty-icon">✨</span>
          <strong>Sem movimentações recentes</strong>
          <span>As próximas atualizações do pátio aparecerão aqui.</span>
        </div>`;
    }
    return;
  }

  history.slice(0, 100).forEach((item) => {
    const node = document.createElement("div");
    node.className = "history-item";
    node.innerHTML = `
      <span class="hi-time">${formatDateTime(item.data)}</span>
      <span class="hi-text"><strong>${item.tipo}</strong> — ${item.descricao}</span>`;
    historyList.append(node);
  });

  if (recentHistoryList) {
    history.slice(0, 8).forEach((item) => {
      const card = document.createElement("div");
      card.className = "recent-history-card";
      card.innerHTML = `<span class="rh-time">${formatDateTime(item.data)}</span><div class="rh-text"><strong>${item.tipo}</strong> — ${item.descricao}</div>`;
      recentHistoryList.append(card);
    });
  }
}

function summarizeOpsList(list, fallback) {
  if (!list.length) return fallback;
  return list.map((item) => `${item.placa} ${item.marca}`).join(" · ");
}

function hydrateRules() {
  Object.entries(rules).forEach(([key, value]) => {
    const input = rulesForm.elements.namedItem(key);
    if (!input) return;
    if (key === "margemMinimaSobreCusto") {
      input.value = Number(value || 0) * 100;
      return;
    }
    input.value = value;
  });
}

function calculateMetrics(v, activeRules) {
  const normalized = sanitizeVehicleRecord(v) || v;
  const now = new Date();
  const entrada = new Date(`${normalized.entrada}T00:00:00`);
  const diasNoPatio = Math.max(0, Math.floor((now - entrada) / (1000 * 60 * 60 * 24)));
  const serviceProfile = getServiceProfile(normalized.servicos || []);
  const financeRules = getFinanceRules(activeRules);

  const urgencia = clampNumber(normalized.urgencia, 1, 5, 3);
  const horas = Math.max(0.5, parseNumericValue(normalized.horas));
  const financeiro = calculateFinancialProjection({
    receitaPecas: normalized.pecas,
    receitaMaoObra: normalized.maoObra,
    valorCobrado: normalized.valorCobrado,
    custoInterno: normalized.custoInterno,
    horas,
    diasNoPatio,
    serviceProfile,
    financeRules
  });
  const receita = financeiro.receitaPrevista;
  const lucroEstimado = financeiro.lucroEstimado;
  const rentabilidadeHora = horas > 0 ? lucroEstimado / horas : 0;
  const servicoRapido = horas <= activeRules.limiteRapidoHoras;
  const agingPressure = diasNoPatio * activeRules.pesoDias;
  const urgencyPressure = urgencia * activeRules.pesoUrgencia;
  const durationBoost = Math.max(0, 15 - horas) + serviceProfile.quick;
  const quickWinBoost = servicoRapido ? activeRules.bonusRapido + serviceProfile.quick : 0;
  const profitabilityBoost = clampNumber((financeiro.margemSobreCusto - financeRules.margemMinimaSobreCusto) * 35, -18, 18, 0) + serviceProfile.margin;
  const waitingPenalty = normalized.status === "Aguardando pecas"
    ? activeRules.penalidadePecas * Math.max(0.3, 1 - diasNoPatio / Math.max(1, activeRules.diasAlta))
    : 0;
  const statusBoost = normalized.status === "Finalizacao"
    ? activeRules.pesoUrgencia + 6
    : normalized.status === "Em andamento"
      ? activeRules.pesoUrgencia / 2
      : 0;
  const overdueBoost = diasNoPatio >= activeRules.diasAlta ? activeRules.pesoUrgencia * 1.5 : 0;
  const servicePressure = serviceProfile.pressure;

  const prioridade =
    agingPressure +
    urgencyPressure +
    servicePressure +
    durationBoost +
    quickWinBoost +
    profitabilityBoost +
    waitingPenalty +
    statusBoost +
    overdueBoost;

  let recomendacao = "Vale a pena";
  if (!financeiro.atingeMargemMinima || lucroEstimado <= 0 || (horas > activeRules.horasNaoVale && rentabilidadeHora < activeRules.rentabNaoVale)) {
    recomendacao = "Não vale a pena";
  } else if (diasNoPatio >= activeRules.diasAlta || urgencia >= 5 || normalized.status === "Finalizacao") {
    recomendacao = "Alta prioridade";
  } else if (servicoRapido && rentabilidadeHora >= activeRules.rentabRapida && diasNoPatio <= activeRules.diasAlta && normalized.status !== "Aguardando pecas") {
    recomendacao = "Execucao rapida";
  }

  const motivos = [
    `dias: ${diasNoPatio}`,
    `urgência: ${urgencia}`,
    `status: ${formatStatus(normalized.status).toLowerCase()}`,
    `serviço: ${serviceProfile.label.toLowerCase()}`,
    `margem: ${(financeiro.margemSobreCusto * 100).toFixed(1)}%`,
    `rentab./h: ${currency(rentabilidadeHora)}`
  ];

  if (normalized.status === "Aguardando pecas") motivos.push("aguardando peças reduz avanço");
  if (normalized.status === "Finalizacao") motivos.push("fase final precisa giro rápido");
  if (servicoRapido) motivos.push("serviço curto favorece encaixe");
  if (diasNoPatio >= activeRules.diasAlta) motivos.push("tempo parado acima do limite");
  if (!financeiro.atingeMargemMinima) motivos.push(`abaixo da meta de ${Math.round(financeRules.margemMinimaSobreCusto * 100)}%`);
  if (lucroEstimado <= 0) motivos.push("lucro estimado negativo");

  return {
    diasNoPatio,
    lucroEstimado,
    rentabilidadeHora,
    custoOperacional: financeiro.custoOperacional,
    lucroMinimo50: financeiro.lucroMinimo50,
    margemSobreCusto: financeiro.margemSobreCusto,
    atingeMargemMinima: financeiro.atingeMargemMinima,
    prioridade,
    recomendacao,
    justificativa: motivos.join(" | ")
  };
}

function calculateFinancialProjection({ receitaPecas, receitaMaoObra, valorCobrado, custoInterno, horas, diasNoPatio, serviceProfile, financeRules }) {
  const receitaPorItens = Math.max(0, parseNumericValue(receitaPecas)) + Math.max(0, parseNumericValue(receitaMaoObra));
  const receitaPrevista = Math.max(0, parseNumericValue(valorCobrado)) || receitaPorItens;
  const custoBase = Math.max(0, parseNumericValue(custoInterno));
  const horasServico = Math.max(0.5, parseNumericValue(horas));
  const dias = Math.max(0, parseNumericValue(diasNoPatio));
  const pressure = serviceProfile?.pressure || 4;

  const custoHoraServico = financeRules.custoHoraTecnicaBase + pressure;
  const custoPatioDia = financeRules.custoDiaPatioBase + pressure * 0.6;
  const custoTempoServico = horasServico * custoHoraServico;
  const custoPatio = dias * custoPatioDia;
  const custoOperacional = custoBase + custoTempoServico + custoPatio;
  const lucroEstimado = receitaPrevista - custoOperacional;
  const lucroMinimo50 = custoOperacional * financeRules.margemMinimaSobreCusto;
  const valorMinimoCobrado = custoOperacional + lucroMinimo50;
  const margemSobreCusto = custoOperacional > 0 ? lucroEstimado / custoOperacional : 0;

  return {
    receitaPrevista,
    custoOperacional,
    custoTempoServico,
    custoPatio,
    lucroEstimado,
    lucroMinimo50,
    valorMinimoCobrado,
    margemSobreCusto,
    atingeMargemMinima: margemSobreCusto >= financeRules.margemMinimaSobreCusto
  };
}

function getFinanceRules(activeRules) {
  const margem = parseNumericValue(activeRules?.margemMinimaSobreCusto);
  const custoHora = parseNumericValue(activeRules?.custoHoraTecnicaBase);
  const custoPatio = parseNumericValue(activeRules?.custoDiaPatioBase);
  return {
    margemMinimaSobreCusto: margem > 0 ? margem : 0.5,
    custoHoraTecnicaBase: custoHora > 0 ? custoHora : 22,
    custoDiaPatioBase: custoPatio > 0 ? custoPatio : 18
  };
}

function getServiceProfile(services) {
  const base = { label: "Serviço geral", pressure: 4, quick: 0, margin: 0 };
  const list = Array.isArray(services) ? services : [];
  if (!list.length) return base;

  return list.reduce((selected, service) => {
    const profile = SERVICE_PROFILES[service] || { label: service, pressure: 4, quick: 0, margin: 0 };
    if (!selected || profile.pressure + profile.margin > selected.pressure + selected.margin) {
      return { ...profile, label: service };
    }
    return selected;
  }, null) || base;
}

function getPermission() {
  return roles[session?.perfil] || roles.financeiro;
}

function getActor() {
  return session?.nome || "Sistema";
}

function toTagClass(text) {
  if (text === "Não vale a pena") return "tag-red";
  if (text === "Alta prioridade") return "tag-amber";
  if (text === "Execucao rapida") return "tag-green";
  return "tag-muted";
}

function formatRecommendation(value) {
  if (value === "Execucao rapida") return "Execução rápida";
  if (value === "Nao vale a pena" || value === "Não vale a pena") return "Não vale a pena";
  return value;
}

function normalizeRecommendation(value) {
  if (value === "Execucao rapida" || value === "Execução rápida") return "Execucao rapida";
  if (value === "Nao vale a pena" || value === "Não vale a pena") return "Nao vale a pena";
  return value;
}

function formatStatus(value) {
  if (value === "Aguardando pecas") return "Aguardando peças";
  if (value === "Finalizacao") return "Finalização";
  return value;
}

function formatDateTime(value) {
  return new Date(value).toLocaleString("pt-BR");
}

function formatDateOnly(value) {
  if (!value) return "—";
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split("-");
    return `${day}/${month}/${year}`;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString("pt-BR");
}

function formatServiceName(value) {
  const key = normalizeLookupKey(value);
  const map = {
    mecanica: "Mecânica",
    suspensao: "Suspensão",
    cambio: "Câmbio",
    eletrica: "Elétrica",
    "ar": "Ar-cond.",
    "ar-cond": "Ar-cond.",
    "ar cond": "Ar-cond."
  };
  return map[key] || value;
}

function getServiceIconUrl(value) {
  const key = normalizeLookupKey(value);
  return SERVICE_ICON_MAP[key] || "assets/service-icons/mecanica.svg?v=2";
}

function priorityBandLabel(priority) {
  if (priority >= 50) return "Alta";
  if (priority >= 25) return "Média";
  return "Baixa";
}

function currency(value) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function capitalize(value) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function buildCalculatedVehicles(items, activeRules) {
  return items
    .map((item) => {
      const normalized = sanitizeVehicleRecord(item);
      if (!normalized) return null;
      return { ...normalized, metrics: calculateMetrics(normalized, activeRules) };
    })
    .filter(Boolean)
    .sort(compareVehiclesByPriority);
}

function compareVehiclesByPriority(a, b) {
  const entradaA = parseDateForSort(a.entrada);
  const entradaB = parseDateForSort(b.entrada);

  return (
    b.metrics.prioridade - a.metrics.prioridade ||
    recommendationRank(b.metrics.recomendacao) - recommendationRank(a.metrics.recomendacao) ||
    b.metrics.diasNoPatio - a.metrics.diasNoPatio ||
    parseNumericValue(b.urgencia) - parseNumericValue(a.urgencia) ||
    entradaA - entradaB ||
    b.metrics.lucroEstimado - a.metrics.lucroEstimado ||
    String(a.placa).localeCompare(String(b.placa), "pt-BR")
  );
}

function parseDateForSort(value) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const ts = new Date(`${raw}T00:00:00`).getTime();
    return Number.isNaN(ts) ? Number.MAX_SAFE_INTEGER : ts;
  }
  const ts = new Date(raw).getTime();
  return Number.isNaN(ts) ? Number.MAX_SAFE_INTEGER : ts;
}

function recommendationRank(value) {
  if (value === "Alta prioridade") return 3;
  if (value === "Execucao rapida") return 2;
  if (value === "Vale a pena") return 1;
  return 0;
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
  if (!raw) return getTodayLocalDateString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return getTodayLocalDateString();
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function sanitizeServices(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(/[;|,]/);
  const unique = new Set(
    list
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  );
  return unique.size > 0 ? [...unique] : ["Mecânica"];
}

function sanitizeVehicleRecord(raw) {
  if (!raw) return null;

  const placa = String(raw.placa || "").toUpperCase().replace(/\s+/g, "").trim();
  const marca = String(raw.marca || "").trim();
  const modelo = String(raw.modelo || "").trim();
  const cor = String(raw.cor || "").trim();
  const clienteNome = String(raw.clienteNome || "").trim();
  if (!placa || !marca || !modelo || !cor || !clienteNome) return null;

  const pecas = Math.max(0, parseNumericValue(raw.pecas));
  const maoObra = Math.max(0, parseNumericValue(raw.maoObra));
  const valorCobradoInformado = parseNumericValue(raw.valorCobrado);
  const valorCobrado = valorCobradoInformado > 0 ? valorCobradoInformado : pecas + maoObra;

  return {
    id: String(raw.id || crypto.randomUUID()),
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
    pecas,
    maoObra,
    custoInterno: Math.max(0, parseNumericValue(raw.custoInterno)),
    valorCobrado,
    quilometragem: Math.max(0, parseNumericValue(raw.quilometragem)),
    estadoFisico: normalizeEstadoFisico(raw.estadoFisico),
    observacoes: String(raw.observacoes || "").trim(),
    photos: Array.isArray(raw.photos) ? raw.photos : [],
    servicos: sanitizeServices(raw.servicos),
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString()
  };
}

function formatCsvNumber(value) {
  return parseNumericValue(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function toCSV(items) {
  // Cabeçalho limpo e organizado em português
  const header = [
    "Placa",
    "Marca",
    "Modelo",
    "Cor",
    "Cliente (Tipo)",
    "Cliente (Nome)",
    "Data de entrada",
    "Status",
    "Urgência (1-5)",
    "Horas Estimadas",
    "Peças (R$)",
    "Mão de obra (R$)",
    "Custo Interno (R$)",
    "Valor cobrado cliente (R$)",
    "Quilometragem",
    "Estado Físico",
    "Observações",
    "Serviços",
    "Dias no Pátio",
    "Lucro Estimado (R$)",
    "Rentabilidade/Hora (R$)",
    "Prioridade",
    "Recomendação"
  ];

  const ordered = buildCalculatedVehicles(items, rules);
  const rows = ordered.map((v) => {
    const metrics = v.metrics;
    return [
      v.placa || "",
      v.marca || "",
      v.modelo || "",
      v.cor || "",
      v.clienteTipo || "Particular",
      v.clienteNome || "",
      formatDateOnly(v.entrada),
      formatStatus(v.status) || "",
      v.urgencia || 0,
      v.horas || 0,
      formatCsvNumber(v.pecas),
      formatCsvNumber(v.maoObra),
      formatCsvNumber(v.custoInterno),
      formatCsvNumber(v.valorCobrado),
      v.quilometragem || 0,
      v.estadoFisico || "Bom",
      v.observacoes || "",
      v.servicos.join("; ") || "",
      metrics.diasNoPatio,
      formatCsvNumber(metrics.lucroEstimado),
      formatCsvNumber(metrics.rentabilidadeHora),
      Math.round(metrics.prioridade),
      formatRecommendation(metrics.recomendacao)
    ];
  });

  return [header, ...rows]
    .map((row) => row.map(escapeCSV).join(";"))
    .join("\n");
}

function toExcelHtml(items) {
  const header = [
    "Ordem",
    "Placa",
    "Marca",
    "Modelo",
    "Cor",
    "Cliente (Tipo)",
    "Cliente (Nome)",
    "Data de entrada",
    "Status",
    "Urgência",
    "Horas estimadas",
    "Peças (R$)",
    "Mão de obra (R$)",
    "Custo interno (R$)",
    "Valor cobrado cliente (R$)",
    "Quilometragem",
    "Estado físico",
    "Observações",
    "Serviços",
    "Dias no pátio",
    "Lucro estimado (R$)",
    "Rentabilidade/hora (R$)",
    "Prioridade",
    "Recomendação"
  ];

  const ordered = buildCalculatedVehicles(items, rules);
  const widths = [
    55, 95, 110, 120, 90, 120, 180, 110, 130, 75, 95,
    110, 130, 130, 160, 105, 100, 220, 180, 100, 130, 140, 95, 160
  ];

  const rows = ordered.map((v, index) => {
    const metrics = v.metrics;
    return [
      index + 1,
      v.placa || "",
      v.marca || "",
      v.modelo || "",
      v.cor || "",
      v.clienteTipo || "Particular",
      v.clienteNome || "",
      formatDateOnly(v.entrada),
      formatStatus(v.status) || "",
      v.urgencia || 0,
      v.horas || 0,
      formatCsvNumber(v.pecas),
      formatCsvNumber(v.maoObra),
      formatCsvNumber(v.custoInterno),
      formatCsvNumber(v.valorCobrado),
      v.quilometragem || 0,
      v.estadoFisico || "Bom",
      v.observacoes || "",
      (v.servicos || []).map((service) => formatServiceName(service)).join("; "),
      metrics.diasNoPatio,
      formatCsvNumber(metrics.lucroEstimado),
      formatCsvNumber(metrics.rentabilidadeHora),
      Math.round(metrics.prioridade),
      formatRecommendation(metrics.recomendacao)
    ];
  });

  const colgroup = widths.map((width) => `<col style="width:${width}px">`).join("");
  const headerHtml = header.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("");
  const bodyHtml = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="UTF-8">
<style>
  table{border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:11pt}
  th,td{border:1px solid #cfcfcf;padding:4px 6px;white-space:nowrap}
  th{background:#f3f6f9;font-weight:700}
</style>
</head>
<body>
  <table>
    <colgroup>${colgroup}</colgroup>
    <thead><tr>${headerHtml}</tr></thead>
    <tbody>${bodyHtml}</tbody>
  </table>
</body>
</html>`;
}

function parseCSV(content) {
  const safeContent = String(content || "").replace(/^\uFEFF/, "");
  const lines = safeContent.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  // Detectar se usa vírgula ou ponto-e-vírgula
  const firstLine = lines[0];
  const separator = firstLine.includes(";") ? ";" : ",";
  
  const header = splitCSVLine(lines[0], separator);
  const idx = Object.fromEntries(header.map((h, i) => [normalizeLookupKey(h), i]));
  const getHeaderIndex = (names) => {
    for (const name of (Array.isArray(names) ? names : [names])) {
      const lookup = normalizeLookupKey(name);
      if (idx[lookup] !== undefined) return idx[lookup];
    }
    return -1;
  };
  const serviceColumnIndex = getHeaderIndex(["serviços", "servicos"]);

  return lines.slice(1).map((line) => {
    const cols = splitCSVLine(line, separator);

    // Corrige planilhas em que a última coluna (Serviços) foi preenchida com ';'
    // sem aspas, gerando colunas extras no final da linha.
    if (serviceColumnIndex >= 0 && cols.length > header.length && serviceColumnIndex === header.length - 1) {
      const mergedServices = cols.slice(serviceColumnIndex).filter(Boolean).join("|");
      cols.splice(serviceColumnIndex, cols.length - serviceColumnIndex, mergedServices);
    }
    
    // Mapear colunas independente do nome exato
    const getCol = (names) => {
      for (const name of (Array.isArray(names) ? names : [names])) {
        const lookup = normalizeLookupKey(name);
        if (idx[lookup] !== undefined) {
          return cols[idx[lookup]] || "";
        }
      }
      return "";
    };

    return sanitizeVehicleRecord({
      id: crypto.randomUUID(),
      placa: (getCol("placa") || "").toUpperCase().trim(),
      marca: getCol("marca").trim(),
      modelo: getCol("modelo").trim(),
      cor: getCol("cor").trim(),
      status: getCol(["status", "situação", "situacao"]) || "Aguardando",
      clienteTipo: getCol(["cliente (tipo)", "tipo cliente", "cliente tipo"]) || "Particular",
      clienteNome: getCol("cliente (nome)").trim(),
      entrada: getCol(["data de entrada", "data entrada", "entrada"]) || getTodayLocalDateString(),
      urgencia: getCol(["urgência (1-5)", "urgência (1-10)", "urgencia", "urgência"]) || 3,
      horas: getCol(["horas estimadas", "horas", "horas estimadas (h)"]) || 1,
      pecas: getCol(["peças (r$)", "pecas (r$)", "peças", "pecas"]) || 0,
      maoObra: getCol(["mão de obra (r$)", "mao de obra (r$)", "mão de obra", "mao de obra"]) || 0,
      custoInterno: getCol(["custo interno (r$)", "custo interno"]) || 0,
      valorCobrado: getCol(["valor cobrado cliente (r$)", "valor cobrado", "valor a cobrar", "preco cobrado", "preço cobrado"]) || 0,
      quilometragem: getCol("quilometragem") || 0,
      estadoFisico: getCol(["estado físico", "estado fisico"]) || "Bom",
      observacoes: getCol(["observações", "observacoes"]).trim(),
      servicos: getCol(["serviços", "servicos"]) || "Mecânica",
      photos: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }).filter(Boolean);
}

function splitCSVLine(line, separator = ",") {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === separator && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function escapeCSV(value) {
  const str = String(value ?? "");
  if (str.includes('"') || str.includes(";") || str.includes(",") || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function downloadFile(filename, content, mimeType = "text/csv;charset=utf-8;") {
  const withBom = `\uFEFF${content}`;
  const blob = new Blob([withBom], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function ensureToastHost() {
  if (toastHost) return;
  toastHost = document.createElement("div");
  toastHost.className = "toast-host";
  document.body.appendChild(toastHost);
}

function setLoadingState(value) {
  isBootstrapping = Boolean(value);
}

function renderSkeletonState() {
  if (tableBody) {
    tableBody.innerHTML = "";
    for (let i = 0; i < 6; i += 1) {
      const row = document.createElement("tr");
      row.className = "table-skeleton-row";
      row.innerHTML = `
        <td><span class="skeleton-line w40"></span></td>
        <td><span class="skeleton-line w160"></span></td>
        <td><span class="skeleton-line w120"></span></td>
        <td><span class="skeleton-line w90"></span></td>
        <td><span class="skeleton-line w140"></span></td>
        <td><span class="skeleton-line w60"></span></td>
        <td><span class="skeleton-line w100"></span></td>
        <td><span class="skeleton-line w100"></span></td>
        <td><span class="skeleton-line w110"></span></td>
        <td><span class="skeleton-line w110"></span></td>
        <td><span class="skeleton-line w80"></span></td>`;
      tableBody.append(row);
    }
  }

  if (emptyState) emptyState.classList.add("hidden");

  if (kanbanBoard) {
    kanbanBoard.innerHTML = "";
    for (let i = 0; i < 4; i += 1) {
      const col = document.createElement("div");
      col.className = "kanban-col";
      col.innerHTML = `
        <div class="kanban-col-header"><span class="skeleton-line w110"></span><span class="skeleton-line w40"></span></div>
        <div class="kanban-skeleton-card"></div>
        <div class="kanban-skeleton-card"></div>
        <div class="kanban-skeleton-card"></div>`;
      kanbanBoard.append(col);
    }
  }

  if (historyList) {
    historyList.innerHTML = "<div class='history-skeleton'></div><div class='history-skeleton'></div><div class='history-skeleton'></div>";
  }
  if (recentHistoryList) {
    recentHistoryList.innerHTML = "<div class='history-skeleton'></div><div class='history-skeleton'></div>";
  }
}

function bindKeyboardShortcuts() {
  window.addEventListener("keydown", (event) => {
    const key = String(event.key || "").toLowerCase();
    const withCtrl = event.ctrlKey || event.metaKey;
    const typing = isTypingTarget(event.target);

    if (key === "escape") {
      if (!detailOverlay.classList.contains("hidden")) {
        closeDetail();
        return;
      }
      if (!sidePanel.classList.contains("hidden")) {
        closePanel();
        return;
      }
      return;
    }

    if (typing) return;

    if (withCtrl && key === "n") {
      event.preventDefault();
      if (session && getPermission().canEdit) {
        resetFormState();
        openPanel(false);
      }
      return;
    }

    if (withCtrl && key === "s") {
      if (activeTab === "regras" && getPermission().canRules) {
        event.preventDefault();
        rulesForm.requestSubmit();
      }
      return;
    }

    if (event.altKey && key === "1") {
      event.preventDefault();
      activeTab = "patio";
      renderTabs();
      return;
    }

    if (event.altKey && key === "2") {
      event.preventDefault();
      activeTab = "kanban";
      renderTabs();
      return;
    }

    if (event.altKey && key === "3") {
      event.preventDefault();
      if (session?.perfil === "admin") {
        activeTab = "usuarios";
        renderTabs();
      }
    }
  });
}

function isTypingTarget(target) {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (target.isContentEditable) return true;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function notify(message, type = "info") {
  ensureToastHost();
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = String(message || "");
  toastHost.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 220);
  }, 2600);
}

function highlightInvalidRequired(formElement) {
  const fields = Array.from(formElement.querySelectorAll("input, select, textarea"));
  fields.forEach((field) => {
    const isInvalid = !field.checkValidity();
    field.classList.toggle("field-invalid", isInvalid);
    if (!isInvalid) field.classList.add("field-valid");
    field.addEventListener("input", () => {
      field.classList.remove("field-invalid");
      if (field.checkValidity()) field.classList.add("field-valid");
    }, { once: true });
  });
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

async function apiFetch(path, options, retryOnAuthFailure = true) {
  try {
    const optionHeaders = options?.headers || {};
    const authHeader = String(path || "").startsWith("/api/") && session?.token
      ? { Authorization: `Bearer ${session.token}` }
      : {};
    const response = await fetch(toApiUrl(path), {
      headers: { "Content-Type": "application/json", ...authHeader, ...optionHeaders },
      ...options
    });

    if (!response.ok) {
      if (
        retryOnAuthFailure &&
        (response.status === 401 || response.status === 403) &&
        shouldTryTokenRefresh(path)
      ) {
        const refreshed = await tryRefreshSession();
        if (refreshed) {
          return apiFetch(path, options, false);
        }
      }

      if ((response.status === 401 || response.status === 403) && session?.token && String(path).startsWith("/api/")) {
        forceLogout();
      }

      if (response.status === 405 && String(path).startsWith("/api/")) {
        return {
          ok: false,
          error: "Erro HTTP 405. Abra o app por http://localhost:3000 (nao use arquivo local ou outra porta sem API).",
          status: response.status
        };
      }

      try {
        const errorPayload = await response.json();
        return { ok: false, ...errorPayload, status: response.status };
      } catch {
        return { ok: false, error: `Erro HTTP ${response.status}`, status: response.status };
      }
    }

    return response.json();
  } catch {
    const endpoint = API_BASE_URL || window.location.origin;
    return { ok: false, error: `Falha de conexão com o servidor. Verifique se a API esta ativa em ${endpoint}.` };
  }
}

function shouldTryTokenRefresh(path) {
  const apiPath = String(path || "");
  if (!session?.refreshToken) return false;
  if (!apiPath.startsWith("/api/")) return false;
  if (apiPath === "/api/auth/login") return false;
  if (apiPath === "/api/auth/refresh") return false;
  if (apiPath === "/api/setup/status") return false;
  if (apiPath === "/api/setup/admin") return false;
  return true;
}

async function tryRefreshSession() {
  if (!session?.refreshToken) return false;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const response = await fetch(toApiUrl("/api/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: session.refreshToken })
      });

      if (!response.ok) return false;

      const payload = await response.json();
      if (!payload?.ok || !payload?.token || !payload?.refreshToken) {
        return false;
      }

      session.token = payload.token;
      session.refreshToken = payload.refreshToken;
      session.lastActivityAt = new Date().toISOString();
      saveJson(STORAGE_KEYS.session, session);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

function resolveApiBaseUrl() {
  if (STATIC_DEMO_MODE) {
    return "";
  }

  if (window.location.protocol === "file:") {
    return "http://localhost:3000";
  }

  const host = window.location.hostname;
  const protocol = window.location.protocol;
  const port = window.location.port;
  const localHost = host === "localhost" || host === "127.0.0.1";

  if (localHost && port && port !== "3000") {
    return `${protocol}//${host}:3000`;
  }

  return "";
}

function isStaticDemoMode() {
  const host = String(window.location.hostname || "").toLowerCase();
  return host.endsWith("github.io");
}

function toApiUrl(path) {
  if (!String(path).startsWith("/api/")) return path;
  return `${API_BASE_URL}${path}`;
}

function isStrongPassword(password) {
  if (String(password).length < 8) return false;
  const upper = /[A-Z]/.test(password);
  const lower = /[a-z]/.test(password);
  const digit = /\d/.test(password);
  const symbol = /[^A-Za-z0-9]/.test(password);
  return upper && lower && digit && symbol;
}

function isSessionExpired(currentSession) {
  const now = Date.now();
  const startedAt = new Date(currentSession.at || 0).getTime();
  const lastActivityAt = new Date(currentSession.lastActivityAt || currentSession.at || 0).getTime();
  return now - startedAt > SESSION_MAX_AGE_MS || now - lastActivityAt > SESSION_IDLE_TIMEOUT_MS;
}

function setupSessionWatchers() {
  ["click", "keydown", "touchstart"].forEach((eventName) => {
    window.addEventListener(eventName, () => {
      touchSessionActivity();
    }, { passive: true });
  });
}

function touchSessionActivity() {
  if (!session) return;
  session.lastActivityAt = new Date().toISOString();
  saveJson(STORAGE_KEYS.session, session);
}

function startSessionCheck() {
  stopSessionCheck();
  sessionCheckInterval = setInterval(() => {
    if (!session) return;
    if (isSessionExpired(session)) {
      alert("Sessão expirada por tempo ou inatividade. Faça login novamente.");
      forceLogout();
    }
  }, 30000);
}

function stopSessionCheck() {
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval);
    sessionCheckInterval = null;
  }
}

function forceLogout() {
  session = null;
  users = [];
  vehicles = [];
  history = [];
  rules = { ...defaultRules };
  localStorage.removeItem(STORAGE_KEYS.session);
  stopSessionCheck();
  applySessionState();
  render();
}

async function refreshUsers() {
  if (session?.perfil !== "admin") {
    users = [];
    return;
  }

  const result = await dataApi.listUsers();
  users = result?.users || [];
}

function renderUsers() {
  if (!usersList) return;
  if (session?.perfil !== "admin") {
    usersList.innerHTML = `<p style="color:var(--muted)">Somente administrador pode visualizar usuários.</p>`;
    return;
  }

  usersList.innerHTML = "";
  if (users.length === 0) {
    usersList.innerHTML = `<p style="color:var(--muted)">Nenhum usuário cadastrado.</p>`;
    return;
  }

  users.forEach((user) => {
    const item = document.createElement("div");
    item.className = "user-row";
    item.innerHTML = `
      <div class="user-info">
        <div class="u-name">${user.fullName}</div>
        <div class="u-role">@${user.username} · ${user.role} · ${user.active ? "✅ Ativo" : "🔒 Bloqueado"}</div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-ghost" style="font-size:.78rem;padding:5px 10px" data-act="pwd">Trocar senha</button>
        <button class="btn btn-ghost" style="font-size:.78rem;padding:5px 10px" data-act="toggle">${user.active ? "Bloquear" : "Reativar"}</button>
      </div>`;

    item.querySelector("[data-act='pwd']").addEventListener("click", async () => {
      const newPassword = prompt(`Nova senha para @${user.username}:`);
      if (!newPassword) return;
      if (!isStrongPassword(newPassword)) { alert("Senha fraca. Use 8+ caracteres com maiúscula, minúscula, número e símbolo."); return; }
      const result = await dataApi.changePassword(user.id, newPassword);
      if (!result?.ok) { alert(result?.error || "Falha ao atualizar senha."); return; }
      alert("Senha atualizada.");
    });

    item.querySelector("[data-act='toggle']").addEventListener("click", async () => {
      const result = await dataApi.toggleUserStatus(user.id, !user.active);
      if (!result?.ok) { alert(result?.error || "Falha ao alterar status."); return; }
      await refreshUsers();
      renderUsers();
    });

    usersList.append(item);
  });
}

function buildInspectionNode(vehicle) {
  const box = document.createElement("div");
  box.className = "vistoria-box";

  const km = document.createElement("div");
  km.textContent = `KM: ${Number(vehicle.quilometragem || 0).toLocaleString("pt-BR")}`;
  box.append(km);

  const state = document.createElement("div");
  state.textContent = `Estado: ${vehicle.estadoFisico || "Bom"}`;
  box.append(state);

  if (vehicle.observacoes) {
    const obs = document.createElement("div");
    obs.textContent = vehicle.observacoes;
    box.append(obs);
  }

  if (vehicle.photos?.length) {
    const photos = document.createElement("div");
    photos.className = "table-photos";

    vehicle.photos.slice(0, 4).forEach((photo, index) => {
      const link = document.createElement("a");
      link.href = photo.url || photo.dataUrl;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.title = photo.name || `Foto ${index + 1}`;

      const img = document.createElement("img");
      img.src = photo.url || photo.dataUrl;
      img.alt = photo.name || `Foto ${index + 1}`;
      link.append(img);
      photos.append(link);
    });

    box.append(photos);
  }

  return box;
}

function renderPhotoPreview() {
  photoPreview.innerHTML = "";
  pendingPhotos.forEach((photo, index) => {
    const item = document.createElement("div");
    item.className = "photo-thumb";

    const image = document.createElement("img");
    image.src = photo.dataUrl || photo.url;
    image.alt = photo.name || `Foto ${index + 1}`;
    item.append(image);
    photoPreview.append(item);
  });
}

async function filesToPayload(fileList) {
  const files = Array.from(fileList || []).slice(0, 8);
  return Promise.all(files.map(fileToPayload));
}

function fileToPayload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        name: file.name,
        type: file.type,
        dataUrl: String(reader.result)
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function startEditVehicle(vehicle) {
  editingVehicleId = vehicle.id;
  form.elements.placa.value = vehicle.placa;
  form.elements.status.value = vehicle.status;
  form.elements.marca.value = vehicle.marca;
  form.elements.modelo.value = vehicle.modelo;
  form.elements.cor.value = vehicle.cor;
  form.elements.clienteTipo.value = vehicle.clienteTipo;
  form.elements.clienteNome.value = vehicle.clienteNome;
  form.elements.entrada.value = vehicle.entrada;
  form.elements.urgencia.value = vehicle.urgencia;
  form.elements.horas.value = vehicle.horas;
  form.elements.pecas.value = vehicle.pecas;
  form.elements.maoObra.value = vehicle.maoObra;
  form.elements.custoInterno.value = vehicle.custoInterno;
  form.elements.valorCobrado.value = vehicle.valorCobrado || (Number(vehicle.pecas || 0) + Number(vehicle.maoObra || 0));
  form.elements.quilometragem.value = vehicle.quilometragem || 0;
  form.elements.estadoFisico.value = vehicle.estadoFisico || "Bom";
  form.elements.observacoes.value = vehicle.observacoes || "";

  const serviceInputs = Array.from(form.querySelectorAll("input[name='servico']"));
  serviceInputs.forEach((input) => {
    input.checked = vehicle.servicos.includes(input.value);
  });

  pendingPhotos = [];
  renderPhotoPreview();
  updateLucroPreview();
  openPanel(true);
}

function openDetail(vehicle) {
  detailVehicle = vehicle;
  detailTitle.textContent = `${vehicle.marca} ${vehicle.modelo} — ${vehicle.placa}`;
  detailMeta.innerHTML = "";
  const metrics = vehicle.metrics || calculateMetrics(vehicle, rules);

  const metaFields = [
    ["Placa", vehicle.placa],
    ["Veículo", `${vehicle.marca} ${vehicle.modelo} ${vehicle.cor}`],
    ["Cliente", `${vehicle.clienteTipo} / ${vehicle.clienteNome}`],
    ["Status", formatStatus(vehicle.status)],
    ["Entrada", vehicle.entrada],
    ["Quilometragem", `${Number(vehicle.quilometragem || 0).toLocaleString("pt-BR")} km`],
    ["Estado físico", vehicle.estadoFisico || "Bom"],
    ["Urgência", vehicle.urgencia],
    ["Horas estim.", vehicle.horas],
    ["Peças", currency(vehicle.pecas)],
    ["Mão de obra", currency(vehicle.maoObra)],
    ["Custo interno", currency(vehicle.custoInterno)],
    ["Valor cobrado cliente", currency(vehicle.valorCobrado || (Number(vehicle.pecas || 0) + Number(vehicle.maoObra || 0)))],
    ["Custo operacional", currency(metrics.custoOperacional || 0)],
    ["Meta lucro (50%)", currency(metrics.lucroMinimo50 || 0)],
    ["Valor mínimo recomendado", currency(metrics.valorMinimoCobrado || 0)],
    ["Margem projetada", `${((metrics.margemSobreCusto || 0) * 100).toFixed(1)}%`],
    ["Lucro estimado", currency(metrics.lucroEstimado || 0)],
    ["Serviços", (vehicle.servicos || []).join(", ")],
    ["Observações", vehicle.observacoes || "—"]
  ];

  metaFields.forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "meta-item";
    item.innerHTML = `<div class="mi-label">${label}</div><div class="mi-val">${value}</div>`;
    detailMeta.append(item);
  });

  detailGallery.innerHTML = "";
  if (!vehicle.photos?.length) {
    detailGallery.innerHTML = `<p style="color:var(--muted);font-size:.83rem;padding:0 20px">Sem fotos cadastradas.</p>`;
  } else {
    vehicle.photos.forEach((photo, index) => {
      const link = document.createElement("a");
      link.href = photo.url || photo.dataUrl;
      link.target = "_blank";
      link.rel = "noreferrer";
      const image = document.createElement("img");
      image.src = photo.url || photo.dataUrl;
      image.alt = photo.name || `Foto ${index + 1}`;
      image.style.cssText = "width:100%;height:80px;object-fit:cover;border-radius:8px;border:1px solid var(--border)";
      link.append(image);
      detailGallery.append(link);
    });
  }

  clearSignature();
  detailOverlay.classList.remove("hidden");
  if (detailPanelOverlay) detailPanelOverlay.classList.remove("hidden");
}

function closeDetail() {
  detailOverlay.classList.add("hidden");
  if (detailPanelOverlay) detailPanelOverlay.classList.add("hidden");
  detailVehicle = null;
}

function setupSignatureCanvas() {
  const ctx = signatureCanvas.getContext("2d");
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#0b2736";

  const start = (x, y) => {
    signState.drawing = true;
    signState.hasStroke = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (x, y) => {
    if (!signState.drawing) return;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stop = () => {
    signState.drawing = false;
  };

  signatureCanvas.addEventListener("mousedown", (event) => {
    start(event.offsetX, event.offsetY);
  });
  signatureCanvas.addEventListener("mousemove", (event) => {
    draw(event.offsetX, event.offsetY);
  });
  signatureCanvas.addEventListener("mouseup", stop);
  signatureCanvas.addEventListener("mouseleave", stop);

  signatureCanvas.addEventListener("touchstart", (event) => {
    const p = getTouchPos(event);
    start(p.x, p.y);
    event.preventDefault();
  }, { passive: false });
  signatureCanvas.addEventListener("touchmove", (event) => {
    const p = getTouchPos(event);
    draw(p.x, p.y);
    event.preventDefault();
  }, { passive: false });
  signatureCanvas.addEventListener("touchend", stop);
}

function getTouchPos(event) {
  const rect = signatureCanvas.getBoundingClientRect();
  const touch = event.touches[0] || event.changedTouches[0];
  const x = ((touch.clientX - rect.left) / rect.width) * signatureCanvas.width;
  const y = ((touch.clientY - rect.top) / rect.height) * signatureCanvas.height;
  return { x, y };
}

function clearSignature() {
  const ctx = signatureCanvas.getContext("2d");
  ctx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
  signState.hasStroke = false;
}

function generateInspectionPdf(vehicle) {
  const signatureData = signState.hasStroke ? signatureCanvas.toDataURL("image/png") : "";
  const photosHtml = (vehicle.photos || [])
    .map((photo) => `<img src="${photo.url || photo.dataUrl}" style="width:170px;height:120px;object-fit:cover;margin:4px;border:1px solid #ccc;border-radius:8px;"/>`)
    .join("");

  const html = `
  <html>
    <head>
      <meta charset="UTF-8" />
      <title>Vistoria ${vehicle.placa}</title>
    </head>
    <body style="font-family: Arial, sans-serif; padding: 14px; color: #111;">
      <h2>Relatório de Vistoria - ${vehicle.placa}</h2>
      <p><strong>Veículo:</strong> ${vehicle.marca} ${vehicle.modelo} - ${vehicle.cor}</p>
      <p><strong>Cliente:</strong> ${vehicle.clienteTipo} / ${vehicle.clienteNome}</p>
      <p><strong>Entrada:</strong> ${vehicle.entrada}</p>
      <p><strong>KM:</strong> ${Number(vehicle.quilometragem || 0).toLocaleString("pt-BR")}</p>
      <p><strong>Estado:</strong> ${vehicle.estadoFisico || "Bom"}</p>
      <p><strong>Observações:</strong> ${vehicle.observacoes || "Sem observações"}</p>
      <hr />
      <h3>Fotos</h3>
      <div>${photosHtml || "Sem fotos cadastradas."}</div>
      <hr />
      <h3>Assinatura</h3>
      ${signatureData ? `<img src="${signatureData}" style="width:340px;border:1px solid #ccc;background:#fff;"/>` : "Assinatura não informada"}
      <p style="margin-top: 20px; color:#555;">Gerado em ${new Date().toLocaleString("pt-BR")}</p>
      <script>
        window.onload = () => { window.print(); };
      </script>
    </body>
  </html>`;

  const win = window.open("", "_blank");
  win.document.open();
  win.document.write(html);
  win.document.close();
}
