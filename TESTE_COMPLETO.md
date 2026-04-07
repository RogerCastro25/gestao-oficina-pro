# 🧪 TESTE COMPLETO - Cenários Práticos

Este documento descreve testes que você pode executar para validar todas as funcionalidades.

---

## 🎯 PRÉ-SITUAÇÃO

1. **Terminal 1**: Rode `npm start` para iniciar servidor
2. **Terminal 2**: Use PowerShell para fazer requisições HTTP
3. **Navegador**: Abra http://localhost:3000

---

## ✅ TESTE 1: Setup Inicial

### 1.1 Verificar se precisa setup

```powershell
$url = "http://localhost:3000/api/setup/status"
$response = Invoke-WebRequest -Uri $url -Method GET
$response.Content | ConvertFrom-Json
# Esperado: { "needsSetup": true } na primeira vez
```

### 1.2 Criar admin inicial

```powershell
$body = @{
  username = "admin"
  fullName = "João Admin"
  password = "Admin@123456"
} | ConvertTo-Json

$url = "http://localhost:3000/api/setup/admin"
$response = Invoke-WebRequest -Uri $url -Method POST -ContentType "application/json" -Body $body
$response.Content | ConvertFrom-Json
# Esperado: { "ok": true }
```

### 1.3 Verificar se setup foi concluído

```powershell
$url = "http://localhost:3000/api/setup/status"
$response = Invoke-WebRequest -Uri $url -Method GET
$response.Content | ConvertFrom-Json
# Esperado: { "needsSetup": false }
```

### ✅ TESTE 1 PASSOU: Se conseguiu criar admin e login funciona ✓

---

## ✅ TESTE 2: Autenticação

### 2.1 Login com credenciais corretas

```powershell
$body = @{
  usuario = "admin"
  senha = "Admin@123456"
} | ConvertTo-Json

$url = "http://localhost:3000/api/auth/login"
$response = Invoke-WebRequest -Uri $url -Method POST -ContentType "application/json" -Body $body
$response.Content | ConvertFrom-Json
# Esperado: { "ok": true, "nome": "João Admin", "perfil": "admin" }
```

### 2.2 Login com senha errada

```powershell
$body = @{
  usuario = "admin"
  senha = "ErradA@123456"
} | ConvertTo-Json

$url = "http://localhost:3000/api/auth/login"
$response = Invoke-WebRequest -Uri $url -Method POST -ContentType "application/json" -Body $body -ErrorAction SilentlyContinue
# Esperado HTTP 401: { "ok": false }
```

### 2.3 Login com usuário inexistente

```powershell
$body = @{
  usuario = "naoexiste"
  senha = "Admin@123456"
} | ConvertTo-Json

$url = "http://localhost:3000/api/auth/login"
$response = Invoke-WebRequest -Uri $url -Method POST -ContentType "application/json" -Body $body
$response.Content | ConvertFrom-Json
# Esperado: { "ok": false }
```

### ✅ TESTE 2 PASSOU: Se login/erro funcionam como esperado ✓

---

## ✅ TESTE 3: Gestão de Usuários

### 3.1 Criar novo usuário (como admin)

```powershell
$body = @{
  username = "maria.atendente"
  fullName = "Maria Silva"
  role = "atendente"
  password = "Senha@654321"
  actorName = "João Admin"
  actorRole = "admin"
} | ConvertTo-Json

$url = "http://localhost:3000/api/users"
$response = Invoke-WebRequest -Uri $url -Method POST `
  -ContentType "application/json" `
  -Body $body `
  -Headers @{ "x-actor-role" = "admin"; "x-actor-name" = "João Admin" }
  
$response.Content | ConvertFrom-Json
# Esperado: { "ok": true }
```

### 3.2 Listar usuários

```powershell
$url = "http://localhost:3000/api/users"
$response = Invoke-WebRequest -Uri $url -Method GET `
  -Headers @{ "x-actor-role" = "admin"; "x-actor-name" = "João Admin" }
  
($response.Content | ConvertFrom-Json).users | Format-Table
# Esperado: lista com admin + maria.atendente
```

### 3.3 Tentar criar usuário sem ser admin

```powershell
$body = @{
  username = "nao.permitido"
  fullName = "Teste"
  role = "atendente"
  password = "Senha@123456"
  actorName = "Maria"
  actorRole = "atendente"
} | ConvertTo-Json

$url = "http://localhost:3000/api/users"
$response = Invoke-WebRequest -Uri $url -Method POST `
  -ContentType "application/json" `
  -Body $body `
  -Headers @{ "x-actor-role" = "atendente"; "x-actor-name" = "Maria" } `
  -ErrorAction SilentlyContinue
  
# Esperado HTTP 403: { "ok": false, "error": "Somente administrador..." }
```

### ✅ TESTE 3 PASSOU: Se gestão de usuários funciona com permissões corretas ✓

---

## ✅ TESTE 4: Cadastro de Veículos

### 4.1 Adicionar novo veículo

```powershell
$body = @{
  item = @{
    id = "test-001"
    placa = "ABC1234"
    marca = "Ford"
    modelo = "Fiesta"
    cor = "Branco"
    status = "Aguardando"
    clienteTipo = "Particular"
    clienteNome = "João da Silva"
    entrada = "2026-04-01"
    urgencia = 3
    horas = 2.5
    pecas = 500
    maoObra = 1200
    custoInterno = 300
    valorCobrado = 1700
    quilometragem = 125000
    estadoFisico = "Bom"
    observacoes = "Revisão completa"
    servicos = @("Mecânica", "Suspensão")
    photos = @()
  }
  actor = "João Admin"
} | ConvertTo-Json -Depth 10

$url = "http://localhost:3000/api/vehicles"
$response = Invoke-WebRequest -Uri $url -Method POST `
  -ContentType "application/json" `
  -Body $body
  
$response.Content | ConvertFrom-Json
# Esperado: { "ok": true }
```

### 4.2 Verificar bootstrap com dados

```powershell
$url = "http://localhost:3000/api/bootstrap"
$response = Invoke-WebRequest -Uri $url -Method GET
$data = $response.Content | ConvertFrom-Json
Write-Host "Total de veículos: $($data.vehicles.Count)"
Write-Host "Total de histórico: $($data.history.Count)"
# Esperado: 1 veículo, múltiplos históricos (setup, cadastro)
```

### ✅ TESTE 4 PASSOU: Se cadastro e bootstrap funcionam ✓

---

## ✅ TESTE 5: Edição e Exclusão

### 5.1 Editar veículo existente

```powershell
$body = @{
  item = @{
    id = "test-001"
    placa = "ABC1234"
    marca = "Ford"
    modelo = "Ka"  # ← Mudou de Fiesta
    cor = "Vermelho"  # ← Mudou de Branco
    status = "Em andamento"  # ← Mudou status
    clienteTipo = "Particular"
    clienteNome = "João da Silva"
    entrada = "2026-04-01"
    urgencia = 5  # ← Mais urgente agora
    horas = 1.5  # ← Menos tempo
    pecas = 400
    maoObra = 800
    custoInterno = 250
    valorCobrado = 1200
    quilometragem = 125000
    estadoFisico = "Regular"  # ← Mudou
    observacoes = "Revisão completa - Editado"
    servicos = @("Mecânica")
    photos = @()
  }
  actor = "João Admin"
} | ConvertTo-Json -Depth 10

$url = "http://localhost:3000/api/vehicles/test-001"
$response = Invoke-WebRequest -Uri $url -Method PUT `
  -ContentType "application/json" `
  -Body $body
  
$response.Content | ConvertFrom-Json
# Esperado: { "ok": true }
```

### 5.2 Verificar alteração

```powershell
$url = "http://localhost:3000/api/bootstrap"
$response = Invoke-WebRequest -Uri $url -Method GET
$vehicle = ($response.Content | ConvertFrom-Json).vehicles[0]
Write-Host "Modelo: $($vehicle.modelo)"
Write-Host "Status: $($vehicle.status)"
Write-Host "Urgência: $($vehicle.urgencia)"
# Esperado: Ka, Em andamento, 5
```

### 5.3 Alterar status

```powershell
$body = @{
  status = "Finalizacao"
  actor = "João Admin"
} | ConvertTo-Json

$url = "http://localhost:3000/api/vehicles/test-001/status"
$response = Invoke-WebRequest -Uri $url -Method PATCH `
  -ContentType "application/json" `
  -Body $body
  
$response.Content | ConvertFrom-Json
# Esperado: { "ok": true }
```

### 5.4 Excluir veículo

```powershell
$body = @{
  actor = "João Admin"
} | ConvertTo-Json

$url = "http://localhost:3000/api/vehicles/test-001"
$response = Invoke-WebRequest -Uri $url -Method DELETE `
  -ContentType "application/json" `
  -Body $body
  
$response.Content | ConvertFrom-Json
# Esperado: { "ok": true }
```

### ✅ TESTE 5 PASSOU: Se CRUD de veículos funciona ✓

---

## ✅ TESTE 6: Importação CSV

### 6.1 Criar arquivo CSV de teste

```powershell
$csv = @"
Placa;Marca;Modelo;Cor;Cliente (Tipo);Cliente (Nome);Data Entrada;Status;Urgência (1-10);Horas Estimadas;Peças (R$);Mão de Obra (R$);Custo Interno (R$);Quilometragem;Estado Físico;Observações;Serviços
ABC-1111;Fiat;Uno;Prata;Particular;Pedro Costa;2026-04-01;Aguardando;3;1.5;200,00;600,00;150,00;95000;Bom;Revisão básica;Mecânica
XYZ-9999;Honda;Civic;Preto;Seguradora;Seguros Brasil;2026-03-28;Em andamento;8;6;1500,00;3000,00;800,00;185000;Regular;Batida frontal;Funilaria; Pintura
"@

$csv | Out-File -FilePath "teste-import.csv" -Encoding UTF8
"Arquivo criado: teste-import.csv"
```

### 6.2 Fazer import

```powershell
$csvContent = Get-Content "teste-import.csv" -Raw
$body = @{
  items = @(
    @{
      placa = "ABC-1111"
      marca = "Fiat"
      modelo = "Uno"
      cor = "Prata"
      clienteTipo = "Particular"
      clienteNome = "Pedro Costa"
      entrada = "2026-04-01"
      status = "Aguardando"
      urgencia = 3
      horas = 1.5
      pecas = 200
      maoObra = 600
      custoInterno = 150
      valorCobrado = 800
      quilometragem = 95000
      estadoFisico = "Bom"
      observacoes = "Revisão básica"
      servicos = @("Mecânica")
    },
    @{
      placa = "XYZ-9999"
      marca = "Honda"
      modelo = "Civic"
      cor = "Preto"
      clienteTipo = "Seguradora"
      clienteNome = "Seguros Brasil"
      entrada = "2026-03-28"
      status = "Em andamento"
      urgencia = 8
      horas = 6
      pecas = 1500
      maoObra = 3000
      custoInterno = 800
      valorCobrado = 4500
      quilometragem = 185000
      estadoFisico = "Regular"
      observacoes = "Batida frontal"
      servicos = @("Funilaria", "Pintura")
    }
  )
  actor = "João Admin"
} | ConvertTo-Json -Depth 10

$url = "http://localhost:3000/api/vehicles/import"
$response = Invoke-WebRequest -Uri $url -Method POST `
  -ContentType "application/json" `
  -Body $body
  
$response.Content | ConvertFrom-Json
# Esperado: { "ok": true }
```

### 6.3 Verificar import

```powershell
$url = "http://localhost:3000/api/bootstrap"
$response = Invoke-WebRequest -Uri $url -Method GET
$vehicles = ($response.Content | ConvertFrom-Json).vehicles
Write-Host "Total após import: $($vehicles.Count)"
$vehicles | Select-Object placa, marca, cliente_nome | Format-Table
# Esperado: 2 veículos importados
```

### ✅ TESTE 6 PASSOU: Se importação CSV funciona ✓

---

## ✅ TESTE 7: Regras de Priorização

### 7.1 Recuperar regras atuais

```powershell
$url = "http://localhost:3000/api/bootstrap"
$response = Invoke-WebRequest -Uri $url -Method GET
$rules = ($response.Content | ConvertFrom-Json).rules
$rules | ConvertTo-Json
# Esperado: 13 parâmetros de priorização
```

### 7.2 Alterar regras

```powershell
$newRules = @{
  pesoDias = 3  # Aumentar peso dos dias
  pesoUrgencia = 5
  bonusRapido = 10
  penalidadePecas = -8
  limiteRapidoHoras = 4  # Reduzir limite rápido
  rentabRapida = 150
  diasAlta = 10  # Reduzir dias para alta prioridade
  horasNaoVale = 12
  rentabNaoVale = 50
  margemMinimaSobreCusto = 0.55
  custoHoraTecnicaBase = 25
  custoDiaPatioBase = 20
} | ConvertTo-Json

$body = @{
  rules = $newRules
  actor = "João Admin"
}

$url = "http://localhost:3000/api/rules"
$response = Invoke-WebRequest -Uri $url -Method PUT `
  -ContentType "application/json" `
  -Body ($body | ConvertTo-Json -Depth 10)
  
$response.Content | ConvertFrom-Json
# Esperado: { "ok": true }
```

### ✅ TESTE 7 PASSOU: Se gestão de regras funciona ✓

---

## ✅ TESTE 8: Histórico de Eventos

### 8.1 Recuperar histórico

```powershell
$url = "http://localhost:3000/api/bootstrap"
$response = Invoke-WebRequest -Uri $url -Method GET
$history = ($response.Content | ConvertFrom-Json).history
Write-Host "Total de eventos: $($history.Count)"
$history | Select-Object tipo, descricao, por | Sort-Object -Property @{Expression = {$_.created_at}; Descending = $true} | Select-Object -First 10 | Format-Table
# Esperado: Lista de eventos (setup, logins, cadastros, edições, imports, etc)
```

### ✅ TESTE 8 PASSOU: Se histórico funciona ✓

---

## ✅ TESTE 9: Validações

### 9.1 Tentar criar veículo sem placa

```powershell
$body = @{
  item = @{
    id = "test-fail-1"
    placa = ""  # ← VAZIO
    marca = "Ford"
    modelo = "Fiesta"
    cor = "Branco"
    status = "Aguardando"
    clienteTipo = "Particular"
    clienteNome = "João"
    entrada = "2026-04-01"
    urgencia = 3
    horas = 2
    pecas = 0
    maoObra = 0
    custoInterno = 0
    valorCobrado = 0
  }
  actor = "João Admin"
} | ConvertTo-Json -Depth 10

$url = "http://localhost:3000/api/vehicles"
$response = Invoke-WebRequest -Uri $url -Method POST `
  -ContentType "application/json" `
  -Body $body `
  -ErrorAction SilentlyContinue
  
# Esperado HTTP 400: { "error": "Dados do veículo inválidos." }
$response.StatusCode
```

### 9.2 Tentar criar usuário com senha fraca

```powershell
$body = @{
  username = "usuario.teste"
  fullName = "User Teste"
  role = "atendente"
  password = "123"  # ← FRACA
  actorName = "João Admin"
  actorRole = "admin"
} | ConvertTo-Json

$url = "http://localhost:3000/api/users"
$response = Invoke-WebRequest -Uri $url -Method POST `
  -ContentType "application/json" `
  -Body $body `
  -Headers @{ "x-actor-role" = "admin"; "x-actor-name" = "João Admin" } `
  -ErrorAction SilentlyContinue
  
# Esperado HTTP 400: error sobre senha fraca
$response.StatusCode
```

### ✅ TESTE 9 PASSOU: Se validações funcionam ✓

---

## ✅ TESTE 10: Teste de Interface (Navegador)

1. Abra http://localhost:3000 em navegador
2. Faça login com `admin` / `Admin@123456`

### Validar Pátio:
- [ ] Tabela visível com veículos importados
- [ ] KPIs no topo mostram totais corretos
- [ ] Filtros funcionam (tipo cliente, recomendação)
- [ ] Cálculo de prioridade visível nos badges
- [ ] Clique em "Novo Serviço" abre painel lateral
- [ ] Edição de veículo preenche dados corretamente

### Validar Kanban:
- [ ] 4 colunas visíveis
- [ ] Veículos distribuídos corretamente por status
- [ ] Clique em card abre detalhes do veículo

### Validar Usuários (Admin only):
- [ ] Aba "Usuários" visível
- [ ] Lista com admin + maria.atendente
- [ ] Botão "Trocar senha" funciona
- [ ] Botão "Bloquear" funciona

### Validar Logout:
- [ ] Botão "Sair" no topo
- [ ] Retorna à tela de login
- [ ] Próximo login pede credenciais novamente

### ✅ TESTE 10 PASSOU: Se interface no navegador funciona ✓

---

## 🎯 RESULTADO FINAL

Se todos os 10 testes passaram, sua aplicação está:

- ✅ **Funcionalmente completa**
- ✅ **Segura em nível básico**
- ✅ **Pronta para uso local/pequeno time**
- ⚠️ **Ainda precisa melhorias para produção** (veja MELHORIAS_PRIORITARIAS.md)

---

## 📝 CHECKLIST DE TESTES

```
TESTE 1 - Setup Inicial:         [ ]
TESTE 2 - Autenticação:          [ ]
TESTE 3 - Gestão Usuários:       [ ]
TESTE 4 - Cadastro Veículos:     [ ]
TESTE 5 - Edição/Exclusão:       [ ]
TESTE 6 - Importação CSV:        [ ]
TESTE 7 - Regras:                [ ]
TESTE 8 - Histórico:             [ ]
TESTE 9 - Validações:            [ ]
TESTE 10 - Interface:            [ ]

RESULTADO: ___/10 TESTES PASSARAM ✓
```

