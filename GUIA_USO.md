# 📋 Guia de Uso - Gestão de Oficina Pro

## 🚀 Iniciando o App

1. **Abra o terminal** no diretório da aplicação
2. **Execute**: `npm start`
3. **Acesse no navegador**: `http://localhost:3000`

---

## 🔐 Primeiro Acesso (Setup)

Na primeira vez, você verá a tela: **"Nenhum usuário encontrado. Crie o administrador inicial."**

Preencha:
- **Usuário administrador**: `admin` (ou outro nome)
- **Nome completo**: `João Silva`
- **Senha forte**: `Senha@123` (mín. 8 caracteres: MAIÚSCULA, minúscula, número, símbolo)

Clique em **"Criar administrador"** → **Faça login** ✅

---

## 👤 Login

- **Usuário**: `admin`
- **Senha**: `Senha@123` (a que você criou)

---

## 📊 Funcionalidades Principais

### 1️⃣ **Tabela de Veículos**
- Visualizar todos os veículos cadastrados
- Ordenados por **prioridade automática** (dias no pátio + urgência + rentabilidade)
- Filtrar por **tipo de cliente** ou **recomendação**

### 2️⃣ **Cadastrar Novo Veículo**
Clique em **"+ Novo Veículo"** e preencha:
- **Placa**: ABC-1234
- **Marca/Modelo/Cor**: Ford Fiesta Branco
- **Cliente**: Particular / João da Silva
- **Data de entrada**: (automática - hoje)
- **Urgência**: 1-5 (quanto maior, mais urgente)
- **Horas estimadas**: 2
- **Peças (R$)**: 500
- **Mão de Obra (R$)**: 800
- **Custo Interno (R$)**: 300
- **Serviços**: Marque os que se aplicam

Clique em **"Salvar veículo"** ✅

### 3️⃣ **Kanban (Acompanhamento)**
Visualize veículos por status:
- **Aguardando**: Não iniciado
- **Em andamento**: Sendo trabalhado
- **Aguardando peças**: Parado esperando peças
- **Finalização**: Pronto para sair

### 4️⃣ **Histórico**
Registro de **todas as ações** no sistema:
- Cadastros
- Edições
- Exclusões
- Logins
- Alterações de status

### 5️⃣ **Exportar CSV**
Clique em **"📥 Exportar"**
- Gera arquivo `.csv` com todos os veículos
- **Separador**: `;` (ponto-e-vírgula)
- **Formato**: pronto para Excel
- **Valores**: formatados em reais

### 6️⃣ **Importar CSV**
Clique em **"📤 Importar"**
- Selecione um arquivo `.csv` com veículos
- Detecta automaticamente separador (`,` ou `;`)
- **Atenção**: Substitui TODOS os registros atuais!

### 7️⃣ **Gestão de Usuários** (Apenas Admin)
Aba **"Usuários"** permite:
- Listar todos os usuários
- Criar novo usuário
- Definir rol (admin / atendente / financeiro)
- Bloquear/desbloquear acesso
- Alterar senha

### 8️⃣ **Regras de Prioridade** (Apenas Admin)
Aba **"Regras"** - Customize como o sistema calcula prioridade:
- **Peso Dias**: quanto cada dia no pátio influencia (padrão: 2.4)
- **Peso Urgência**: importância do campo urgência (padrão: 7)
- **Bônus Rápido**: pontos extras para serviços rápidos (padrão: 8)
- E muitas outras...

---

## 🔑 Permissões por Rol

| Ação | Admin | Atendente | Financeiro |
|------|-------|-----------|-----------|
| Visualizar tabela | ✅ | ✅ | ✅ |
| Cadastrar veículo | ✅ | ✅ | ❌ |
| Editar veículo | ✅ | ✅ | ❌ |
| Deletar veículo | ✅ | ❌ | ❌ |
| Mudar status | ✅ | ✅ | ❌ |
| Alterar regras | ✅ | ❌ | ❌ |
| Gerenciar usuários | ✅ | ❌ | ❌ |
| Exportar/Importar | ✅ | ✅ | ✅ |

---

## 📥 Exemplo de CSV para Importação

```
Placa;Marca;Modelo;Cor;Cliente (Tipo);Cliente (Nome);Data Entrada;Status;Urgência (1-5);Horas Estimadas;Peças (R$);Mão de Obra (R$);Custo Interno (R$);Quilometragem;Estado Físico;Observações;Serviços
ABC-1234;Ford;Fiesta;Branco;Particular;João Silva;2026-04-01;Aguardando;5;2;500,00;800,00;300,00;120000;Bom;Cliente pagou adiantado;Funilaria|Pintura
XYZ-5678;Chevrolet;Onix;Prata;Empresa;Auto Service;2026-04-02;Em andamento;5;6;1200,00;1500,00;600,00;80000;Bom;Urgente;Mecânica
```

**Pontos importantes:**
- Separador: `;` (ponto-e-vírgula)
- Valores em reais: Use `,` como separador decimal
- Servicos: Use `|` para separar (ex.: `Funilaria|Pintura`)
- Data: Formato YYYY-MM-DD (2026-04-01)

---

## 🔄 Status dos Veículos

1. **Aguardando** → Ordem recebida, aguardando início
2. **Em andamento** → Mecânico está trabalhando
3. **Aguardando peças** → Parado esperando peça chegar
4. **Finalização** → Serviço terminado, ajustes finais

---

## 📈 Métricas Automáticas

O app calcula automaticamente:
- **Dias no pátio**: Quantos dias está na oficina
- **Prioridade**: Score de 0-100 (maior = mais urgente)
- **Lucro estimado**: Peças + Mão de Obra - Custo Interno
- **Rentabilidade/hora**: Quanto você ganha por hora de trabalho
- **Recomendação**:
  - 🔴 **Não vale a pena**: Baixa rentabilidade ou muito tempo
  - 🟡 **Alta prioridade**: Muito tempo no pátio ou urgência alta
  - 🟢 **Execução rápida**: Serviço rápido e lucrativo
  - 🟢 **Vale a pena**: Bom balanço geral

---

## 🛠️ Troubleshooting

### "Falha de conexão com o servidor"
- [ ] Verifique se `npm start` está rodando
- [ ] Acesse http://localhost:3000
- [ ] Reinicie o servidor

### "CSV inválido"
- [ ] Verifique se tem cabeçalho
- [ ] Use separador `;` (ponto-e-vírgula)
- [ ] Não deixe colunas vazias (use espaço em branco)

### "Usuário ou senha inválidos"
- [ ] Verifique se capslock está desativado
- [ ] O usuário é case-insensitive (admin = ADMIN = Admin)
- [ ] A senha é case-sensitive

---

## 📞 Suporte

Para problemas ou sugestões, abra o console do navegador (F12) e procure por erros.

**Bom uso!** 🎯
