# 🚨 Debug Render 502 — Guia completo

## Estado atual
- Deploy existe (cloudflare responde)
- App está offline (502 em 0.2s, não é cold start)
- Sem acesso ao painel Render = sem logs de build/runtime

## Diagnóstico: provável causa

O log do usuário mostrou:
```
$ NODE_ENV=production bun .next/standalone/server.js
▲ Next.js 16.1.3
✓ Ready in 998ms
error: script "start" was terminated by signal SIGTERM
==> Your service is live 🎉
```

**Diagnóstico**: o app inicia com `bun` e o Next.js carrega em 998ms, mas é terminado por SIGTERM logo depois. Possíveis causas:
1. **bun não suportado no Render**: Render Node 20+ nativo, mas bun pode não estar instalado por padrão
2. **OOM**: free tier tem 512MB RAM — pode estourar no carregamento de módulos pesados (firebase-admin, xml-crypto, etc)
3. **Health check falha**: Render mata o container se /api/v1/health não responder em 60s

## ✅ Soluções já aplicadas (no repo)

| Commit | Alteração |
|---|---|
| ff41bf7 | `package.json`: `start` mudou de `bun` para `node` |
| ff41bf7 | `render.yaml`: build/start agora usam `npm` (Node 20+ nativo Render) |
| ff41bf7 | `Dockerfile`: criado como fallback |
| 463766f | `.nvmrc`: força Node 20+ no Render |
| 8cbb979 | `/api/v1/health?keepalive=1`: processa NF-e pendentes (mantém acordado) |

## 🛠️ Passos para resolver (após recuperar acesso ao painel Render)

### Passo 1: Verificar Build Logs

No painel Render → serviço `nfe-joalherias` → **Logs** → aba **Build**

Procurar por erros vermelhos como:
- `npm ERR!` (falha de instalação de pacote)
- `TypeError: Cannot find module` (módulo ausente)
- `Error: spawn ... ENOENT` (comando não encontrado)
- ESLint errors: `error: script "build" exited with code 1`

### Passo 2: Verificar Deploy Logs

Aba **Deploy** (depois do build)

Procurar por:
- `Error: Cannot find module '/app/.next/standalone/server.js'` (build não gerou standalone)
- `Error: listen EADDRINUSE` (porta em uso)
- `Error: Cannot read properties of undefined` (env var ausente)
- `SIGTERM` (container sendo morto por Render)

### Passo 3: Verificar Settings

Painel → **Settings** → confirmar:

| Campo | Valor correto |
|---|---|
| Build Command | `npm install --legacy-peer-deps && npm run build` |
| Start Command | `npm run start` |
| Plan | Free (hiberna) ou Starter $7/mês (não hiberna) |
| Region | Oregon |
| Branch | `main` |
| Auto-Deploy | ✓ ON |

### Passo 4: Verificar Environment Variables

Painel → **Environment**

Confirmar que TODAS estas estão setadas (caso contrário, app crasha):

```
NODE_ENV=production
API_KEY=<valor-que-voce-escolheu>
ODOO_ENABLED=1
ODOO_URL=https://fiscal-cloud-joalherias.odoo.com
ODOO_DB=fiscal-cloud-joalherias
ODOO_USER=marcus@nytro.com.br
ODOO_API_KEY=6ec876e680e4f43fe94645c05ca6097c65e80f2d
ODOO_POLLING_MS=20000
FIREBASE_PROJECT_ID=api-nfe-joalherias
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@api-nfe-joalherias.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=<cole do JSON baixado, com \n>
NFE_EMISSAO_MODO=proprio
NFE_UF=PR
NFE_TP_AMB=2
NFE_CERT_KEK=<outra chave forte>
```

### Passo 5: Force Manual Deploy

Painel → **Manual Deploy** → **Deploy latest commit** (botão azul no topo)

Isso força rebuild do zero, ignorando cache.

### Passo 6: Se continuar 502, use Dockerfile

Painel → **Settings**:
- **Runtime**: trocar de `Node` para `Docker`
- Build Command e Start Command ficam vazios (Dockerfile controla tudo)
- Save → Manual Deploy

O `Dockerfile` no repo já está pronto para isso.

## 🔥 Alternativa: trocar para Vercel (mais estável, free tier não hiberna)

Se Render continuar instável:

### Vercel deploy:
1. https://vercel.com → Login com GitHub
2. **New Project** → importar `marcusvds83/nfe-joalherias`
3. Framework Preset: **Next.js**
4. Build Command: `npm install --legacy-peer-deps && npm run build`
5. Output Directory: `.next` (default)
6. Environment Variables: copiar TODAS da lista acima
7. **Deploy**

Vantagens Vercel:
- Free tier NÃO hiberna
- Deploy em 1-2 min (vs Render 3-5 min)
- Logs mais detalhados
- Edge cache global

Desvantagens:
- Free tier tem limite de 100GB bandwidth/mês
- Serverless functions têm timeout 10s (60s no plano pago)
- Não suporta long-running processes (como polling NF-e)

> ⚠️ Vercel free tier tem 10s timeout nas API routes — pode não servir para `/api/v1/nfe/emitir` que demora até 90s. Render é melhor para essa use case.

## 📞 Como recuperar acesso ao painel Render

1. **Esqueci senha**: https://dashboard.render.com/login → "Forgot password?"
2. **Verificar email de verificação**: Render envia email no signup. Procurar na caixa de entrada e pasta de Spam por "render"
3. **SSO GitHub/Google**: Se fez signup via GitHub/Google, clique no botão correspondente
4. **Suporte Render**: support@render.com com:
   - Nome: Marcus Vinicius
   - Email usado no signup
   - URL do serviço: `nfe-joalherias.onrender.com`
   - Mensagem: "Lost dashboard access, deploy returns 502, need to access logs"

## ⏳ Workaround temporário: UptimeRobot

Mesmo sem acesso ao painel Render, você pode usar **UptimeRobot** (gratuito) para pingar a URL a cada 5 min e tentar "acordar" o Render:

1. https://uptimerobot.com → criar conta grátis
2. **Add Monitor** → tipo **HTTP(s)**
3. URL: `https://nfe-joalherias.onrender.com/api/v1/health?keepalive=1`
4. Intervalo: 5 min
5. Salvar

> 💡 Isso não resolve se o app estiver realmente crashed (não hibernando), mas se for só hibernate, vai manter acordado.

## 📋 Checklist final

- [ ] Recuperar acesso ao painel Render
- [ ] Verificar Build Logs por erros
- [ ] Confirmar todas env vars setadas
- [ ] Manual Deploy após push
- [ ] Se persistir: trocar runtime para Docker
- [ ] Se ainda persistir: considerar Vercel ou Render paid plan

## 🚀 Resumo do que está funcionando

Mesmo com o Render em 502, **tudo no Odoo está pronto**:

- ✅ 74 campos customizados criados
- ✅ 5 abas criadas (produto, fatura, empresa, pedido venda, pedido compra)
- ✅ 13 colunas na tree do pedido de venda
- ✅ Aba "Totais do Pedido" com 7 totais agregados
- ✅ 7 automações (`base.automation`) rodando
- ✅ 6 Server Actions vinculadas a menus
- ✅ Validação real com sale.order de teste mostrou tudo preenchido automaticamente

Quando o Render voltar, é só você:
1. Fazer upload do certificado A1 (.pfx) na aba Setup do middleware
2. Clicar em "Testar Conexão SEFAZ" (deve dar `cStat 107`)
3. Criar pedido de venda no Odoo → confirmar → gerar fatura → Ação → Emitir NF-e
4. Em 20s o middleware processa, anexa XML+DANFE no chatter da fatura
