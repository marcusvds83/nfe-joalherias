# NF-e Joalherias - Fiscal Cloud

Middleware de emissao propria de **NF-e** para o setor joalheiro, integrando **Odoo** (ERP) com a **SEFAZ** (autorizacao de NF-e via mTLS) com certificado A1 armazenado no **Firebase** (cofre seguro).

## Arquitetura

```
Odoo (fatura com x_joalheria_nfe_status = "pendente")
    | XML-RPC (polling a cada 20s)
Next.js API (Render) - este middleware
    | certificado A1 (cofre Firebase)
    | XML NF-e 4.00 assinado (RSA-SHA1 + C14N)
SEFAZ (NFeAutorizacao4 SOAP 1.2 + mTLS)
    | autorizada (cStat 100)
DANFE PDF gerado localmente (PDFKit + barcode Code128)
    | anexa XML + PDF + posta mensagem no chatter
Odoo (fatura atualizada)
```

## Stack Tecnologica

- **Frontend**: Next.js 16 + TypeScript + Tailwind CSS 4 + shadcn/ui
- **Backend**: Next.js API Routes (App Router)
- **Odoo**: XML-RPC (compativel com Odoo 16/17/18/19 SaaS e Online)
- **SEFAZ**: SOAP 1.2 com mTLS (PEM extraido do PFX via node-forge/OpenSSL fallback)
- **Firebase**: Firestore como cofre do certificado A1 (sobrevive a deploys)
- **PDFKit**: Geracao local do DANFE
- **xml-crypto**: Assinatura XMLDSig (RSA-SHA1, C14N)

## Especificidades do Setor Joalheiro

### Operacoes Suportadas

| Operacao | CFOP | Descricao |
|---|---|---|
| Venda interna | 5101 | Venda dentro do estado |
| Venda interestadual | 6101 | Venda para outro estado |
| Remessa para industrializacao | 5901 | Cliente fornece ouro, paga mao de obra |
| Retorno de industrializacao | 1910 | Retorno de joias processadas |
| Exportacao | 7101 | Com detalhamento do peso de ouro em kg |

### Regimes Tributarios

Suporte aos 3 regimes brasileiros:
- **Simples Nacional** (CSOSN 102 - nao tributada pelo Simples)
- **Lucro Presumido** (CST 00, 18% ICMS)
- **Lucro Real** (CST 00)

Configuravel via env var `JOALHERIA_REGIME_TRIBUTARIO`.

### Precificacao Multimoeda

Custos compostos do setor joalheiro:
- **Metal** (ouro): precificado em quilos (BRL/kg)
- **Pedras**: precificadas em dolar (USD/unidade)
- **Mao de obra**: precificada em reais (BRL/servico)

### Produto-Moeda

Ouro atua simultaneamente como item de estoque e meio de pagamento. A camada de transicao do middleware converte entradas de ouro como pagamento para o estoque de produto sem gerar incoerencias auditaveis.

## Estrutura do Projeto

```
nfe-joalherias/
  src/
    app/
      api/v1/
        health/                   Health check
        nfe/
          certificado/            Upload/status/remover cert A1 (Firebase)
          sefaz/status/           Status servico SEFAZ
          emitir/                 Emitir NF-e por move_id
          cancelar/               Cancelar NF-e autorizada
          process-pending/        Polling forcado
          dashboard/              Dados do painel
            [id]/xml/             Download XML NF-e
            [id]/pdf/             Download DANFE PDF
        odoo/test-connection/     Testa conexao Odoo
      page.tsx                    Frontend dashboard (auth + tabs)
    lib/
      config.ts                   Configuracoes centralizadas
      auth.ts                     Middleware x-api-key
      odoo-rpc.ts                 Cliente XML-RPC Odoo
      firebase-cert.ts            Cofre A1 no Firestore
      pfx.ts                      Parser PFX (node-forge + OpenSSL)
      nfe-xml.ts                  Gerador XML NF-e 4.00 joalheiro
      nfe-signer.ts               Assinatura XMLDSig (RSA-SHA1 + C14N)
      sefaz-client.ts             SOAP 1.2 + mTLS para SEFAZ
      danfe-pdf.ts                Gerador DANFE PDF (PDFKit)
      nfe-emit.ts                 Dispatcher de emissao (polling)
      api-client.ts               Cliente HTTP do frontend
    components/ui/                shadcn/ui components
  odoo-scripts/
    setup-completo-odoo.py        Cria campos customizados + botoes no Odoo
  scripts/
    enviar-certificado.js         Upload de .pfx via CLI
  .env.example                    Template de env vars
```

## Deploy no Render

### 1. Variaveis de Ambiente

| Variavel | Exemplo | Descricao |
|---|---|---|
| `API_KEY` | `minha-chave-forte-aleatoria` | Chave de acesso ao middleware |
| `ODOO_ENABLED` | `1` | Liga integracao Odoo |
| `ODOO_URL` | `https://fiscal-cloud-joalherias.odoo.com` | URL do Odoo |
| `ODOO_DB` | `fiscal-cloud-joalherias` | Database do Odoo |
| `ODOO_USER` | `marcus@nytro.com.br` | Email do usuario Odoo |
| `ODOO_API_KEY` | `6ec876e6...` | API Key gerada no Odoo (Preferencias > Chaves de API) |
| `ODOO_POLLING_MS` | `20000` | Intervalo do polling (default 20s) |
| `FIREBASE_PROJECT_ID` | `nfe-joalherias` | Project ID do Firebase |
| `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk@nfe-joalherias.iam.gserviceaccount.com` | Email service account |
| `FIREBASE_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\n...` | Private key (com \n) |
| `NFE_UF` | `PR` | UF do emitente (define webservice) |
| `NFE_TP_AMB` | `2` | 1=producao, 2=homologacao |
| `NFE_CERT_KEK` | `chave-forte-para-cifrar-senha-em-disco` | Kek para cifrar senha do cert no Firebase |
| `JOALHERIA_REGIME_TRIBUTARIO` | `simples_nacional` | Regime tributario default |

### 2. Build & Start

- **Build Command**: `npm install && npm run build` (ou bun)
- **Start Command**: `npm run start` (Next.js standalone)
- **Disk**: opcional (1 GB em `/var/data`) - o Firebase ja substitui a necessidade

### 3. Configurar Cron (opcional)

Render Cron Jobs podem chamar `GET /api/v1/nfe/process-pending?api_key=KEY` a cada 5 minutos para forcar polling em ambiente serverless.

## Firebase Setup

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/)
2. Va em **Project Settings > Service Accounts**
3. Clique em **Generate New Private Key** - baixa um JSON
4. Copie `project_id`, `client_email` e `private_key` para as env vars do Render
5. O Firestore sera criado automaticamente no primeiro acesso (regras abertas para service account)

## Setup do Odoo

### 1. Gerar API Key no Odoo

1. Acesse o Odoo como usuario admin
2. Clique no avatar (canto superior direito) > **Preferencias**
3. Va em **Conteudo > Chaves de API** (ou "API Keys")
4. Clique em **Gerar nova chave** e copie o valor
5. Cole nas Environment Variables do Render como `ODOO_API_KEY`

### 2. Criar Campos Customizados + Botoes

```bash
ODOO_URL=https://fiscal-cloud-joalherias.odoo.com \
  ODOO_DB=fiscal-cloud-joalherias \
  ODOO_API_KEY=sua-api-key-aqui \
  MIDDLEWARE_URL=https://nfe-joalherias.onrender.com \
  MIDDLEWARE_API_KEY=sua-middleware-api-key \
  python3 odoo-scripts/setup-completo-odoo.py
```

Apos rodar, em qualquer fatura: **Acao (engrenagem) > Emitir NF-e** ou **Cancelar NF-e**.

## Enviar Certificado A1

### Via painel web

Acesse `https://nfe-joalherias.onrender.com`, digite a API Key, va em **Setup > Certificado Digital A1**, escolha o `.pfx` e digite a senha.

### Via CLI (Node)

```bash
node scripts/enviar-certificado.js ./Joalheria.pfx "SENHA_DO_PFX" \
  https://nfe-joalherias.onrender.com SUA_API_KEY
```

### Via cURL

```bash
curl -X POST https://nfe-joalherias.onrender.com/api/v1/nfe/certificado \
  -H "x-api-key: SUA_API_KEY" -H "Content-Type: application/json" \
  -d '{"pfxBase64":"'$(base64 -w0 Joalheria.pfx)'","senha":"SENHA"}'
```

## Testar Conexao SEFAZ

```bash
curl -H "x-api-key: SUA_API_KEY" \
  https://nfe-joalherias.onrender.com/api/v1/nfe/sefaz/status
```

`cStat 107` = "Servico em Operacao" - certificado valido e mTLS funcionando.

## Endpoints da API

| Metodo | Rota | Funcao |
|---|---|---|
| GET | `/api/v1/health` | Health check |
| POST | `/api/v1/nfe/certificado` | Upload certificado A1 |
| GET | `/api/v1/nfe/certificado` | Status do certificado |
| DELETE | `/api/v1/nfe/certificado` | Remover certificado |
| GET | `/api/v1/nfe/sefaz/status` | Status servico SEFAZ |
| POST | `/api/v1/nfe/emitir` | Emitir NF-e por move_id (ou todas pendentes) |
| POST | `/api/v1/nfe/cancelar` | Cancelar NF-e autorizada |
| POST | `/api/v1/nfe/process-pending` | Forca polling |
| GET | `/api/v1/nfe/dashboard` | Dados do painel BI |
| GET | `/api/v1/nfe/dashboard/[id]/xml` | Download XML NF-e |
| GET | `/api/v1/nfe/dashboard/[id]/pdf` | Download DANFE PDF |
| GET | `/api/v1/odoo/test-connection` | Testa conexao Odoo |

## Roadmap Setor Joalheiro

Implementacoes futuras conforme iniciativa Loureiro & Associados x Odoo:

- [ ] **RFM (Recencia, Frequencia, Valor)** - Segmentacao automatica de clientes
- [ ] **RFI (Recencia, Frequencia, Inventario)** - Recomendacao de derretimento de metal parado
- [ ] **Data Warehouse local** - "Pescador de Dados" via API para relatorios gerenciais
- [ ] **Pagamento com sucata/joias usadas** - Conversao para estoque de ouro como produto-moeda
- [ ] **Integracao com parceiro fiscal** (Vinco/Cieg) - transmisao fiscal alternativa
- [ ] **Excecoes tributarias parametrizaveis** por estado/municipio
- [ ] **POC Isabel Oliveira** - validacao pratica de todos os fluxos

## Licenca

MIT License - Livre para uso comercial e modificacao.
