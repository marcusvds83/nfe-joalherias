# 📐 Passo 3 — Criar Views via Studio (mínimo) + Script Preenche Campos

> 🎉 **Descoberta importante:** O SaaS Trial bloqueia `create` em `ir.ui.view` via XML-RPC, MAS **permite `write` em views existentes** (incluindo as criadas pelo Studio).

## ✅ Estratégia definitiva (5 minutos, 3 cliques por modelo)

1. Você cria **3 views vazias** no Studio (uma por modelo)
2. Roda o script Python `setup-views-completo.py` que faz `write` nessas views, preenchendo TODOS os campos automaticamente

## 📊 Status atual

| Modelo | Status |
|---|---|
| `account.move` (Fatura/Financeiro) | ✅ PREENCHIDO pelo script (id=3913) |
| `res.company` (Empresa) | ✅ PREENCHIDO pelo script (id=3928) |
| `product.template` (Produto) | ❌ Você precisa criar view vazia |
| `sale.order` (Pedido de Venda) | ❌ Você precisa criar view vazia |
| `purchase.order` (Pedido de Compra) | ❌ Você precisa criar view vazia |

---

## 🛠️ Passo a passo: Criar View Vazia via Studio (3 cliques)

Repita este processo para CADA um dos 3 modelos que faltam.

### Para o Produto (product.template)

1. No Odoo, vá em **Master Data → Products** → abra qualquer produto
2. Clique no ícone **Studio** (canto superior direito)
3. Na barra lateral esquerda do Studio, clique em **"Views"**
4. Selecione o modelo **Product** (product.template)
5. Clique em **"Form"**
6. **Adicione um campo qualquer** (só para criar a view customizada):
   - Clique em qualquer campo do formulário → escolha "Char" → renomeie para "stub"
   - No painel direito, em "Field", escolha qualquer campo (ex: `x_joa_peso_ouro_g`)
   - **Importante:** Marque `optional="hide"` se possível (mas Studio geralmente permite apenas `show`)
7. Clique em **Save** (botão azul no topo do Studio)
8. Clique no **X** no canto superior direito para sair do Studio

### Para o Pedido de Venda (sale.order)

1. Vá em **Sales → Quotations** → abra uma cotação
2. Ícone **Studio**
3. Views → **Sale Order** (sale.order) → Form
4. Adicione campo stub → Save → saia do Studio

### Para o Pedido de Compra (purchase.order)

1. Vá em **Purchase → Orders** → abra um pedido
2. Ícone **Studio**
3. Views → **Purchase Order** (purchase.order) → Form
4. Adicione campo stub → Save → saia do Studio

---

## 🚀 Passo final: Rodar o script

Depois de criar as 3 views vazias, rode:

```bash
ODOO_URL=https://fiscal-cloud-joalherias.odoo.com \
  ODOO_DB=fiscal-cloud-joalherias \
  ODOO_USER=marcus@nytro.com.br \
  ODOO_API_KEY=6ec876e680e4f43fe94645c05ca6097c65e80f2d \
  python3 odoo-scripts/setup-views-completo.py
```

O script vai:

1. Para cada modelo (`product.template`, `sale.order`, `purchase.order`):
   - Procurar a view do Studio (nome começa com `Odoo Studio:`)
   - Fazer `write` no `arch_db` substituindo o conteúdo antigo por TODOS os campos joalheiros
2. Reportar o status final

### Exemplo de saída esperada:

```
1/5 - product.template (Produto)
✅ product.template: VIEW ATUALIZADA (id=XXXX)

2/5 - account.move (Fatura)
✅ account.move: VIEW ATUALIZADA (id=3913)

3/5 - res.company (Empresa)
✅ res.company: VIEW ATUALIZADA (id=3928)

4/5 - sale.order (Pedido de Venda)
✅ sale.order: VIEW ATUALIZADA (id=XXXX)

5/5 - purchase.order (Pedido de Compra)
✅ purchase.order: VIEW ATUALIZADA (id=XXXX)

Views do Studio encontradas:
  ✅ product.template
  ✅ account.move
  ✅ res.company
  ✅ sale.order
  ✅ purchase.order
```

---

## 📝 O que o script preenche em cada modelo

### `product.template` — 3 abas criadas

**Aba "Composição de Custo"** (com 3 grupos):
- Grupo "Metal (Ouro)": `x_joa_peso_ouro_g`, `x_joa_peso_ouro_kg`, `x_joa_custo_metal_g`, `x_joa_custo_metal_total` (readonly)
- Grupo "Pedras": `x_joa_custo_pedras_usd`, `x_joa_cotacao_usd_brl`, `x_joa_custo_pedras_brl` (readonly)
- Grupo "Mão de Obra": `x_joa_custo_mao_obra`

**Aba "Formação de Preço"**:
- `x_joa_custo_total` (readonly), `x_joa_moeda_ref` (selection)
- `x_joa_markup_pct` (editável!), `x_joa_preco_calculado` (readonly)
- `x_joa_excecao_fiscal_uf`, `x_joa_aliquota_icms_especial`

**Aba "NF-e Joalheria"**:
- `x_joalheria_ncm`, `x_joalheria_cfop`, `x_joalheria_descricao_nfe`, `x_joalheria_unidade_medida`, `x_joalheria_peso_ouro_kg`

### `account.move` — 1 aba "NF-e Joalheria"
- Grupo "Status NF-e": `x_joalheria_nfe_status` (readonly), `x_joalheria_nfe_tipo_operacao`, `x_joalheria_nfe_dh_emissao` (readonly)
- Grupo "Autorização SEFAZ": `x_joalheria_nfe_chave` (readonly), `x_joalheria_nfe_protocolo` (readonly)
- Grupo "Erros e Logs": `x_joalheria_nfe_erro` (readonly)
- Grupo "XML NF-e": `x_joalheria_nfe_xml` (readonly, widget ace)

### `res.company` — 1 aba "NF-e Joalheria"
- `x_joalheria_nfe_serie`, `x_joalheria_nfe_numero`, `x_joalheria_nfe_inscricao_estadual`

### `sale.order` — 8 colunas na tree das linhas
- `x_joa_peso_ouro_g`, `x_joa_custo_metal_g`, `x_joa_custo_pedras_usd`, `x_joa_custo_mao_obra`
- `x_joa_custo_total_unit` (readonly), `x_joa_markup_pct`, `x_joa_preco_calculado_unit` (readonly)
- `x_joa_tipo_operacao` (venda/remessa/retorno/exportação)

### `purchase.order` — 6 colunas na tree das linhas
- `x_joa_peso_ouro_g`, `x_joa_custo_metal_g`, `x_joa_custo_pedras_usd`, `x_joa_custo_mao_obra`
- `x_joa_custo_total_unit` (readonly), `x_joa_tipo_operacao` (compra_interna/importação/sucata)

---

## 🆘 Troubleshooting

| Problema | Solução |
|---|---|
| Script diz "SEM view do Studio" para um modelo | Você precisa criar a view vazia no Studio (3 cliques, tutorial acima) |
| View do Studio existe mas script falha | Faça logout/login no Odoo (cache) e rode novamente |
| Campos não aparecem na tela após rodar script | Faça logout/login no Odoo. Cache do navegador pode exigir Ctrl+F5 |
| Studio não aparece no ícone superior | Configurações → Usuários → Marcus → ative "Studio" |
| Erro de XPath no script | A view base do Studio pode estar diferente. Reporte o erro. |

---

## 📋 Após preencher tudo (validação)

Rode o `check-status.py` para confirmar:

```bash
ODOO_URL=https://fiscal-cloud-joalherias.odoo.com \
  ODOO_DB=fiscal-cloud-joalherias \
  ODOO_USER=marcus@nytro.com.br \
  ODOO_API_KEY=6ec876e680e4f43fe94645c05ca6097c65e80f2d \
  python3 odoo-scripts/check-status.py
```

Vai mostrar `✅ TODAS as abas criadas!` na seção VIEWS.

Depois, faça logout/login no Odoo e abra:
- Um produto → verá abas Composição de Custo + Formação de Preço + NF-e Joalheria
- Uma fatura → verá aba NF-e Joalheria com status/chave/protocolo/XML
- Um pedido de venda → verá colunas x_joa_* na tree
- Um pedido de compra → verá colunas x_joa_* na tree
