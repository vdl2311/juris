# Sistema Jurídico Inteligente — Versão Google AI Studio

Copiloto de IA para advogados e escritórios de advocacia, com 19 módulos integrados.

## Como rodar localmente

**Pré-requisitos:** Node.js 18+

1. Instalar dependências:
```bash
npm install
```

2. Configurar a chave da API do Gemini:
   - Obtenha em: https://aistudio.google.com/apikey
   - Crie um arquivo `.env` com:
```
GEMINI_API_KEY=sua_chave_aqui
```

3. Rodar:
```bash
npm run dev
```

4. Abrir: http://localhost:3000

## Como importar no Google AI Studio

1. Acesse: https://aistudio.google.com/
2. Clique em **"Create App"** ou **"Import"**
3. Selecione a pasta deste projeto (ou faça upload do ZIP)
4. Configure a variável de ambiente `GEMINI_API_KEY` no painel de Secrets
5. Clique em **Deploy** ou **Run**

## Estrutura do Projeto

```
├── index.html              # HTML principal
├── package.json            # Dependências (React + Express + @google/genai)
├── server.ts               # Servidor Express com Gemini API
├── metadata.json           # Configuração do AI Studio
├── tsconfig.json
├── vite.config.ts
├── .env.example            # Template da chave API
└── src/
    ├── main.tsx            # Entry point React
    ├── App.tsx             # Componente principal (19 módulos)
    ├── index.css           # Estilos + Tailwind
    ├── types.ts            # Tipos TypeScript
    ├── db.ts               # Banco de dados em memória
    ├── firebase.ts         # Placeholder Firebase
    ├── components/
    │   ├── ClienteFormModal.tsx    # Form cliente com validação
    │   └── ProcessoFormModal.tsx   # Form processo com máscara CNJ
    └── utils/
        └── validation.ts   # Validações CPF/CNPJ/Telefone/CNJ
```

## Módulos Disponíveis (19)

### Visão Geral
- **Dashboard** — Estatísticas e notificações

### Gestão
- **Clientes** — CRUD com validação CPF/CNPJ/Telefone
- **Processos** — CRUD com máscara CNJ + Consulta Datajud
- **Agenda** — Audiências e prazos
- **Tarefas** — Kanban com drag-and-drop
- **Financeiro** — Honorários e despesas
- **Documentos** — Gestão com assinatura eletrônica

### IA Jurídica (usa Gemini API)
- **Inteligência Jurídica** — Chat conversacional
- **IA & Automação** — Resumo de processo + Geração de peças
- **Pesquisa Jurídica** — Pesquisa com IA
- **Estratégia Processual** — Análise estratégica
- **Elaboração de Peças** — Petições, recursos, contratos
- **Análise de Contratos** — Identifica cláusulas abusivas
- **Parecer Jurídico** — Pareceres estruturados

### Ferramentas
- **Cálculos Jurídicos** — Juros simples/compostos

### Administração
- **Integrações** — WhatsApp, E-mail, Tribunal, OCR, Assinatura
- **Portal do Cliente** — Visualização do cliente
- **Relatórios** — Indicadores + Exportação CSV
- **Usuários** — CRUD com 4 perfis

## Perfis de Usuário (4)

| Perfil | Permissões |
|--------|------------|
| **Administrador** | Acesso total a todos os módulos |
| **Advogado** | Gestão + IA Jurídica + Relatórios |
| **Estagiário** | Processos, Agenda, Tarefas, Documentos, IA |
| **Secretária** | Clientes, Agenda, Documentos, Integrações |

## Funcionalidades de IA (Gemini)

- **Chat jurídico** com histórico conversacional
- **Resumo automático** de processos
- **Geração de peças** (Petição, Contestação, Recurso, etc.)
- **Análise de contratos** com identificação de cláusulas abusivas
- **Estratégia processual** com pontos fortes/fracos
- **Pareceres jurídicos** estruturados

## Funcionalidades Brasileiras

- Validação de **CPF** (com dígitos verificadores)
- Validação de **CNPJ** (com dígitos verificadores)
- Validação de **Telefone** (DDD válido, formato celular/fixo)
- Validação de **Número CNJ** de processo (20 dígitos)
- Máscaras automáticas em tempo real
- Consulta à **API Datajud** do CNJ
- Formatação de moeda em Real (R$)
- Datas no formato dd/mm/aaaa

## API Endpoints

### CRUD
- `GET/POST /api/clientes`
- `GET/POST /api/processos`
- `POST /api/processos/:id/andamentos`
- `GET/POST /api/eventos`
- `GET/POST/PUT/DELETE /api/tarefas`
- `GET/POST/PUT/DELETE /api/honorarios`
- `GET/POST/PUT/DELETE /api/despesas`
- `GET/POST/DELETE /api/documentos`
- `GET/POST/DELETE /api/usuarios`

### IA (Gemini)
- `POST /api/ia/chat` — Chat jurídico
- `POST /api/ia/resumir-processo` — Resumo de processo
- `POST /api/ia/gerar-documento` — Geração de peças
- `POST /api/ia/analise-contrato` — Análise de contrato
- `POST /api/ia/estrategia` — Estratégia processual
- `POST /api/ia/parecer` — Parecer jurídico

### Externo
- `GET /api/datajud/:numero` — Consulta processo no CNJ

## Dados Iniciais (Seed)

O banco de dados em memória vem pré-populado com:
- 4 usuários (Ana/Admin, Carlos/Advogado, Bruna/Estagiário, Fernanda/Secretária)
- 3 clientes (PF e PJ)
- 3 processos (Cobrança, Trabalhista, Divórcio)
- 3 eventos (Audiência, Prazo, Reunião)
- 3 tarefas (Kanban)
- 3 honorários (Pendente, Pago, Atrasado)
- 2 despesas
- 2 documentos

## Tecnologias

- **Frontend:** React 18 + TypeScript + Tailwind CSS + Lucide Icons
- **Backend:** Express.js + TypeScript
- **IA:** Google Gemini (`@google/genai`)
- **Build:** Vite
- **Validação:** Custom (CPF/CNPJ/Telefone/CNJ)

## Licença

ISC
