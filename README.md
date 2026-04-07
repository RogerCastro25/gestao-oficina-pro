# 📋 Gestão de Oficina Pro

Aplicação web completa para gestão de oficina com frontend moderno e backend local em Node + SQLite. Otimizada para calcular automaticamente prioridades, rentabilidade e recomendações.

---

## ✨ Funcionalidades Principais

### 📊 Dashboard Inteligente
- KPIs em tempo real (total, alta prioridade, rápidos, rentáveis)
- Cálculo automático de prioridade baseado em dias no pátio + urgência + rentabilidade
- Recomendações inteligentes:
  - 🔴 **Não vale a pena**: Baixa rentabilidade ou muito tempo parado
  - 🟡 **Alta prioridade**: Muito tempo no pátio ou urgência alta
  - 🟢 **Execução rápida**: Serviço rápido e bem remunerado
  - 🟢 **Vale a pena**: Bom balanço geral

### 🗂️ Gestão de Veículos
- Cadastro completo: placa, marca, modelo, cor, cliente, datas, urgência, custos
- Edição e exclusão com controle de permissões
- Vistoria com quilometragem, estado físico, observações e fotos
- Galeria de fotos por veículo com upload e visualização
- Documento de vistoria com assinatura digital

### 📋 Acompanhamento
- **Tabela**: Visualizar todos os veículos com ordenação inteligente
- **Kanban**: Acompanhar por status (Aguardando, Em andamento, Aguardando peças, Finalização)
- **Histórico**: Log completo de todas as ações do sistema
- **Filtros**: Por tipo de cliente ou tipo de recomendação

### 💾 Dados
- Exportação CSV limpa e organizada (separador `;` para Excel português)
- Importação automática com mapeamento de colunas flexível
- Persistência em SQLite local (arquivo em `data/oficina.db`)
- Fallback para localStorage se backend cair

### 🔐 Segurança
- Login com autenticação real (sal + PBKDF2)
- Senha forte obrigatória (8+ caracteres: maiúscula, minúscula, número, símbolo)
- 3 perfis de acesso:
  - **Admin**: controle total
  - **Atendente**: cadastra e altera status
  - **Financeiro**: consulta e análise
- Gestão de usuários (criar, bloquear, alterar senha)
- Auditoria completa de ações (logins, mudanças, exclusões)
- Expiração automática de sessão (tempo total + inatividade)

### ⚙️ Configuração
- Regras de priorização personalizáveis por admin
- Ajuste de pesos de dias, urgência, bônus de rapidez, etc.
- Histórico de eventos para rastreamento total

## 🚀 Como Usar

### Instalação
```bash
cd "e:\app gestão de oficina"
npm install
npm start
```

### Primeiro Acesso
1. Abra **http://localhost:3000** no navegador
2. Você verá: "Nenhum usuário encontrado. Crie o administrador inicial."
3. Preencha:
   - **Usuário administrador**: `admin`
   - **Nome completo**: Seu nome
   - **Senha forte**: Ex. `Senha@123` (8+ caracteres)
4. Clique em **"Criar administrador"**
5. Faça login com as credenciais criadas ✅

### Acessar de Outro Dispositivo
- Descubra o IP do PC: `ipconfig` (procure "IPv4 Address")
- Acesse: `http://seu-ip-aqui:3000` (mesmo Wi-Fi)

---

## 📥 Como Importar CSV

### Arquivo de Exemplo
Veja `exemplo-veiculos.csv` na pasta do projeto.

### Formato Esperado
```
Placa;Marca;Modelo;Cor;Cliente (Tipo);Cliente (Nome);Data Entrada;Status;Urgência (1-5);Horas Estimadas;Peças (R$);Mão de Obra (R$);Custo Interno (R$);Quilometragem;Estado Físico;Observações;Serviços
ABC-1234;Ford;Fiesta;Branco;Particular;João Silva;2026-04-01;Aguardando;5;2;500,00;800,00;300,00;120000;Bom;Observação;Funilaria|Pintura
```

**Pontos importantes:**
- Separador: `;` (ponto-e-vírgula)
- Valores monetários: use `,` como decimal
- Serviços: separados por `|` (ex.: `Funilaria|Pintura`)
- Data: formato YYYY-MM-DD

### Importar no App
1. Clique em **"📤 Importar"**
2. Selecione o arquivo `.csv`
3. **Atenção**: Substitui TODOS os registros!
4. Confirmado → importação realizada

---

## 📤 Como Exportar CSV

1. Clique em **"📥 Exportar"** na tabela principal
2. Arquivo baixado: `oficina-veiculos-DD-MM-AAAA.csv`
3. Abra no Excel com separador `;`

---

## 🔑 Permissões por Rol

| Funcionalidade | Admin | Atendente | Financeiro |
|---|---|---|---|
| Visualizar veículos | ✅ | ✅ | ✅ |
| Cadastrar veículo | ✅ | ✅ | ❌ |
| Editar veículo | ✅ | ✅ | ❌ |
| Deletar veículo | ✅ | ❌ | ❌ |
| Mudar status | ✅ | ✅ | ❌ |
| Alterar regras | ✅ | ❌ | ❌ |
| Gerenciar usuários | ✅ | ❌ | ❌ |
| Exportar/Importar | ✅ | ✅ | ✅ |

---

## 🛠️ Variáveis de Ambiente (Opcional)

Para provisionar admin via ambiente antes de iniciar:

```bash
set ADMIN_USERNAME=admin
set ADMIN_FULL_NAME=João Silva
set ADMIN_PASSWORD=Senha@123
npm start
```

Portas importantes:
- **3000**: Aplicação web

---

## 📂 Estrutura de Arquivos

```
app gestão de oficina/
├── server.js           # Backend Node + Express
├── app.js              # Frontend lógica
├── index.html          # Interface HTML
├── styles.css          # Estilos
├── package.json        # Dependências
├── data/               # Base de dados
│   ├── oficina.db      # SQLite (permanente)
│   └── uploads/        # Fotos dos veículos
├── GUIA_USO.md         # Guia completo
├── exemplo-veiculos.csv # Amostra para importação
└── README.md           # Este arquivo
```

---

## ⚡ Performance

- **Frontend**: Vanilla JS (sem frameworks)
- **Backend**: Node.js Express + SQLite
- **Carga**: Instantânea, sem compilação
- **Escalabilidade**: Até ~10k veículos sem problemas

---

## 🆘 Troubleshooting

### "Falha de conexão com o servidor"
```bash
npm start  # Reinicie o servidor
```

### "CSV inválido"
- Use separador `;` (ponto-e-vírgula)
- Verifique se tem cabeçalho correto
- Teste com `exemplo-veiculos.csv`

### "Usuário ou senha inválidos"
- Username é **case-insensitive** (admin = ADMIN)
- Senha é **case-sensitive**
- Mínimo 8 caracteres com maiúscula, minúscula, número e símbolo

---

## 📞 Suporte

- Abra o console (F12) para ver erros
- Verifique se o terminal do servidor está rodando
- Limpe o cache do navegador se tiver problemas

---

**Versão**: 1.0.0  
**Última atualização**: 04/04/2026
- ADMIN_FULL_NAME
- ADMIN_PASSWORD (obrigatória e com senha forte)

## Como usar
1. Faça login com usuário e senha.
2. Cadastre os veículos no formulário lateral.
3. Use os filtros para analisar por cliente e recomendação.
4. Navegue entre as abas:
  - Tabela: análise detalhada e alteração de status.
  - Kanban: visão por etapa do processo.
  - Histórico: trilha de auditoria.
  - Regras: ajuste da lógica de prioridade e rentabilidade.
5. Use Exportar CSV e Importar CSV para trabalhar com planilhas.
6. No celular, use o campo de fotos para registrar o estado físico do carro no ato da entrada.
7. Use Detalhes para abrir galeria e gerar PDF da vistoria com assinatura.
8. Se logado como admin, use a aba Usuários para administrar acessos.

## API local disponível
- GET /api/health
- GET /api/bootstrap
- POST /api/vehicles
- POST /api/vehicles/import
- PATCH /api/vehicles/:id/status
- DELETE /api/vehicles/:id
- PUT /api/rules
- POST /api/auth/login
- PUT /api/vehicles/:id
- GET /api/users
- POST /api/users
- PATCH /api/users/:id/password
- PATCH /api/users/:id/status

## Segurança de sessão
- Duração máxima da sessão: 8 horas.
- Inatividade máxima: 30 minutos.
- Ao expirar, o sistema realiza logout automático.

## Observações
- O layout usa fontes e imagem de fundo externas.
- Banco SQLite fica salvo em data/oficina.db.
- As fotos ficam salvas em data/uploads e entram vinculadas ao cadastro do veículo.
