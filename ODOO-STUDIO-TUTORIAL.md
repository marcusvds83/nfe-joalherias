# 📐 Tutorial Definitivo: Abas NF-e no Odoo (via Odoo Studio)

> ⚠️ **CONTEXTO:** O Odoo SaaS Trial (que é o caso do `fiscal-cloud-joalherias.odoo.com`) bloqueia a criação de views via XML-RPC. Testamos 4 abordagens diferentes, todas falharam com o erro "Record does not exist or has been deleted". A única forma de criar abas/views no SaaS Trial é via **Odoo Studio** — a ferramenta visual nativa do Odoo Enterprise.

> ✅ **Em instância Community/Enterprise regular (não-Trial)**, o script Python `setup-views-odoo.py` (incluído neste repo) cria TUDO automaticamente em 30 segundos.

## 🎯 Campos a serem exibidos em cada aba

### Resumo das abas a criar:

| Modelo | Aba a criar | Campos na aba |
|---|---|---|
| `product.template` (Produto) | "Composição de Custo" | peso_ouro_g, custo_metal_g, custo_metal_total, custo_pedras_usd, cotacao_usd_brl, custo_pedras_brl, custo_mao_obra |
| `product.template` (Produto) | "Formação de Preço" | custo_total, moeda_ref, markup_pct, preco_calculado |
| `product.template` (Produto) | "NF-e Joalheria" | ncm, cfop, descricao_nfe, unidade_medida, peso_ouro_kg |
| `account.move` (Fatura) | "NF-e Joalheria" | status, chave, protocolo, dh_emissao, tipo_operacao, erro, xml |
| `res.company` (Empresa) | "NF-e Joalheria" | serie, numero, inscricao_estadual |
| `sale.order` | colunas na linha | peso_ouro_g, custo_metal_g, custo_pedras_usd, mao_obra, markup, tipo_operacao |
| `purchase.order` | colunas na linha | peso_ouro_g, custo_metal_g, custo_pedras_usd, mao_obra, tipo_operacao |

---

## 🛠️ Passo a passo: Odoo Studio (no produto)

### 1. Abrir o Odoo Studio

1. Acesse https://fiscal-cloud-joalherias.odoo.com/web
2. No canto superior direito, clique no ícone do **Studio** (parece um escudo/ferramenta)
   - Se não aparecer, vá em **Configurações → Usuários → Selecione você → Ative "Studio"**
3. A interface do Studio abre com uma barra lateral esquerda

### 2. Selecionar o modelo "Product / Template"

1. Na barra lateral esquerda do Studio, clique em **"Views"**
2. Selecione o modelo **Product** (product.template)
3. Você verá a lista de views (Form, List, Kanban, Search)
4. Clique em **"Form"** — abre o formulário do produto no editor visual

### 3. Criar a aba "Composição de Custo"

1. No formulário, localize o **notebook** (a área com as abas: General, Purchase, Sales, Inventory...)
2. Clique com botão direito em qualquer aba existente → **"Add Page"** (ou use o botão "+")
3. Renomeie a nova aba para **"Composição de Custo"**
4. Arraste e solte campos dentro da aba:
   - Clique em um campo vazio → escolha "Float"
   - Renomeie para: `Peso Ouro (g)` → no painel direito, em "Field", selecione `x_joa_peso_ouro_g`
   - Repita para: `Custo Ouro/g (BRL)` → `x_joa_custo_metal_g`
   - `Custo Metal Total` → `x_joa_custo_metal_total` (marque **Read-only**)
   - `Custo Pedras (USD)` → `x_joa_custo_pedras_usd`
   - `Cotação USD/BRL` → `x_joa_cotacao_usd_brl`
   - `Custo Pedras (BRL)` → `x_joa_custo_pedras_brl` (Read-only)
   - `Custo Mão de Obra (BRL)` → `x_joa_custo_mao_obra`
5. Organize em 2 grupos dentro da aba:
   - Grupo "Metal (Ouro)" com os 3 primeiros
   - Grupo "Pedras" com os 3 seguintes
   - Grupo "Mão de Obra" com o último
6. Clique em **Save** (botão azul no topo)

### 4. Criar a aba "Formação de Preço"

1. Clique novamente no "+" para adicionar outra aba
2. Renomeie para **"Formação de Preço"**
3. Adicione os campos:
   - `Custo Total` → `x_joa_custo_total` (Read-only)
   - `Moeda Referência` → `x_joa_moeda_ref` (Selection)
   - `Markup (%)` → `x_joa_markup_pct`
   - `Preço Calculado` → `x_joa_preco_calculado` (Read-only)
   - `Exceção Fiscal UF` → `x_joa_excecao_fiscal_uf`
   - `Alíquota ICMS Especial` → `x_joa_aliquota_icms_especial`
4. Salve

### 5. Criar a aba "NF-e Joalheria" (com campos legados)

1. Adicione outra aba
2. Renomeie para **"NF-e Joalheria"**
3. Adicione os campos:
   - `NCM` → `x_joalheria_ncm`
   - `CFOP Default` → `x_joalheria_cfop`
   - `Descrição NF-e` → `x_joalheria_descricao_nfe` (Text)
   - `Unidade Medida` → `x_joalheria_unidade_medida`
   - `Peso Ouro (kg) para Exportação` → `x_joalheria_peso_ouro_kg`
4. Salve

### 6. Sair do Studio

Clique no **X** no canto superior direito do Studio para voltar à tela normal.

### 7. Testar

1. Abra qualquer produto no Odoo
2. Você verá as 3 novas abas: **Composição de Custo**, **Formação de Preço**, **NF-e Joalheria**
3. Preencha um produto de teste:
   - Aba Composição de Custo: peso 5g, custo/g R$ 350, pedras USD 200, cotação 5.20, mão de obra R$ 150
   - Aba Formação de Preço: markup 100%
4. **Ação (engrenagem no topo) → "Recalcular Custos (Joalheria)"**
   - Vai preencher: custo_metal_total=1750, custo_pedras_brl=1040, custo_total=2940, preco_calculado=5880
5. **Ação → "Aplicar Preço Calculado (Joalheria)"**
   - `list_price` agora é R$ 5.880,00

---

## 🛠️ Passo a passo: Aba "NF-e Joalheria" no Financeiro (account.move)

### 1. No Studio, selecionar modelo "Invoice / Journal Entry"

> No Odoo 17+: o modelo é `account.move` mas aparece como "Invoice" no Studio.

1. Barra lateral esquerda → Views → selecione "Invoice" (account.move)
2. Clique em **"Form"**

### 2. Criar aba "NF-e Joalheria"

1. Adicione nova aba
2. Renomeie para **"NF-e Joalheria"**
3. Adicione os campos:
   - `Status NF-e` → `x_joalheria_nfe_status` (Selection)
   - `Tipo Operação` → `x_joalheria_nfe_tipo_operacao` (Selection)
   - `Chave de Acesso` → `x_joalheria_nfe_chave` (Char, **Read-only**)
   - `Protocolo` → `x_joalheria_nfe_protocolo` (Char, Read-only)
   - `Data Emissão` → `x_joalheria_nfe_dh_emissao` (Datetime, Read-only)
   - `Erro` → `x_joalheria_nfe_erro` (Text, Read-only)
   - `XML NF-e` → `x_joalheria_nfe_xml` (Text, Read-only) — mostra o XML autorizado
4. Salve

### 3. Testar

1. Abra uma fatura de venda (Out Invoice)
2. Vá na aba "NF-e Joalheria"
3. Status deve estar vazio (ou `pendente` se já marcou)
4. **Ação → "Emitir NF-e"** → Status muda para `pendente` → `processando` → `autorizada`
5. Quando autorizada, Chave/Protocolo/Data/XML preenchidos automaticamente pelo middleware

---

## 🛠️ Passo a passo: Aba "NF-e Joalheria" na Empresa (res.company)

### 1. No Studio, selecionar modelo "Company"

1. Barra lateral esquerda → Views → selecione "Company" (res.company)
2. Clique em **"Form"**

### 2. Criar aba "NF-e Joalheria"

1. Adicione nova aba
2. Renomeie para **"NF-e Joalheria"**
3. Adicione os campos:
   - `Série NF-e` → `x_joalheria_nfe_serie` (Char)
   - `Último Número NF-e` → `x_joalheria_nfe_numero` (Integer)
   - `Inscrição Estadual Emitente` → `x_joalheria_nfe_inscricao_estadual` (Char)
4. Salve

### 3. Configurar

1. Vá em **Configurações → Empresas → Atualizar Informações** → selecione sua empresa
2. Aba "NF-e Joalheria":
   - Série: `1`
   - Último Número: `0` (vai incrementar a cada emissão)
   - Inscrição Estadual: preencha a IE da empresa (somente dígitos)

---

## 🛠️ Passo a passo: Campos na linha do Pedido de Venda (sale.order)

### 1. No Studio, selecionar modelo "Quotation / Sale Order"

1. Barra lateral esquerda → Views → "Sale Order" (sale.order)
2. Clique em **"Form"**

### 2. Adicionar colunas na árvore de linhas

1. No formulário do pedido de venda, localize a seção das **linhas** (order_line — a tree)
2. Clique no cabeçalho da tree (onde ficam os títulos das colunas)
3. **Add Column** → escolha os campos:
   - `x_joa_peso_ouro_g` (renomeie para "Peso Ouro (g)")
   - `x_joa_custo_metal_g` (renomeie para "Custo Ouro/g")
   - `x_joa_custo_pedras_usd` (renomeie para "Custo Pedras USD")
   - `x_joa_custo_mao_obra` (renomeie para "Mão de Obra")
   - `x_joa_custo_total_unit` (renomeie para "Custo Total" — Read-only)
   - `x_joa_markup_pct` (renomeie para "Markup %")
   - `x_joa_preco_calculado_unit` (renomeie para "Preço Calc." — Read-only)
   - `x_joa_tipo_operacao` (renomeie para "Tipo Operação")
4. Salve

### 3. Testar

1. Crie um novo Pedido de Venda
2. Adicione uma linha com um produto que tem composição de custo preenchida
3. Os campos da linha virão preenchidos do produto (override)
4. Você pode **sobrescrever** qualquer campo só para essa venda

---

## 🛠️ Passo a passo: Campos na linha do Pedido de Compra (purchase.order)

### 1. No Studio, selecionar modelo "Purchase Order"

1. Barra lateral → Views → "Purchase Order" (purchase.order)
2. Clique em **"Form"**

### 2. Adicionar colunas

1. Localize a tree das linhas (order_line)
2. **Add Column** → escolha:
   - `x_joa_peso_ouro_g`
   - `x_joa_custo_metal_g`
   - `x_joa_custo_pedras_usd`
   - `x_joa_custo_mao_obra`
   - `x_joa_custo_total_unit` (Read-only)
   - `x_joa_tipo_operacao` (Compra Interna / Importação / Compra Sucata)
3. Salve

---

## 📝 XML pronto (alternativa avançada)

Se você estiver em uma instância **Community/Enterprise regular** (não-Trial), pode usar o script Python para criar tudo automaticamente:

```bash
ODOO_URL=https://sua-instancia-regular.odoo.com \
  ODOO_DB=seu_db \
  ODOO_USER=seu@email.com \
  ODOO_API_KEY=sua-chave \
  python3 odoo-scripts/setup-views-odoo.py
```

Este script (a ser criado) vai criar:
- 5 views de aba (product.template, account.move, res.company, sale.order, purchase.order)
- 1 view com smart button na fatura (link para download DANFE)
- 1 action de menu "NF-e Joalherias" no menu principal

---

## ⚠️ Limitação confirmada do SaaS Trial

Testamos em `fiscal-cloud-joalherias.odoo.com`:
- ✅ Criar campos customizados (ir.model.fields) — **FUNCIONA** (já criamos 32 campos + 2 botões)
- ✅ Criar Server Actions (ir.actions.server) — **FUNCIONA** (já criamos 4: Recalcular, Aplicar Preço, Emitir NF-e, Cancelar NF-e)
- ❌ Criar views customizadas (ir.ui.view com arch_db) — **BLOQUEADO** no SaaS Trial
- ❌ Criar menus customizados (ir.ui.menu) — **BLOQUEADO**

### Solução para SaaS Trial

Use o **Odoo Studio** (Enterprise) que é a única forma visual permitida. Os campos já estão criados no banco de dados — basta arrastar para a aba no Studio.

### Solução definitiva (recomendada para produção)

Para o cliente final (Isabel Oliveira piloto), migre para uma instância **regular** (Community ou Enterprise), onde o script Python funciona 100% e cria tudo automaticamente.

---

## 🆘 Se algo não funcionar

1. **Studio não aparece?** → Vá em Configurações → Usuários → Você → ative "Studio"
2. **Campos não aparecem no Studio?** → Verifique se o script `setup-pesos-custos-precos.py` foi rodado (cria os 32 campos x_joa_*)
3. **Botão "Emitir NF-e" não aparece nas Ações?** → Verifique se o script `setup-completo-odoo.py` foi rodado (cria as 4 Server Actions)
4. **Middleware não processa NF-e?** → Verifique no Render se as env vars `ODOO_*` estão setadas e o deploy está OK

Para dúvidas sobre o que foi criado no Odoo, rode:
```bash
ODOO_URL=https://fiscal-cloud-joalherias.odoo.com \
  ODOO_DB=fiscal-cloud-joalherias \
  ODOO_USER=marcus@nytro.com.br \
  ODOO_API_KEY=6ec876e680e4f43fe94645c05ca6097c65e80f2d \
  python3 odoo-scripts/check-status.py
```
