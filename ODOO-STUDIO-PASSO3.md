# 📐 Passo 3 — Criar Abas Faltantes via Odoo Studio

> ✅ **Já criado por você (Marcus):**
> - `res.company` → aba NF-e (id=3928)
> - `account.move` → aba NF-e (id=3913)
>
> ❌ **Falta criar (este tutorial):**
> 1. `product.template` → 2 abas (Composição de Custo + Formação de Preço)
> 2. `sale.order` → colunas `x_joa_*` na tree das linhas
> 3. `purchase.order` → colunas `x_joa_*` na tree das linhas

Cada passo leva ~3 minutos. Total: 10 minutos.

---

## 🛠️ Passo 1 — Aba no Produto (product.template)

### 1.1 Abrir o Studio
1. No Odoo (https://fiscal-cloud-joalherias.odoo.com/web), clique no **ícone Studio** (canto sup. direito, parece um escudo/paleta)
2. Na barra lateral esquerda do Studio → clique em **"Views"**
3. Selecione o modelo **Product** (product.template)
4. Clique em **"Form"** — abre o formulário do produto no editor

### 1.2 Criar aba "Composição de Custo"

1. No formulário, localize o **notebook** (área das abas: General, Purchase, Sales, Inventory...)
2. **Botão direito** em uma aba existente → **"Add Page"** (ou clique no `+` ao lado da última aba)
3. **Renomeie** a nova aba para: `Composição de Custo`
4. Clique dentro da aba (área vazia) → escolha **"Add Group"**
5. **Renomeie** o grupo para: `Metal (Ouro)`
6. Dentro do grupo, clique em **"Add Field"** → escolha **Float** → renomeie para `Peso Ouro (g)` → no painel direito, campo **"Field"** → selecione `x_joa_peso_ouro_g`
7. Adicione mais 3 campos no mesmo grupo:
   - Float `Custo Ouro/g (BRL)` → `x_joa_custo_metal_g`
   - Float `Custo Metal Total` → `x_joa_custo_metal_total` → marque **"Read Only"** no painel direito
8. Adicione outro **Group** chamado `Pedras` com 3 campos:
   - Float `Custo Pedras (USD)` → `x_joa_custo_pedras_usd`
   - Float `Cotação USD/BRL` → `x_joa_cotacao_usd_brl`
   - Float `Custo Pedras (BRL)` → `x_joa_custo_pedras_brl` → **Read Only**
9. Adicione outro **Group** chamado `Mão de Obra` com 1 campo:
   - Float `Custo Mão de Obra (BRL)` → `x_joa_custo_mao_obra`
10. Clique em **Save** (botão azul no topo do Studio)

### 1.3 Criar aba "Formação de Preço"

1. Clique no `+` para adicionar outra aba → renomeie para `Formação de Preço`
2. Adicione grupo `Custos` com:
   - Float `Custo Total` → `x_joa_custo_total` → **Read Only**
   - Selection `Moeda Referência` → `x_joa_moeda_ref` (opções: BRL/USD/OURO)
3. Adicione grupo `Preço Final` com:
   - Float `Markup (%)` → `x_joa_markup_pct` (deixe editável!)
   - Float `Preço Calculado` → `x_joa_preco_calculado` → **Read Only**
4. Adicione grupo `Exceção Fiscal` com:
   - Char `Exceção Fiscal UF` → `x_joa_excecao_fiscal_uf`
   - Float `Alíquota ICMS Especial` → `x_joa_aliquota_icms_especial`
5. **Save** no Studio

### 1.4 (Opcional) Criar aba "NF-e Joalheria"

Se quiser organizar os campos NF-e legados (NCM, CFOP, descrição) numa aba separada:
1. Adicione aba `NF-e Joalheria`
2. Adicione grupo `Dados Fiscais` com:
   - Char `NCM` → `x_joalheria_ncm`
   - Char `CFOP Default` → `x_joalheria_cfop`
   - Text `Descrição NF-e` → `x_joalheria_descricao_nfe`
   - Char `Unidade Medida` → `x_joalheria_unidade_medida`
   - Float `Peso Ouro (kg) p/ Exportação` → `x_joalheria_peso_ouro_kg`
3. **Save**

### 1.5 Sair do Studio e testar
1. Clique no **X** no canto sup. direito do Studio para sair
2. Vá em **Master Data → Products** → abra qualquer produto
3. Você verá as novas abas: **Composição de Custo**, **Formação de Preço**, (NF-e Joalheria)
4. Preencha um produto de teste:
   - Aba Composição: Peso Ouro (g) = `5`, Custo Ouro/g = `350`, Pedras USD = `200`, Cotação = `5.20`, Mão de Obra = `150`
   - Aba Formação: Markup = `100`
5. **Ação (engrenagem no topo) → "Recalcular Custos (Joalheria)"** — preenche os 4 campos Read Only
6. **Ação → "Aplicar Preço Calculado (Joalheria)"** — copia para o `list_price`

---

## 🛠️ Passo 2 — Colunas na Linha do Pedido de Venda (sale.order)

### 2.1 Abrir o Studio no Sale Order
1. No Odoo, vá em **Sales → Quotations** → abra um pedido
2. Clique no **ícone Studio** (sup. direito)
3. Na barra lateral → Views → modelo **Sale Order** (sale.order)
4. Clique em **Form** — abre o formulário do pedido no editor

### 2.2 Adicionar colunas na tree de linhas
1. No formulário, localize a **tabela de linhas** (a tree com Product, Quantity, Unit Price, etc.)
2. **Clique no cabeçalho da tree** (linha com os títulos das colunas) → escolha **"Add Column"**
3. Adicione estas colunas (uma por vez):
   - Float `Peso Ouro (g)` → `x_joa_peso_ouro_g`
   - Float `Custo Ouro/g` → `x_joa_custo_metal_g`
   - Float `Custo Pedras USD` → `x_joa_custo_pedras_usd`
   - Float `Mão de Obra` → `x_joa_custo_mao_obra`
   - Float `Custo Total` → `x_joa_custo_total_unit` → **Read Only**
   - Float `Markup %` → `x_joa_markup_pct`
   - Float `Preço Calc.` → `x_joa_preco_calculado_unit` → **Read Only**
   - Selection `Tipo Operação` → `x_joa_tipo_operacao`
4. **Save** no Studio

### 2.3 Testar
1. Saia do Studio (X)
2. Crie um novo **Pedido de Venda** ou abra um existente
3. Adicione uma linha com um produto que já tem composição de custo preenchida
4. Os campos da linha virão preenchidos **automaticamente do produto** (override)
5. Você pode **sobrescrever** qualquer campo (ex: subir pedras de 200 para 400 USD) só para essa venda

---

## 🛠️ Passo 3 — Colunas na Linha do Pedido de Compra (purchase.order)

### 3.1 Abrir o Studio no Purchase Order
1. Vá em **Purchase → Orders** → abra um pedido
2. Clique no **ícone Studio**
3. Barra lateral → Views → modelo **Purchase Order** (purchase.order)
4. Clique em **Form**

### 3.2 Adicionar colunas na tree
1. Localize a **tabela de linhas**
2. **Add Column** para cada campo:
   - Float `Peso Ouro (g)` → `x_joa_peso_ouro_g`
   - Float `Custo Ouro/g` → `x_joa_custo_metal_g`
   - Float `Custo Pedras USD` → `x_joa_custo_pedras_usd`
   - Float `Mão de Obra` → `x_joa_custo_mao_obra`
   - Float `Custo Total` → `x_joa_custo_total_unit` → **Read Only**
   - Selection `Tipo Operação` → `x_joa_tipo_operacao` (Compra Interna/Importação/Compra Sucata)
3. **Save** no Studio

### 3.3 Testar
1. Saia do Studio
2. Abra um **Pedido de Compra** novo
3. Adicione uma linha com produto que tem composição de custo
4. Os campos virão preenchidos do produto (override)
5. Marque o **Tipo de Operação** conforme: `compra_interna`, `importacao`, ou `compra_sucata` (cliente paga com ouro usado)

---

## ✅ Checklist final

Depois dos 3 passos, rode o check-status para confirmar:

```bash
ODOO_URL=https://fiscal-cloud-joalherias.odoo.com \
ODOO_DB=fiscal-cloud-joalherias \
ODOO_USER=marcus@nytro.com.br \
ODOO_API_KEY=6ec876e680e4f43fe94645c05ca6097c65e80f2d \
python3 odoo-scripts/check-status.py
```

Na seção **VIEWS CUSTOMIZADAS**, deve aparecer:
```
Total: 5+ views customizadas
  id=3913 | Odoo Studio: account.move.form customization
  id=3928 | Odoo Studio: res.company.form customization
  id=XXXX | Odoo Studio: product.template.form customization
  id=XXXX | Odoo Studio: sale.order.form customization
  id=XXXX | Odoo Studio: purchase.order.form customization

Modelos com aba NF-e já criada:
  ['account.move', 'product.template', 'purchase.order', 'res.company', 'sale.order']
✅ TODAS as abas criadas!
```

---

## 🆘 Problemas comuns

| Problema | Solução |
|---|---|
| **Studio não aparece** | Configurações → Usuários → Marcus → ative "Studio" |
| **Campo não aparece na lista do Studio** | O script `setup-pesos-custos-precos.py` não foi rodado. Rode primeiro. |
| **Botão "Emitir NF-e" não aparece nas Ações** | O script `setup-completo-odoo.py` não foi rodado. |
| **Custos não recalculam automaticamente** | Ação (engrenagem) → "Recalcular Custos (Joalheria)" — não é automático em tempo real |
| **Preço não atualiza no `list_price`** | Ação (engrenagem) → "Aplicar Preço Calculado (Joalheria)" |
| **Campos readonly** | Só os calculados (custo_metal_total, custo_pedras_brl, custo_total, preco_calculado). Os outros (peso, custos base, markup, moeda, exceção) são todos editáveis |

---

## 🔄 Rotina Resumida (depois de configurado)

**Cadastro de produto (1x):**
1. Abra o produto → aba **Composição de Custo** → preencha peso + custos
2. Aba **Formação de Preço** → preencha Markup
3. **Ação → Recalcular Custos** → calcula custo_total + preco_calculado
4. **Ação → Aplicar Preço Calculado** → copia para `list_price`

**Pedido de venda (diário):**
1. Novo Pedido → adicione linha de produto
2. Campos de composição vêm do produto automaticamente
3. **Override**: se cliente pediu algo diferente (ex: 2 pedras em vez de 1), ajuste só nessa linha
4. Confirme o pedido → gera fatura (account.move)
5. Na fatura → **Ação → Emitir NF-e** → middleware processa em 20s
6. Chatter da fatura mostra ✅ "NF-e Autorizada" + anexa XML + DANFE PDF

**Pedido de compra (semanal):**
1. Novo Pedido de Compra → adicione linha
2. Selecione **Tipo de Operação**: `compra_interna`, `importacao`, ou `compra_sucata`
3. Confirme → Receive Products → Create Bill
4. Estoque de ouro/materiais atualizado
