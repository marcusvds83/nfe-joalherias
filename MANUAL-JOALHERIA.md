# 📖 Manual Joalheiro — Como trabalhar com o Odoo

Documentação completa de como usar o Odoo da Joalheria (fiscal-cloud-joalherias.odoo.com) com o sistema NF-e Joalherias.

---

## 🎯 Resumo do que está configurado

### Campos customizados (74 campos)
- **`product.template`** (19 campos): peso, custos, markup, preço calculado, NCM, CFOP, etc.
- **`product.product`** (variant, herda do template)
- **`sale.order.line`** (11 campos): peso, custos, markup, tipo operação — override por linha
- **`purchase.order.line`** (9 campos): peso, custos, tipo operação
- **`account.move`** (7 campos): status NF-e, chave, protocolo, XML, erro
- **`res.company`** (3 campos): série, número, IE

### Views (abas/colunas) criadas direto nas views base
- ✅ Produto: 3 abas (Composição de Custo + Formação de Preço + NF-e Joalheria)
- ✅ Fatura: aba NF-e Joalheria
- ✅ Empresa: aba NF-e Joalheria
- ✅ Pedido de Venda: 8 colunas x_joa_* na tree das linhas
- ✅ Pedido de Compra: 6 colunas x_joa_* na tree das linhas

### Server Actions (4) + Automations (2)

**Server Actions manuais:**
- ✅ "Emitir NF-e" (vinculada ao menu Ação das faturas)
- ✅ "Cancelar NF-e"

**Server Actions automáticas (vinculadas a automations):**
- ✅ "Recalcular Custos" — **executa automaticamente ao SALVAR produto**
- ✅ "Aplicar Preço Calculado" — **executa automaticamente ao SALVAR produto**

### Rota `/admin` no middleware
Acesse: `https://nfe-joalherias.onrender.com/admin` → redireciona para o painel

---

## 💰 Rotina 1 — Cadastro de Produto com Composição de Custo

### Cenário: Anel Ouro 18k com 1 diamante

1. Vá em **Master Data → Products → New**
2. Preencha o nome: `Anel Ouro 18k c/ Diamante`
3. Vá na aba **"Composição de Custo"** (depois da aba Inventory):
   - **Peso Ouro (g)**: `5` (5g de ouro 18k)
   - **Custo Ouro/g (BRL)**: `350.00` (R$ 350 o grama)
   - **Custo Pedras (USD)**: `200.00` (US$ 200 no diamante)
   - **Cotação USD/BRL**: `5.20`
   - **Custo Mão de Obra (BRL)**: `150.00` (ourives)
4. Vá na aba **"Formação de Preço"**:
   - **Moeda Referência**: `BRL`
   - **Markup (%)**: `100` (100% de margem)
5. Clique em **SALVAR** (botão no topo)

### ✨ O que acontece AUTOMATICAMENTE ao salvar:

| Campo calculado | Fórmula | Resultado |
|---|---|---|
| `custo_metal_total` | 5 × 350 | R$ 1.750,00 |
| `custo_pedras_brl` | 200 × 5.20 | R$ 1.040,00 |
| `custo_total` | 1750 + 1040 + 150 | **R$ 2.940,00** |
| `preco_calculado` | 2940 × (1 + 100/100) | **R$ 5.880,00** |
| `list_price` (preço de venda) | = preco_calculado | **R$ 5.880,00** |

Olhe no canto superior direito do formulário → **Preço: R$ 5.880,00** (já atualizado).

---

## 🛒 Rotina 2 — Pedido de Venda (com override por linha)

### Cenário: Venda do anel acima, mas cliente quer 2 diamantes

1. Vá em **Sales → Quotations → New**
2. Cliente: `Isabel Oliveira`
3. Adicione linha → produto `Anel Ouro 18k c/ Diamante` → quantidade `1`
4. **Veja as colunas joalheiras na tree das linhas** (canto direito, role para o lado):
   - `Peso Ouro (g)` = `5` (veio do produto)
   - `Custo Ouro/g` = `350` (veio do produto)
   - `Custo Pedras USD` = `400` ← **OVERRIDE** (cliente pediu 2 diamantes)
   - `Custo Mão de Obra` = `150`
   - `Custo Total` = calculado automaticamente
   - `Markup %` = `120` ← **OVERRIDE** (cliente premium, margem maior)
   - `Preço Calc.` = calculado
   - `Tipo Operação` = `Venda` (default)

> 💡 **Override** = você ajusta o valor SÓ NESSA LINHA, sem alterar o cadastro do produto

5. Salve o pedido
6. O `price_unit` da linha deve vir do `preco_calculado` (pode ajustar manualmente se quiser)
7. **Confirme** o pedido (botão Confirm no topo)

### Tipos de Operação (campo `x_joa_tipo_operacao` na linha):

| Tipo | CFOP | Quando usar |
|---|---|---|
| `Venda` | 5101 (interno) / 6101 (interestadual) | Venda normal |
| `Remessa Industrialização` | 5901 | Cliente fornece ouro, paga só mão de obra |
| `Retorno Industrialização` | 1910 | Joias prontas voltam para o cliente |
| `Exportação` | 7101 | Cliente no exterior |

---

## 📋 Rotina 3 — Faturamento e Emissão de NF-e

### Da venda confirmada à NF-e autorizada

1. Pedido de venda confirmado → gera fatura (account.move)
2. Vá em **Accounting → Customers → Invoices**
3. Abra a fatura gerada
4. Clique no botão **"Confirm"** (postar a fatura)
5. Vá na aba **"NF-e Joalheria"** (depois da aba "Other Info"):
   - Status NF-e: vazio
   - Tipo Operação: `Venda` (herdado do pedido)
6. **Ação (engrenagem no topo) → "Emitir NF-e"**
7. Status NF-e muda para `pendente`
8. O middleware Render detecta via polling (20s) e processa:
   - Lê dados da fatura + linhas + produtos + empresa + parceiro
   - Gera XML NF-e 4.00
   - Assina com certificado A1 (RSA-SHA1)
   - Envia para SEFAZ (mTLS + SOAP 1.2)
   - Gera DANFE PDF (PDFKit + Code128)
   - Anexa XML + PDF no chatter da fatura
9. Status NF-e muda para `autorizada`
10. Aba NF-e Joalheria mostra:
    - Status: `autorizada`
    - Chave: 44 dígitos
    - Protocolo: número SEFAZ
    - Data Emissão: timestamp
    - XML: nfeProc completo (widget `ace` para visualizar/copy)
11. Anexos no chatter: `NFe-<chave>.xml` + `DANFE-<numero>.pdf`

### Para cancelar uma NF-e autorizada
1. Abra a fatura com status `autorizada`
2. **Ação → "Cancelar NF-e"**
3. Middleware envia evento de cancelamento para SEFAZ
4. Status muda para `cancelada`

---

## 🛒 Rotina 4 — Pedido de Compra

### Cenário 1: Compra de matéria-prima (ouro bruto)

1. Vá em **Purchase → Orders → New**
2. Fornecedor: `Fornecedor Ouro LTDA`
3. Adicione linha → produto `Ouro 18k (matéria-prima)` → quantidade `100` (gramas)
4. Preço unitário: `R$ 350,00`
5. Veja as colunas joalheiras:
   - `Peso Ouro (g)` = `100` (quantidade comprada)
   - `Custo Metal (g)` = `350` (preço do ouro bruto)
   - `Tipo Operação` = `Compra Interna`
6. **Confirm Order** → Receive Products → Create Bill

### Cenário 2: Compra com sucata (cliente paga com ouro usado)

1. Cliente traz 3 anéis velhos (15g de ouro) para trocar por joia nova
2. Crie **Purchase Order** para "Cliente X (fornecedor)"
3. Linha: produto `Ouro Sucata` → quantidade `15` (gramas) → preço `R$ 350`
4. **Tipo Operação**: `Compra Sucata` (cliente paga com ouro usado)
5. Total: R$ 5.250 (valor creditado para o cliente)
6. Na fatura final da joia nova, abate esse valor → ouro como produto-moeda (Lei 7.766/89)

### Cenário 3: Importação

1. Fornecedor: `Diamond Supplier (HK)`
2. Tipo Operação: `Importação`
3. Moeda: USD
4. Custo Pedras (USD): `2000.00`
5. Cotação USD/BRL: `5.20` → custo = R$ 10.400

### ❓ Custos da compra atualizam o custo do produto automaticamente?

**NÃO ainda.** Por padrão, quando você confirma um pedido de compra, o Odoo só atualiza o `standard_price` (custo) do produto se você usar a opção `Costing Method = FIFO/AVG` e estiver com inventory valuation configurado.

**Os campos x_joa_* (peso, custo pedras, etc.) NÃO sincronizam automaticamente com o product.template.** Isso é uma feature futura (roadmap).

Workaround manual:
- Após confirmar compra, abra o produto e atualize a aba Composição de Custo manualmente com os novos valores

---

## 📊 Respostas diretas às suas perguntas

### 1. "A composição do custo do produto, ao alterar na aba de composição deve, ao salvar, imediatamente compor o preço de venda do produto"

✅ **FEITO!** Criei 2 automações (`base.automation`) que executam ao salvar:
- Recalcular Custos → preenche custo_metal_total, custo_pedras_brl, custo_total, preco_calculado
- Aplicar Preço Calculado → copia `preco_calculado` para `list_price` (preço de venda)

### 2. "Apareça na linha do pedido de venda também"

✅ **FEITO!** 8 colunas joalheiras na tree das linhas do sale.order:
- Peso Ouro (g), Custo Ouro/g, Custo Pedras USD, Custo Mão de Obra
- Custo Total (readonly), Markup %, Preço Calc. (readonly), Tipo Operação

### 3. "Preciso que apareçam informações no pedido de venda para o vendedor"

✅ **FEITO!** O vendedor vê todas as colunas joalheiras na tree. Pode fazer override dos valores por linha (sem alterar o cadastro do produto).

### 4. "Vi no compras que os campos estão lá.. isso vai diretamente estar ligado no custo do produto já?"

❌ **Não automaticamente.** Os campos `x_joa_*` na purchase.order.line são **independentes** do product.template. Para sincronizar custo de compra → custo do produto, precisaria de uma automation adicional (roadmap futuro).

Workaround: após confirmar compra, abra o produto e atualize a aba Composição de Custo manualmente.

---

## 🔧 Configurações pendentes (você precisa fazer 1x)

### Empresa (1 min)
1. Vá em **Settings → Companies → Fiscal Cloud Joalherias**
2. Aba **"NF-e Joalheria"**:
   - **Série NF-e**: `1`
   - **Último Número**: `0` (vai incrementar a cada emissão)
   - **Inscrição Estadual**: IE real da empresa (somente dígitos)
3. Verifique/complete também:
   - **CNPJ** (campo `vat`): CNPJ real da empresa
   - **Endereço completo**: street, number, district, city, state, CEP, country
4. Salve

### Render (pendente)
- Você mencionou que vai me passar as credenciais do Render
- Confirmado: deploy está no ar mas retorna HTTP 502 (Bad Gateway)
- Quando você me passar acesso, debugo o build/start command

### Certificado A1 (pendente)
- Acesse o painel do middleware (quando Render estiver OK)
- Faça upload do `.pfx` na aba Setup
- Teste a conexão SEFAZ (deve retornar `cStat 107` = online)

---

## 🚀 Fluxo operacional diário (resumo)

```
[Manhã]
  1. Vendedor cria pedidos de venda com override de custos/markup por linha
  2. Gerente aprova e confirma pedidos → geram faturas

[Tarde]
  3. Operador fiscal clica "Emitir NF-e" em cada fatura (ou usa dashboard do middleware)
  4. Middleware (Render) processa em 20s por fatura
  5. DANFE PDF + XML chegam no chatter da fatura
  6. Status muda para "autorizada"

[Final do dia]
  7. Dashboard mostra: Total / Autorizadas / Pendentes / Erros
  8. Pendentes: verificar erros no chatter da fatura
  9. Canceladas: se rejeitadas pela SEFAZ, corrigir e reemitir
```

---

## 🆘 Troubleshooting

| Problema | Solução |
|---|---|
| Campos x_joa_* não aparecem na view | Faça logout/login no Odoo (cache). Se persistir, Ctrl+F5. |
| Preço não atualiza ao salvar produto | Verifique que preencheu peso + custo + markup. Automation só dispara se algum x_joa_* > 0. |
| Botão "Emitir NF-e" não aparece nas Ações | Rode `python3 odoo-scripts/setup-completo-odoo.py` |
| NF-e fica em "pendente" | Verifique se Render está no ar (curl /api/v1/health) e se certificado A1 está no Firebase |
| Erro `cStat 107` não vem | Verifique conexão SEFAZ na aba Setup do middleware |
| Erro `Access Denied` no login Odoo | Use a senha do usuário (não a API key no formulário web) |

---

## 📈 Roadmap futuro

Conforme iniciativa Loureiro & Associados x Odoo:

- [ ] **Sincronização Compra → Custo do Produto**: automation que ao confirmar compra, atualiza os campos x_joa_* do product.template
- [ ] **RFM (Recência, Frequência, Valor)** — segmentação automática de clientes
- [ ] **RFI (Recência, Frequência, Inventário)** — recomendação de derretimento de metal parado
- [ ] **Data Warehouse local** — "Pescador de Dados" extrai Odoo → DW para relatórios
- [ ] **Webhook pagamento** — quando cliente paga fatura → marcar como paga no Odoo
- [ ] **Integração parceiro fiscal** (Vinco/Cieg) como fallback de transmissão SEFAZ
- [ ] **POC Isabel Oliveira** — validar todos os fluxos no cliente piloto
