/**
 * src/lib/nfe-emit.ts - Dispatcher de emissao NF-e (polling Odoo)
 * =====================================================================
 * Processa faturas pendentes no Odoo (campo x_joalheria_nfe_status =
 * 'pendente' ou 'processando'), gera o XML NF-e, assina com certificado A1,
 * envia para a SEFAZ, gera o DANFE PDF e atualiza o chatter do Odoo.
 *
 * Campos customizados no Odoo (account.move):
 *   x_joalheria_nfe_status         (vazio, pendente, processando, autorizada, cancelada, erro)
 *   x_joalheria_nfe_chave          (Char - chave 44 digitos)
 *   x_joalheria_nfe_protocolo      (Char - numero do protocolo)
 *   x_joalheria_nfe_xml             (Text - XML nfeProc)
 *   x_joalheria_nfe_erro            (Text - mensagem de erro)
 *   x_joalheria_nfe_dh_emissao     (Datetime)
 *   x_joalheria_nfe_tipo_operacao  (Selection: venda, remessa, retorno, exportacao)
 *
 * Campos customizados (res.company):
 *   x_joalheria_nfe_serie          (Char - default "1")
 *   x_joalheria_nfe_numero         (Integer - ultimo numero emitido)
 *
 * Campos customizados (product.product):
 *   x_joalheria_peso_ouro_kg       (Float - peso em kg para exportacao)
 *   x_joalheria_ncm                (Char - NCM especifico do produto)
 *   x_joalheria_cfop               (Char - CFOP default do produto)
 *   x_joalheria_descricao_nfe      (Text - descricao para a NF-e)
 */

import { config, odooConfigured } from './config';
import {
  authenticate,
  executeKw,
  search,
  read,
  write,
  filtrarCamposExistentes,
  descobrirCampoCnpj,
  extrairCnpj,
  uploadAnexo,
  invalidateUid,
} from './odoo-rpc';
import { gerarXmlNFe, type NFeData, type ProdutoData } from './nfe-xml';
import { autorizarNFe } from './sefaz-client';
import { gerarPdfDanfe } from './danfe-pdf';
import { carregarCertificado } from './firebase-cert';

// ============================================================
// Tipagem interna
// ============================================================

interface PollingResult {
  processed: number;
  sucesso: number;
  erro: number;
  detalhes: Array<{
    move_id: number;
    move_name?: string;
    sucesso: boolean;
    chave?: string;
    protocolo?: string;
    cStat?: string;
    xMotivo?: string;
    erro?: string;
  }>;
}

// ============================================================
// Helpers de endereco
// ============================================================

interface CompanyData {
  id: number;
  name: string;
  street?: string;
  street2?: string;
  city?: string;
  city_id?: [number, string];
  state_id?: [number, string];
  state?: string;
  zip?: string;
  phone?: string;
  email?: string;
  district?: string;
  country_id?: [number, string];
  vat?: string;
  company_registry?: string;
  cnpj_cpf?: string;
  [key: string]: unknown;
  _cnpj?: string;
  _cidade?: string;
  _uf?: string;
}

interface PartnerData {
  id: number;
  name: string;
  street?: string;
  street2?: string;
  city?: string;
  city_id?: [number, string];
  state_id?: [number, string];
  state?: string;
  zip?: string;
  phone?: string;
  email?: string;
  district?: string;
  country_id?: [number, string];
  vat?: string;
  cnpj_cpf?: string;
  legal_name?: string;
  [key: string]: unknown;
  _cnpj?: string;
  _cpf?: string;
  _cidade?: string;
  _uf?: string;
}

interface MoveData {
  id: number;
  name: string;
  partner_id: [number, string];
  company_id: [number, string];
  invoice_date?: string;
  amount_total: number;
  amount_untaxed: number;
  amount_tax: number;
  narration?: string;
  payment_reference?: string;
  invoice_line_ids: number[];
  [key: string]: unknown;
}

interface LineData {
  id: number;
  name?: string;
  quantity: number;
  price_unit: number;
  price_subtotal: number;
  product_id?: [number, string];
  tax_ids: number[];
  display_type?: string | boolean;
}

interface ProductData {
  id: number;
  name: string;
  default_code?: string;
  barcode?: string;
  weight?: number;
  [key: string]: unknown;
}

// ============================================================
// Processamento de emissões pendentes (polling)
// ============================================================

export async function processPendingEmissions(): Promise<PollingResult> {
  const result: PollingResult = { processed: 0, sucesso: 0, erro: 0, detalhes: [] };

  if (!odooConfigured()) {
    console.warn('[NFE-EMIT] Odoo nao configurado. Pulando polling.');
    return { ...result, processed: 0 } as any;
  }

  // Autentica
  let uid: number;
  try {
    uid = await authenticate();
  } catch (e) {
    console.error('[NFE-EMIT] Falha na autenticacao Odoo:', (e as Error).message);
    return { ...result, processed: 0 } as any;
  }

  // Busca faturas pendentes
  let moveIds: number[];
  try {
    moveIds = await search('account.move', [
      ['move_type', '=', 'out_invoice'],
      ['state', '=', 'posted'],
      ['x_joalheria_nfe_status', 'in', ['pendente', 'processando']],
    ]);
  } catch (e) {
    console.error('[NFE-EMIT] Erro ao buscar pendentes:', (e as Error).message);
    return { ...result, processed: 0 } as any;
  }

  if (!moveIds.length) {
    return result;
  }

  console.log(`[NFE-EMIT] ${moveIds.length} fatura(s) pendente(s).`);

  for (const moveId of moveIds) {
    try {
      const r = await emitirNfeOdoo(moveId);
      result.detalhes.push({
        move_id: moveId,
        sucesso: r.sucesso,
        chave: r.chave,
        protocolo: r.protocolo,
        cStat: r.cStat,
        xMotivo: r.xMotivo,
        erro: r.erro,
      });
      if (r.sucesso) result.sucesso++;
      else result.erro++;
      result.processed++;
    } catch (e) {
      console.error(`[NFE-EMIT] Erro move_id=${moveId}:`, (e as Error).message);
      await safeUpdateError(moveId, (e as Error).message);
      result.detalhes.push({
        move_id: moveId,
        sucesso: false,
        erro: (e as Error).message,
      });
      result.erro++;
      result.processed++;
    }
  }

  return result;
}

// ============================================================
// Emissao de uma fatura
// ============================================================

interface EmissionResult {
  sucesso: boolean;
  chave?: string;
  protocolo?: string;
  cStat?: string;
  xMotivo?: string;
  erro?: string;
}

export async function emitirNfeOdoo(moveId: number): Promise<EmissionResult> {
  // 1. Marca como processando
  await write('account.move', [moveId], {
    x_joalheria_nfe_status: 'processando',
  });

  // 2. Carrega certificado A1
  const cert = await carregarCertificado();
  if (!cert || (!cert.pfx && !cert.privateKeyPem)) {
    throw new Error(
      'Certificado A1 nao encontrado no Firebase. Faca upload via POST /api/v1/nfe/certificado'
    );
  }

  // 3. Descobre campos dinamicos
  const campoCnpjCompany = await descobrirCampoCnpj('res.company');
  const campoCnpjPartner = await descobrirCampoCnpj('res.partner');
  console.log(`[NFE-EMIT] CNPJ: company=${campoCnpjCompany} partner=${campoCnpjPartner}`);

  // 4. Leitura da fatura
  const moves = await read<MoveData>('account.move', [moveId], [
    'name', 'partner_id', 'company_id', 'invoice_date', 'amount_total', 'amount_untaxed',
    'amount_tax', 'narration', 'payment_reference', 'invoice_line_ids',
    'x_joalheria_nfe_tipo_operacao',
  ]);
  const move = moves[0];

  // 5. Leitura da empresa
  const camposCompanyDesejados = [
    'name', 'street', 'street2', 'city', 'city_id', 'state_id', 'state',
    'zip', 'phone', 'email', 'district', 'country_id', 'l10n_br_city_id',
    'company_registry', 'vat', 'website',
    'x_joalheria_nfe_serie', 'x_joalheria_nfe_numero',
    'x_joalheria_nfe_inscricao_estadual',
  ];
  const camposCompany = await filtrarCamposExistentes('res.company', camposCompanyDesejados);
  const companies = await read<CompanyData>('res.company', [move.company_id[0]], camposCompany);
  const company = companies[0];

  company._cnpj = extrairCnpj(company, campoCnpjCompany, '');
  if (company.city_id) {
    company._cidade = company.city_id[1] || '';
  } else if (company.city) {
    company._cidade = company.city;
  }
  if (company.state_id) {
    company._uf = company.state_id[1] || '';
  } else if (company.state) {
    company._uf = company.state;
  }

  console.log(
    `[NFE-EMIT] Empresa: ${company.name} CNPJ=${company._cnpj} Cidade=${company._cidade}/${company._uf}`
  );

  // 6. Leitura do parceiro
  const camposPartnerDesejados = [
    'name', 'street', 'street2', 'city', 'city_id', 'state_id', 'state',
    'zip', 'phone', 'email', 'district', 'country_id', 'country_code',
    'legal_name', 'company_name', 'vat', 'cnpj_cpf', 'l10n_br_city_id',
    'x_joalheria_cnpj',
  ];
  const camposPartner = await filtrarCamposExistentes('res.partner', camposPartnerDesejados);
  const partners = await read<PartnerData>('res.partner', [move.partner_id[0]], camposPartner);
  const partner = partners[0];

  // Distincao CNPJ vs CPF
  const cnpjPartner = extrairCnpj(partner, campoCnpjPartner, '');
  if (cnpjPartner.length === 11) {
    partner._cpf = cnpjPartner;
    partner._cnpj = '';
  } else {
    partner._cnpj = cnpjPartner;
    partner._cpf = '';
  }
  if (partner.city_id) {
    partner._cidade = partner.city_id[1] || '';
  } else if (partner.city) {
    partner._cidade = partner.city;
  }
  if (partner.state_id) {
    partner._uf = partner.state_id[1] || '';
  } else if (partner.state) {
    partner._uf = partner.state;
  }

  console.log(
    `[NFE-EMIT] Tomador: ${partner.name} CNPJ=${partner._cnpj} CPF=${partner._cpf} Cidade=${partner._cidade}/${partner._uf}`
  );

  // 7. Leitura das linhas
  const allLines = await read<LineData>('account.move.line', move.invoice_line_ids, [
    'name', 'quantity', 'price_unit', 'price_subtotal', 'product_id', 'tax_ids', 'display_type',
  ]);
  const serviceLines = allLines.filter((l) => !l.display_type && l.price_subtotal > 0);

  // 8. Leitura dos produtos (com campos customizados joalheria)
  const productIds = serviceLines
    .filter((l) => l.product_id)
    .map((l) => l.product_id![0])
    .filter(Boolean);
  const camposProdutoDesejados = [
    'name', 'default_code', 'barcode', 'weight',
    'x_joalheria_peso_ouro_kg', 'x_joalheria_ncm',
    'x_joalheria_cfop', 'x_joalheria_descricao_nfe',
    'x_joalheria_unidade_medida',
  ];
  const camposProduto = await filtrarCamposExistentes('product.product', camposProdutoDesejados);
  const products = productIds.length
    ? await read<ProductData>('product.product', productIds, camposProduto)
    : [];
  const productMap: Record<number, ProductData> = {};
  products.forEach((p) => { productMap[p.id] = p; });

  // 9. Incrementa numeracao na empresa
  const ultimoNumero = (company.x_joalheria_nfe_numero as number) || 0;
  const proximoNumero = ultimoNumero + 1;
  await write('res.company', [company.id], {
    x_joalheria_nfe_numero: proximoNumero,
  });

  // 10. Monta o tipo de operacao (default: venda)
  const tipoOperacaoRaw = (move.x_joalheria_nfe_tipo_operacao as string) || 'venda';
  const tipoOperacao = ['venda', 'remessa_industrializacao', 'retorno_industrializacao', 'exportacao']
    .includes(tipoOperacaoRaw) ? tipoOperacaoRaw as any : 'venda';

  // 11. Constroi a lista de produtos para a NF-e
  const produtos: ProdutoData[] = serviceLines.map((line, idx) => {
    const product = line.product_id ? productMap[line.product_id[0]] : null;
    const cfop = pickCfop(tipoOperacao, company._uf, partner._uf);
    return {
      nItem: idx + 1,
      cProd: product?.default_code || String(idx + 1).padStart(3, '0'),
      cEan: product?.barcode || 'SEM GTIN',
      xProd: (product?.x_joalheria_descricao_nfe as string) ||
              product?.name ||
              line.name ||
              'Produto sem descricao',
      ncm: (product?.x_joalheria_ncm as string) || config.joalheria.ouroCodigoNcm,
      cfop: cfop,
      uCom: (product?.x_joalheria_unidade_medida as string) || 'UND',
      qCom: line.quantity,
      vUnCom: line.price_unit,
      vProd: line.price_subtotal,
      pesoOuroKg: (product?.x_joalheria_peso_ouro_kg as number) || undefined,
    };
  });

  // 12. Monta dados do NFe
  const serie = (company.x_joalheria_nfe_serie as string) || config.nfe.seriePadrao;
  const dhEmi = new Date().toISOString();
  const totalNF = move.amount_total;

  const nfeData: NFeData = {
    emit: {
      cnpj: company._cnpj,
      xNome: company.name,
      xLgr: company.street,
      nro: company.street2,
      xBairro: (company.district as string),
      cMun: getMunicipioCode(company._cidade || '', company._uf || ''),
      xMun: company._cidade,
      uf: company._uf,
      cep: company.zip,
      cPais: '1058',
      xPais: 'Brasil',
      fone: company.phone,
      ie: (company.x_joalheria_nfe_inscricao_estadual as string) ||
           (company.company_registry as string),
    },
    dest: {
      cnpj: partner._cnpj,
      cpf: partner._cpf,
      xNome: partner.legal_name || partner.name,
      xLgr: partner.street,
      nro: partner.street2,
      xBairro: (partner.district as string),
      cMun: getMunicipioCode(partner._cidade || '', partner._uf || ''),
      xMun: partner._cidade,
      uf: partner._uf,
      cep: partner.zip,
      cPais: '1058',
      xPais: 'Brasil',
      fone: partner.phone,
      email: partner.email,
      ie: partner.vat,
    },
    produtos,
    serie,
    numero: proximoNumero,
    dhEmi,
    tipoOperacao,
  };

  console.log('=============================================================');
  console.log(`[NFE-EMIT] INICIO - Fatura ${move.name} (move_id=${moveId})`);
  console.log(`[NFE-EMIT]   nNF: ${proximoNumero} (ultimo=${ultimoNumero}) serie=${serie}`);
  console.log(`[NFE-EMIT]   Empresa: ${company.name} CNPJ=${company._cnpj}`);
  console.log(`[NFE-EMIT]   Dest: ${partner.name} CNPJ/CPF=${partner._cnpj || partner._cpf}`);
  console.log(`[NFE-EMIT]   Valor: R$ ${totalNF}`);
  console.log(`[NFE-EMIT]   Operacao: ${tipoOperacao}`);
  console.log(`[NFE-EMIT]   Ambiente: ${config.nfe.tpAmb === '2' ? 'HOMOLOGACAO' : 'PRODUCAO'}`);

  // 13. Gera XML NF-e
  console.log('[NFE-EMIT] Etapa 1/4: Gerando XML NF-e...');
  const xmlNFe = gerarXmlNFe(nfeData);
  console.log(`[NFE-EMIT] XML gerado: ${xmlNFe.length} bytes`);

  // 14. Assina e autoriza na SEFAZ
  console.log('[NFE-EMIT] Etapa 2/4: Assinando e autorizando na SEFAZ...');
  const resultado = await autorizarNFe(xmlNFe);
  console.log(
    `[NFE-EMIT] Etapa 3/4: Resultado SEFAZ: sucesso=${resultado.autorizada} | cStat=${resultado.cStat}`
  );

  if (resultado.autorizada && resultado.nfeProc) {
    // Atualiza Odoo com sucesso
    let dataEmissao = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const updateData: Record<string, unknown> = {
      x_joalheria_nfe_status: 'autorizada',
      x_joalheria_nfe_chave: resultado.chave,
      x_joalheria_nfe_protocolo: resultado.protocolo,
      x_joalheria_nfe_dh_emissao: dataEmissao,
      x_joalheria_nfe_erro: false,
    };
    if (resultado.nfeProc && resultado.nfeProc.length < 50000) {
      updateData.x_joalheria_nfe_xml = resultado.nfeProc;
    }
    await write('account.move', [moveId], updateData);

    // Mensagem no chatter
    await executeKw('mail.message', 'create', [{
      model: 'account.move',
      res_id: moveId,
      body: `<b>NF-e Autorizada!</b><br/>` +
            `Chave: ${resultado.chave}<br/>` +
            `Protocolo: ${resultado.protocolo}<br/>` +
            `cStat: ${resultado.cStat} - ${resultado.xMotivo}`,
      message_type: 'comment',
    }]);

    // Anexa XML no chatter
    try {
      const xmlNome = `NFe-${resultado.chave}.xml`;
      await uploadAnexo(
        'account.move', moveId,
        xmlNome,
        resultado.nfeProc,
        'application/xml',
        `<b>XML NF-e ${proximoNumero}</b>`
      );
    } catch (e) {
      console.error('[NFE-EMIT] Falha ao anexar XML:', (e as Error).message);
    }

    // Anexa DANFE PDF no chatter
    console.log('[NFE-EMIT] Etapa 4/4: Gerando DANFE PDF...');
    try {
      const danfeData = extrairDadosDanfe(resultado.nfeProc, nfeData, totalNF);
      const pdfBuf = await gerarPdfDanfe(danfeData);
      const pdfNome = `DANFE-${String(proximoNumero).padStart(6, '0')}.pdf`;
      await uploadAnexo(
        'account.move', moveId,
        pdfNome, pdfBuf, 'application/pdf',
        `<b>DANFE ${proximoNumero}</b>`
      );
    } catch (e) {
      console.error('[NFE-EMIT] Falha ao gerar/anexar DANFE:', (e as Error).message);
    }

    console.log(`[NFE-EMIT] NF-e ${proximoNumero} autorizada para ${move.name}`);
    return {
      sucesso: true,
      chave: resultado.chave,
      protocolo: resultado.protocolo,
      cStat: resultado.cStat,
      xMotivo: resultado.xMotivo,
    };
  } else {
    // Atualiza erro no Odoo
    const errMsg = `SEFAZ rejeitou: ${resultado.cStat || 's/cStat'} - ${resultado.xMotivo || 'sem motivo'}`;
    await safeUpdateError(moveId, errMsg);
    return {
      sucesso: false,
      chave: resultado.chave,
      cStat: resultado.cStat,
      xMotivo: resultado.xMotivo,
      erro: errMsg,
    };
  }
}

/** Atualiza fatura como erro e posta no chatter. */
async function safeUpdateError(moveId: number, errMsg: string) {
  try {
    await write('account.move', [moveId], {
      x_joalheria_nfe_status: config.nfe.statusOnError,
      x_joalheria_nfe_erro: errMsg.substring(0, 1000),
    });
    await executeKw('mail.message', 'create', [{
      model: 'account.move',
      res_id: moveId,
      body: `<b>Erro na Emissao de NF-e</b><br/>${errMsg.substring(0, 500)}`,
      message_type: 'comment',
    }]);
  } catch (e) {
    console.error('[NFE-EMIT] Falha ao registrar erro:', (e as Error).message);
  }
}

/** Pick CFOP baseado em tipo de operacao e UF origem/destino. */
function pickCfop(
  tipoOperacao: string,
  ufOrigem?: string,
  ufDestino?: string
): string {
  const cfopConfig = config.joalheria.cfop;
  if (tipoOperacao === 'remessa_industrializacao') {
    return cfopConfig.remessaIndustrializacao;
  }
  if (tipoOperacao === 'retorno_industrializacao') {
    return cfopConfig.retornoIndustrializacao;
  }
  if (tipoOperacao === 'exportacao') {
    return cfopConfig.exportacao;
  }
  // Venda: interna ou interestadual
  if (ufOrigem && ufDestino && ufOrigem === ufDestino) {
    return cfopConfig.vendaDentroEstado;
  }
  if (ufOrigem && ufDestino && ufOrigem !== ufDestino) {
    return cfopConfig.vendaForaEstado;
  }
  return cfopConfig.vendaDentroEstado;
}

/** Retorna o codigo IBGE (7 digitos) do municipio. */
function getMunicipioCode(cidade: string, uf: string): string {
  // Map minimo - em producao, usar tabela completa IBGE
  const map: Record<string, string> = {
    'Curitiba': '4106902',
    'Sao Paulo': '3550308',
    'Rio de Janeiro': '3304557',
    'Belo Horizonte': '3106200',
    'Porto Alegre': '4314902',
    'Florianopolis': '4205407',
  };
  return map[cidade] || '4106902';
}

/** Extrai dados para o DANFE a partir do XML autorizado. */
function extrairDadosDanfe(
  nfeProcXml: string,
  nfeData: NFeData,
  valorTotal: number
): import('./danfe-pdf').DanfeData {
  // Extrai do XML as tags principais
  function tag(name: string): string {
    const m = nfeProcXml.match(
      new RegExp('<' + name + '[^>]*>([\\s\\S]*?)<\\/' + name + '>', 'i')
    );
    return m ? m[1].trim() : '';
  }

  const chave = (nfeProcXml.match(/Id="(NFe\d{44})"/) || [])[1]?.slice(3) || '';
  const nNF = tag('nNF');
  const serie = tag('serie');
  const dhEmi = tag('dhEmi');
  const nProt = tag('nProt');

  return {
    chave,
    nNF,
    serie,
    dhEmi,
    emit: {
      nome: nfeData.emit.xNome || '',
      cnpj: nfeData.emit.cnpj || '',
      ie: nfeData.emit.ie,
      endereco: nfeData.emit.xLgr,
      cidade: nfeData.emit.xMun,
      uf: nfeData.emit.uf,
      cep: nfeData.emit.cep,
      fone: nfeData.emit.fone,
    },
    dest: nfeData.dest ? {
      nome: nfeData.dest.xNome || '',
      cnpj: nfeData.dest.cnpj,
      cpf: nfeData.dest.cpf,
      endereco: nfeData.dest.xLgr,
      cidade: nfeData.dest.xMun,
      uf: nfeData.dest.uf,
      cep: nfeData.dest.cep,
      fone: nfeData.dest.fone,
    } : undefined,
    valorTotal,
    produtos: nfeData.produtos.map((p) => ({
      codProd: p.cProd || '',
      descricao: p.xProd,
      ncm: p.ncm,
      cfop: p.cfop,
      unidade: p.uCom,
      quantidade: p.qCom,
      valorUnit: p.vUnCom,
      valorTotal: p.vProd,
    })),
    protocolo: nProt,
    dhAutorizacao: dhEmi,
    infCpl: '',
  };
}
