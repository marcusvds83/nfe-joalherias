#!/usr/bin/env python3
"""
odoo-scripts/setup-mgbp.py
==========================
Ajusta o Odoo para MGBP Brasil Importacao e Comercio LTDA.
(Importadora de ELETRODOMESTICOS - fogoes, cooktops, fornos)

Baseado nas 3 NFs de exemplo enviadas pela Cristiane Dutra:
  - NF 5515: venda para pessoa fisica (consumidor final) - CFOP 6108
  - NF 5560: venda para revenda (contribuinte) - CFOP 6102
  - NF 5573: entrega futura

DADOS DA MGBP:
  CNPJ: 20.728.251/0001-02
  IE: 9067039715
  End: Rua O Brasil para Cristo, 2756, Boqueirao, Curitiba - PR, CEP 81730-070
  Fone: (41) 3387-8889
  Regime: Lucro Presumido (CST 100, ICMS 4%, IPI 3,25%)
  NCM padrao: 85166000 (Aparelhos eletricos para cozinhar)

ESTOQUES (5+1):
  01 - Produto Acabado (Novo) -> PODE emitir NF
  02 - Canibalizado -> NAO pode
  03 - Venda no Estado -> PODE emitir NF
  04 - Showroom -> NAO pode
  05 - Homologacao -> NAO pode
  11 - Partes e Pecas -> PODE emitir NF

COMO USAR:
  ODOO_URL=https://fiscal-cloud-joalherias.odoo.com \\
  ODOO_DB=fiscal-cloud-joalherias \\
  ODOO_USER=marcus@nytro.com.br \\
  ODOO_API_KEY=297b... python3 odoo-scripts/setup-mgbp.py
"""

import os, sys, xmlrpc.client

ODOO_URL = os.environ.get('ODOO_URL', '').rstrip('/')
ODOO_DB = os.environ.get('ODOO_DB', '')
ODOO_USER = os.environ.get('ODOO_USER', '')
ODOO_API_KEY = os.environ.get('ODOO_API_KEY', '')

if not all([ODOO_URL, ODOO_DB, ODOO_API_KEY]):
    print('ERRO: Defina ODOO_URL, ODOO_DB, ODOO_USER e ODOO_API_KEY')
    sys.exit(1)
if not ODOO_USER:
    ODOO_USER = ODOO_API_KEY

print(f'Conectando em {ODOO_URL}...')
common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
uid = common.authenticate(ODOO_DB, ODOO_USER, ODOO_API_KEY, {})
if not uid:
    uid = common.authenticate(ODOO_DB, ODOO_API_KEY, ODOO_API_KEY, {})
if not uid:
    print('ERRO: Autenticacao falhou')
    sys.exit(1)
print(f'Autenticado! uid={uid}')

models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')

def kw(model, method, args=None, kwargs=None):
    return models.execute_kw(ODOO_DB, uid, ODOO_API_KEY, model, method, args or [], kwargs or {})

# ============================================================
# 1. ATUALIZAR EMPRESA MGBP
# ============================================================
print('\n' + '=' * 60)
print('1. Atualizar dados da empresa (Fiscal Cloud -> MGBP)')
print('=' * 60)

company_ids = kw('res.company', 'search', [[['id', '!=', 0]]])
for cid in company_ids:
    kw('res.company', 'write', [[cid], {
        'name': 'MGBP BRASIL IMPORTACAO E COMERCIO LTDA',
        'vat': '20728251000102',
        'street': 'Rua O Brasil para Cristo, 2756',
        'street2': 'Boqueirao',
        'city': 'Curitiba',
        'zip': '81730070',
        'phone': '(41) 3387-8889',
        # IE no campo company_registry (ou x_joalheria_nfe_inscricao_estadual)
        'x_joalheria_nfe_serie': '1',
        'x_joalheria_nfe_numero': 5573,  # ultimo numero emitido
        'x_joalheria_nfe_inscricao_estadual': '9067039715',
    }])
    print(f'  ✓ Empresa id={cid} atualizada para MGBP Brasil')

# ============================================================
# 2. CRIAR OS 6 ESTOQUES DA MGBP
# ============================================================
print('\n' + '=' * 60)
print('2. Criar estoques da MGBP (01-Acabado, 02-Canibalizado, etc)')
print('=' * 60)

estoques = [
    {'name': '01 - Produto Acabado (Novo)', 'code': 'MGBP/01', 'pode_nf': True},
    {'name': '02 - Canibalizado', 'code': 'MGBP/02', 'pode_nf': False},
    {'name': '03 - Venda no Estado', 'code': 'MGBP/03', 'pode_nf': True},
    {'name': '04 - Showroom', 'code': 'MGBP/04', 'pode_nf': False},
    {'name': '05 - Homologacao', 'code': 'MGBP/05', 'pode_nf': False},
    {'name': '11 - Partes e Pecas', 'code': 'MGBP/11', 'pode_nf': True},
]

# Busca o estoque parent (WH/Stock id=6 ou similar)
parent_ids = kw('stock.location', 'search', [[['usage', '=', 'internal'], ['name', '=', 'Stock']]])
parent_id = parent_ids[0] if parent_ids else None
print(f'  Estoque pai: id={parent_id}')

# Cria campo x_mgbp_pode_emitir_nf no stock.location
sl_ids = kw('ir.model', 'search', [[['model', '=', 'stock.location']]])
sl_id = sl_ids[0]
existing_field = kw('ir.model.fields', 'search', [[['model', '=', 'stock.location'], ['name', '=', 'x_mgbp_pode_emitir_nf']]])
if not existing_field:
    kw('ir.model.fields', 'create', [{
        'name': 'x_mgbp_pode_emitir_nf',
        'field_description': 'Pode Emitir NF-e (MGBP)',
        'ttype': 'boolean',
        'model_id': sl_id,
    }])
    print('  ✓ Campo x_mgbp_pode_emitir_nf criado no stock.location')
else:
    print('  = Campo x_mgbp_pode_emitir_nf ja existe')

for est in estoques:
    # Procura se ja existe
    existing = kw('stock.location', 'search', [[['name', '=', est['name']]]])
    if existing:
        # Atualiza
        kw('stock.location', 'write', [existing, {
            'usage': 'internal',
            'x_mgbp_pode_emitir_nf': est['pode_nf'],
        }])
        print(f'  ✓ Estoque "{est["name"]}" atualizado (id={existing[0]})')
    else:
        # Cria
        vals = {
            'name': est['name'],
            'usage': 'internal',
            'x_mgbp_pode_emitir_nf': est['pode_nf'],
        }
        if parent_id:
            vals['location_id'] = parent_id
        new_id = kw('stock.location', 'create', [vals])
        print(f'  ✓ Estoque "{est["name"]}" criado (id={new_id})')

# ============================================================
# 3. ATUALIZAR PRODUTOS EXISTENTES (NCM, CST, CFOP, IPI)
# ============================================================
print('\n' + '=' * 60)
print('3. Atualizar produtos existentes com dados MGBP')
print('=' * 60)

# Busca produtos existentes
pt_ids = kw('product.template', 'search', [[['id', '!=', 0]]])
print(f'  Total de produtos: {len(pt_ids)}')

for pid in pt_ids:
    p = kw('product.template', 'read', [[pid], ['name', 'x_joalheria_ncm', 'type']])[0]
    name = p.get('name') or ''
    
    # Atualiza NCM se vazio
    vals = {}
    if not p.get('x_joalheria_ncm'):
        vals['x_joalheria_ncm'] = '85166000'
    
    # Para produtos de joalheria (ouro), manter NCM 71131900
    if 'ouro' in name.lower() or 'alianca' in name.lower():
        vals['x_joalheria_ncm'] = '71131900'
    
    if vals:
        kw('product.template', 'write', [[pid], vals])
        print(f'  ✓ id={pid} "{name[:40]}" -> NCM={vals["x_joalheria_ncm"]}')

# ============================================================
# 4. ADICIONAR TIPO OPERACAO "ENTREGA FUTURA"
# ============================================================
print('\n' + '=' * 60)
print('4. Adicionar tipo operacao "Entrega Futura"')
print('=' * 60)

# Verifica se o campo x_joa_tipo_operacao no sale.order.line tem a opcao
# 'entrega_futura' e adiciona se nao tiver
sol_ids = kw('ir.model', 'search', [[['model', '=', 'sale.order.line']]])
sol_id = sol_ids[0]

# Le o campo x_joa_tipo_operacao
field_ids = kw('ir.model.fields', 'search', [[['model', '=', 'sale.order.line'], ['name', '=', 'x_joa_tipo_operacao']]])
if field_ids:
    field = kw('ir.model.fields', 'read', [field_ids, ['selection']])[0]
    current_selection = field.get('selection', '')
    print(f'  Selection atual: {current_selection[:200]}')
    
    # Adiciona entrega_futura se nao existir
    if 'entrega_futura' not in current_selection:
        new_selection = current_selection.rstrip("]")
        if new_selection.endswith(','):
            new_selection += " "
        elif not new_selection.endswith(','):
            new_selection += ','
        new_selection += "('entrega_futura','Entrega Futura')]"
        
        kw('ir.model.fields', 'write', [field_ids, {'selection': new_selection}])
        print(f'  ✓ Opcao "entrega_futura" adicionada ao x_joa_tipo_operacao')
    else:
        print(f'  = Opcao "entrega_futura" ja existe')
else:
    print('  ! Campo x_joa_tipo_operacao nao encontrado no sale.order.line')

# ============================================================
# 5. ATUALIZAR REGIME TRIBUTARIO PARA LUCRO PRESUMIDO
# ============================================================
print('\n' + '=' * 60)
print('5. Atualizar regime tributario para Lucro Presumido')
print('=' * 60)

# No Odoo, o regime e definido por empresa (res.company)
# Atualiza os campos customizados x_joa_* se existirem
for cid in company_ids:
    # Verifica se existe campo de regime no res.company
    regime_field = kw('ir.model.fields', 'search', [
        [['model', '=', 'res.company'], ['name', '=', 'x_joa_regime_tributario']]
    ])
    if not regime_field:
        kw('ir.model.fields', 'create', [{
            'name': 'x_joa_regime_tributario',
            'field_description': 'Regime Tributario (Joalheria)',
            'ttype': 'selection',
            'selection': "[('simples_nacional','Simples Nacional'),('lucro_presumido','Lucro Presumido'),('lucro_real','Lucro Real')]",
            'model_id': kw('ir.model', 'search', [[['model', '=', 'res.company']]])[0],
        }])
        print('  ✓ Campo x_joa_regime_tributario criado no res.company')
    
    # Atualiza regime
    kw('res.company', 'write', [[cid], {'x_joa_regime_tributario': 'lucro_presumido'}])
    print(f'  ✓ Empresa id={cid} -> regime = lucro_presumido')

# ============================================================
# 6. CONFIGURAR PRODUTOS PARA MGBP (CST 100, ICMS 4%, IPI 3.25%)
# ============================================================
print('\n' + '=' * 60)
print('6. Configurar CST e aliquotas para MGBP (Lucro Presumido)')
print('=' * 60)

# Atualiza x_joa_aliquota_icms_especial = 4.0 para todos produtos
for pid in pt_ids:
    p = kw('product.template', 'read', [[pid], ['name', 'x_joa_aliquota_icms_especial']])[0]
    if not p.get('x_joa_aliquota_icms_especial'):
        kw('product.template', 'write', [[pid], {
            'x_joa_aliquota_icms_especial': 4.0,
            'x_joa_excecao_fiscal_uf': 'PR',  # UF do emitente
        }])
        name = p.get('name') or '?'
        print(f'  ✓ {name[:40]} -> ICMS=4% (interestadual importados)')

# ============================================================
# RELATORIO FINAL
print('\n' + '=' * 60)
print('RESUMO FINAL - MGBP Brasil')
print('=' * 60)
print(f'''
EMPRESA:
  Nome: MGBP BRASIL IMPORTACAO E COMERCIO LTDA
  CNPJ: 20.728.251/0001-02
  IE: 9067039715
  Endereco: Rua O Brasil para Cristo, 2756, Boqueirao, Curitiba - PR
  CEP: 81730-070
  Fone: (41) 3387-8889
  Regime: Lucro Presumido
  Serie NF-e: 1
  Ultimo numero: 5573

ESTOQUES (6 criados):
  01 - Produto Acabado (Novo)   -> PODE emitir NF
  02 - Canibalizado             -> NAO pode
  03 - Venda no Estado          -> PODE emitir NF
  04 - Showroom                 -> NAO pode
  05 - Homologacao              -> NAO pode
  11 - Partes e Pecas           -> PODE emitir NF

TIPOS DE OPERACAO (no sale.order.line):
  - venda (CFOP 5101/6101)
  - remessa_industrializacao (5901)
  - retorno_industrializacao (1910)
  - exportacao (7101)
  - entrega_futura (NOVO - baseado na NF 5573)

PRODUTOS:
  - NCM padrao: 85166000 (Aparelhos eletricos para cozinhar)
  - NCM joalheria: 71131900 (Artigos de joalheria)
  - CST: 100 (tributado integralmente - Lucro Presumido)
  - ICMS: 4% (interestadual produtos importados)
  - IPI: 3,25%

ALIQUOTAS CONFIGURADAS:
  - x_joa_aliquota_icms_especial = 4.0
  - x_joa_excecao_fiscal_uf = PR

PROXIMOS PASSOS:
  1. No middleware (Render): mudar env var JOALHERIA_REGIME_TRIBUTARIO
     de 'simples_nacional' para 'lucro_presumido'
  2. Fazer Manual Deploy no Render
  3. Cadastrar produtos reais da MGBP (cooktops, fogoes, fornos)
     com NCM=85166000, CST=100, ICMS=4%, IPI=3,25%
  4. Criar parceiros (CA COMERCIAL, CRISTINNE, ESCALA GLOBAL)
  5. Criar pedido de venda -> fatura -> Emitir NF-e
''')
