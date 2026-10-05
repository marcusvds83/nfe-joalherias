# Rotina do Usuário - Setor Joalheiro

Documentação completa de como usar o Odoo + Middleware NF-e Joalherias no dia a dia.

## 📋 Resumo dos Campos Criados no Odoo

### product.template (14 campos)

**Aba "Composição de Custo":**
| Campo | Tipo | Descrição |
|---|---|---|
| `x_joa_peso_ouro_g` | Float | Peso de ouro em gramas |
| `x_joa_peso_ouro_kg` | Float | Peso em quilos (para exportação) |
| `x_joa_custo_metal_g` | Float | Custo do grama de ouro (BRL) |
| `x_joa_custo_metal_total` | Float | Custo metal total (calculado) |
| `x_joa_custo_pedras_usd` | Float | Custo das pedras (USD) |
| `x_joa_cotacao_usd_brl` | Float | Cotação dólar para conversão |
| `x_joa_custo_pedras_brl` | Float | Custo pedras em reais (calculado) |
| `x_joa_custo_mao_obra` | Float | Custo mão de obra (BRL) |

**Aba "Formação de Preço":**
| Campo | Tipo | Descrição |
|---|---|---|
| `x_joa_custo_total` | Float | Soma dos 3 custos (calculado) |
| `x_joa_markup_pct` | Float | Margem aplicada sobre o custo (%) |
| `x_joa_preco_calculado` | Float | Preço sugerido (calculado) |
| `x_joa_moeda_ref` | Selection | Moeda de referência (BRL/USD/OURO) |
| `x_joa_excecao_fiscal_uf` | Char | UF com exceção fiscal |
| `x_joa_aliquota_icms_especial` | Float | Alíquota ICMS personalizada |

### sale.order.line (10 campos)
Mesmos campos de custo + `x_joa_tipo_operacao` (venda/remessa/retorno/exportação).
Permitem **override** por linha (sobrescreve o que veio do produto).

### purchase.order.line (9 campos)
Mesmos campos de custo + `x_joa_tipo_operacao` (compra_interna/importação/compra_sucata).

### Server Actions (2)
- **"Recalcular Custos (Joalheria)"** → disponível no menu Ação (engrenagem) do produto
- **"Aplicar Preço Calculado (Joalheria)"** → disponível no menu Ação (engrenagem) do produto

---

## 🛠️ Criando as Abas via Odoo Studio (Passo a Passo)

> ⚠️ **IMPORTANTE:** O script Python não conseguiu criar as views no Odoo SaaS 20 (restrição de sandbox). Você precisa criar via **Odoo Studio** (ferramenta visual nativa do Odoo Enterprise). É simples e demora 5 minutos.

### Passo 1: Acessar o Odoo Studio

1. Acesse https://fiscal-cloud-joalherias.odoo.com/web
2. No menu superior direito, clique no ícone **Studio** (ferramenta/escudo) — geralmente ao lado do avatar
3. Se não aparecer, vá em **Configurações → Studio** e ative

### Passo 2: Criar aba "Composição de Custo" no Produto

1. No Studio, à esquerda, selecione o modelo **Product / Template**
2. Clique no formulário do produto
3. Na barra superior do Studio, clique em **"New Tab"** (ou "+ Tab")
4. Renomeie a nova aba para **"Composição de Custo"**
5. Adicione os seguintes campos (drag-and-drop do tipo "Float"):
   - Grupo "Metal (Ouro)":
     - `x_joa_peso_ouro_g` (Peso Ouro g)
     - `x_joa_peso_ouro_kg` (Peso Ouro kg)
     - `x_joa_custo_metal_g` (Custo Ouro/g)
     - `x_joa_custo_metal_total` (Custo Metal Total — marcar "Read Only")
   - Grupo "Pedras":
     - `x_joa_custo_pedras_usd` (Custo Pedras USD)
     - `x_joa_cotacao_usd_brl` (Cotação USD/BRL)
     - `x_joa_custo_pedras_brl` (Custo Pedras BRL — Read Only)
   - Grupo "Mão de Obra":
     - `x_joa_custo_mao_obra` (Custo Mão de Obra)
6. Clique em **Save** no Studio

### Passo 3: Criar aba "Formação de Preço"

1. Adicione outra aba nova, renomeie para **"Formação de Preço"**
2. Adicione os campos:
   - Grupo "Custos":
     - `x_joa_custo_total` (Custo Total — Read Only)
     - `x_joa_moeda_ref` (Moeda Referência — Selection)
   - Grupo "Preço Final":
     - `x_joa_markup_pct` (Markup %)
     - `x_joa_preco_calculado` (Preço Calculado — Read Only)
3. Salve e saia do Studio

### Passo 4: Adicionar colunas no Pedido de Venda

1. Abra um Pedido de Venda
2. Clique no ícone Studio
3. Selecione modelo **Sale Order**
4. Vá na seção das linhas (order_line) → clique em **"Add Column"**
5. Selecione os campos:
   - `x_joa_peso_ouro_g`, `x_joa_custo_metal_g`, `x_joa_custo_pedras_usd`
   - `x_joa_custo_mao_obra`, `x_joa_custo_total_unit` (Read Only)
   - `x_joa_markup_pct`, `x_joa_preco_calculado_unit` (Read Only)
   - `x_joa_tipo_operacao`
6. Salve

### Passo 5: Mesmo no Pedido de Compra

Repita o Passo 4 no modelo **Purchase Order** (compra), mas sem o campo markup (que na compra é implícito no preço).

---

## 💰 Rotina: Formação de Preços (cadastro do produto)

### Cenário: Cadastrando um anel de ouro 18k com 1 diamante

1. **Vá em** Master Data → Products → crie novo produto "Anel Ouro 18k c/ Diamante"
2. **Aba "Composição de Custo":**
   - Peso Ouro (g): `5.0` (5 gramas de ouro)
   - Custo Ouro/g (BRL): `350.00` (R$ 350 o grama do ouro 18k)
   - *Custo Metal Total* calcula automaticamente = R$ 1.750,00
   - Custo Pedras (USD): `200.00` (US$ 200 no diamante)
   - Cotação USD/BRL: `5.20`
   - *Custo Pedras BRL* calcula = R$ 1.040,00
   - Custo Mão de Obra (BRL): `150.00` (ourives)

3. **Ação (engrenagem no topo) → "Recalcular Custos (Joalheria)"**
   - Sistema calcula: Custo Total = R$ 1.750 + R$ 1.040 + R$ 150 = **R$ 2.940,00**
   - Mensagem no chatter: "Custos recalculados"

4. **Aba "Formação de Preço":**
   - Markup (%): `100` (100% de margem)
   - *Preço Calculado* = R$ 2.940 × 2 = **R$ 5.880,00**

5. **Clique em "Aplicar Preço Calculado"** (ou Ação → Aplicar Preço Calculado)
   - `list_price` agora é R$ 5.880,00
   - Mensagem no chatter: "Preço aplicado: R$ 5.880,00"

6. **Pronto!** O produto está com preço calculado e salvo.

---

## 🛒 Rotina: Pedido de Venda (com override por linha)

### Cenário: Venda do anel acima, mas cliente quer 2 diamantes em vez de 1

1. **Vá em** Sales → crie novo Pedido de Venda
2. Selecione o cliente (ex: "Isabel Oliveira")
3. Adicione linha → produto "Anel Ouro 18k c/ Diamante"
4. Quantidade: `1`
5. **Aba dos campos customizados na linha:**
   - *Peso Ouro (g)*: `5.0` (veio do produto)
   - *Custo Pedras (USD)*: `400.00` ← **override** (cliente pediu 2 diamantes)
   - *Markup (%)*: `120` ← **override** (cliente premium, margem maior)
6. Salve o pedido
7. **Confirme** o pedido (botão Confirm)
8. Na fatura gerada (account.move), clique em **Ação → "Emitir NF-e"**
9. O middleware detecta `x_joalheria_nfe_status = pendente` e processa em ~20s
10. Chatter da fatura mostra: ✅ "NF-e Autorizada! Chave: ... Protocolo: ..."
11. Anexos no chatter: XML NF-e + DANFE PDF

> 💡 **Dica:** O override na linha **não altera** o cadastro do produto. É só para aquela venda específica.

---

## 🛒 Rotina: Pedido de Compra

### Cenário 1: Compra de matéria-prima (ouro bruto)

1. **Vá em** Purchase → crie novo Pedido de Compra
2. Fornecedor: "Fornecedor Ouro LTDA"
3. Adicione linha → produto "Ouro 18k (matéria-prima)"
4. Quantidade: `100` (gramas)
5. Preço unitário: `R$ 350,00`
6. **Aba campos customizados na linha:**
   - *Peso Ouro (g)*: `100` (100g comprados)
   - *Custo Metal (g)*: `350`
   - *Tipo Operação*: `compra_interna`
7. Confirme o pedido → Receive Products → Create Bill

### Cenário 2: Compra com sucata (cliente paga com ouro usado)

1. Cliente traz 3 anéis velhos (total 15g de ouro) para trocar por uma joia nova
2. Crie **Purchase Order** para "Cliente X (fornecedor)" — tipo de operação: `compra_sucata`
3. Linha: produto "Ouro Sucata" → quantidade `15` (gramas)
4. Preço unitário = `R$ 350,00` (preço do ouro bruto)
5. Total: R$ 5.250 (valor creditado para o cliente)
6. Na fatura final da joia nova, abate esse valor → ouro como produto-moeda (Lei 7.766/89)

### Cenário 3: Importação

1. Fornecedor: "Diamond Supplier (HK)"
2. Tipo de operação: `importacao`
3. Moeda: USD
4. Custo Pedras (USD): `2000.00`
5. Cotação USD/BRL: `5.20` → custo = R$ 10.400,00
6. II (Imposto Importação), IPI e ICMS são calculados pelo customs

---

## 📊 Rotina: Emissão de NF-e (final do ciclo)

### Venda normal
1. Pedido de venda confirmado → gera fatura (account.move)
2. Na fatura: **Ação → "Emitir NF-e"**
3. Status `x_joalheria_nfe_status` muda para `pendente`
4. Middleware (Render) detecta via polling (20s)
5. Lê dados da fatura + linhas + produtos + empresa + parceiro
6. Gera XML NF-e 4.00 com campos joalheiro (peso, custo, descrição)
7. Assina com certificado A1 (RSA-SHA1)
8. Envia para SEFAZ (mTLS + SOAP 1.2)
9. Recebe protocolo de autorização
10. Gera DANFE PDF (PDFKit + Code128)
11. Anexa XML + PDF no chatter da fatura
12. Atualiza status: `autorizada`

### Remessa para industrialização
1. Crie pedido de venda para o cliente que forneceu o ouro
2. Tipo de operação na linha: `remessa_industrializacao`
3. CFOP automático: `5901` (dentro do estado) ou `6901` (interestadual)
4. Emitir NF-e → XML vai com `<natOp>Remessa para industrialização</natOp>`

### Retorno de industrialização
1. Quando as joias estão prontas, crie nova fatura de retorno
2. Tipo de operação: `retorno_industrializacao`
3. CFOP: `1910`
4. XML vai com peso total das peças prontas

### Exportação
1. Cliente no exterior (res.partner com `country_id` diferente de Brasil)
2. Tipo de operação: `exportacao`
3. CFOP: `7101`
4. XML inclui detalhamento de peso de ouro em quilos no `infAdProd`
5. Isenção de ICMS conforme LC 87/2015

---

## 🔄 Fluxo Operacional Diário

```
[Manhã]
  1. Vendedor cria pedidos de venda com override de custos/markup
  2. Gerente aprova e confirma pedidos → geram faturas
  3. Faturas ficam com status NF-e = "vazio"

[Tarde]
  4. Operador fiscal clica "Emitir NF-e" em cada fatura (ou usa dashboard)
  5. Middleware (Render) processa em 20s por fatura
  6. DANFE PDF + XML chegam no chatter
  7. Status muda para "autorizada"

[Final do dia]
  8. Dashboard mostra: Total / Autorizadas / Pendentes / Erros / Canceladas
  9. Pendentes: verificar erros no chatter da fatura
  10. Canceladas: se rejeitadas pela SEFAZ, corrigir e reemitir
```

---

## 🚨 Tratamento de Erros

### SEFAZ rejeitou (status `erro` no Odoo)
1. Abra a fatura no Odoo
2. Chatter mostra: `cStat` + `xMotivo` da SEFAZ
3. Corrija o problema (ex: CFOP errado, NCM inválido, CNPJ do destinatário)
4. Ação → "Emitir NF-e" novamente

### Certificado A1 expirou
1. Renove na empresa certificadora (Soluti, etc)
2. Acesse o painel Render → aba Setup
3. Faça upload do novo .pfx
4. Middleware automaticamente recarrega do Firebase

### Odoo offline
1. Dashboard mostra "Odoo offline"
2. Verifique env vars no Render: `ODOO_URL`, `ODOO_DB`, `ODOO_USER`, `ODOO_API_KEY`
3. Verifique conexão Odoo no https://fiscal-cloud-joalherias.odoo.com

---

## 📈 Próximos Passos (Roadmap)

Conforme iniciativa Loureiro & Associados x Odoo:

- [ ] **RFM** — Classificação automática de clientes (Recência, Frequência, Valor Monetário)
- [ ] **RFI** — Recomendação de derretimento de joias paradas no estoque
- [ ] **Data Warehouse local** — "Pescador de Dados" extrai Odoo → DW para relatórios gerenciais
- [ ] **Webhook pagamento** — Receber webhook do banco quando cliente paga fatura → marcar como paga
- [ ] **Integração parceiro fiscal** — Vinco/Cieg como fallback de transmissão SEFAZ
- [ ] **POC Isabel Oliveira** — Validar todos os fluxos no cliente piloto
