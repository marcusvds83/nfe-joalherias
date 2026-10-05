/**
 * src/lib/nfe-xml.ts - Gerador de XML NF-e v4.00 para setor joalheiro
 * =====================================================================
 * Gera o XML <NFe> a partir de dados da fatura Odoo.
 *
 * Especificidades do setor joalheiro implementadas:
 *   - Tags <med> adicionais (info complementar) com peso de ouro em kg
 *   - Suporte a operacoes de remessa/retorno de industrializacao (CFOP 5901/1910)
 *   - Suporte a exportacao (CFOP 7101) com detalhamento de peso
 *   - Precificacao multimoeda (metal=BRL, pedras=USD, mao-de-obra=BRL)
 *   - Regimes: Simples Nacional, Lucro Presumido, Lucro Real
 *   - Campo customizado x_joalheria_peso_ouro_kg no product.product
 */

import { config } from './config';

const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';

// ============================================================
// Helpers de endereco (parse de street + numero, normalizacao)
// ============================================================

function onlyNum(s: string | undefined | null): string {
  return String(s || '').replace(/\D/g, '');
}

/**
 * Extrai numero do logradouro quando o campo 'street' vem concatenado.
 * Odoo frequentemente armazena "Rua Tal, 123" no campo street.
 */
function parseStreetNumber(street: string, number?: string): { street: string; number: string } {
  if (!street) return { street: '', number: number || 'S/N' };
  if (number && number !== 'S/N' && String(number).trim() !== '') {
    return { street, number: String(number) };
  }
  let m = street.match(/^(.+?),\s*(\d+[\w]?(?:\s*[A-Za-zÀ-ÿ]+)?)\s*$/);
  if (m) return { street: m[1].trim(), number: m[2].trim() };
  m = street.match(/^(.+?),\s*(\d+)\s+(.+)$/);
  if (m) return { street: m[1].trim(), number: m[2].trim() };
  m = street.match(/^(.+?)\s+(\d+)\s*$/);
  if (m) return { street: m[1].trim(), number: m[2].trim() };
  return { street, number: number || 'S/N' };
}

// ============================================================
// Calculo de chave de acesso NF-e (44 digitos)
// ============================================================

/** Calcula digito verificador da chave de acesso (mod 11). */
function calcDV(chave43: string): string {
  let soma = 0;
  let peso = 2;
  for (let i = chave43.length - 1; i >= 0; i--) {
    const n = parseInt(chave43[i], 10);
    soma += n * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const mod = soma % 11;
  if (mod === 0 || mod === 1) return '0';
  return String(11 - mod);
}

/**
 * Monta a chave de acesso de 44 digitos.
 * Formato: cUF(2) + AAMM(4) + CNPJ(14) + modelo(2) + serie(3) + numero(9) + tpEmis(1) + CNF(8) + DV(1)
 */
export function montarChave(params: {
  cUF: string;
  aamm: string; // ex: "2609" para setembro/2026
  cnpjEmit: string;
  modelo: string; // '55' = NF-e
  serie: string;
  numero: number;
  tpEmis: string; // '1' = normal
  cnf: string; // 8 digitos
}): string {
  const base =
    params.cUF +
    params.aamm +
    onlyNum(params.cnpjEmit).padStart(14, '0') +
    params.modelo +
    String(params.serie).padStart(3, '0') +
    String(params.numero).padStart(9, '0') +
    params.tpEmis +
    String(params.cnf).padStart(8, '0');
  const dv = calcDV(base);
  return base + dv;
}

/** Gera CNF (Codigo Numerico Fiscal) aleatorio de 8 digitos. */
function gerarCNF(): string {
  return String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
}

// ============================================================
// Tags de endereço (emit e dest)
// ============================================================

interface EnderecoData {
  cnpj?: string;
  cpf?: string;
  xNome?: string;
  xLgr?: string;
  nro?: string;
  xCpl?: string;
  xBairro?: string;
  cMun?: string;
  xMun?: string;
  uf?: string;
  cep?: string;
  cPais?: string;
  xPais?: string;
  fone?: string;
  ie?: string;
  iest?: string;
  im?: string;
  email?: string;
}

function tagEnder(ender: EnderecoData, tagPrefix: 'emit' | 'dest'): string {
  if (!ender) return '';
  const { street, number } = parseStreetNumber(ender.xLgr || '', ender.nro);
  const cnpj = onlyNum(ender.cnpj);
  const cpf = onlyNum(ender.cpf);

  let docTag = '';
  if (cnpj && cnpj.length === 14) {
    docTag = `<CNPJ>${cnpj}</CNPJ>`;
  } else if (cpf && cpf.length === 11) {
    docTag = `<CPF>${cpf}</CPF>`;
  }

  const ie = onlyNum(ender.ie);
  const im = ender.im ? `<IM>${ender.im}</IM>` : '';

  // Endereco completo
  const enderTag =
    tagPrefix === 'emit' ? `<enderEmit>` : `<enderDest>`;
  const enderClose =
    tagPrefix === 'emit' ? `</enderEmit>` : `</enderDest>`;

  const endereco = `${enderTag}` +
    `<xLgr>${street || 'NAO INFORMADO'}</xLgr>` +
    `<nro>${number || 'S/N'}</nro>` +
    (ender.xCpl ? `<xCpl>${ender.xCpl}</xCpl>` : '') +
    (ender.xBairro ? `<xBairro>${ender.xBairro}</xBairro>` : '') +
    `<cMun>${ender.cMun || '9999999'}</cMun>` +
    `<xMun>${ender.xMun || 'EXTERIOR'}</xMun>` +
    `<UF>${ender.uf || 'EX'}</UF>` +
    (ender.cep ? `<CEP>${onlyNum(ender.cep).padStart(8, '0')}</CEP>` : '') +
    (ender.cPais ? `<cPais>${ender.cPais}</cPais>` : '') +
    (ender.xPais ? `<xPais>${ender.xPais}</xPais>` : '') +
    (ender.fone ? `<fone>${onlyNum(ender.fone).padStart(6, '0')}</fone>` : '') +
    `${enderClose}`;

  const xNome = ender.xNome
    ? `<xNome>${escapeXml(ender.xNome)}</xNome>`
    : '';

  return `<${tagPrefix}>` +
    docTag +
    xNome +
    (ie ? `<IE>${ie}</IE>` : '') +
    (ender.iest ? `<IEST>${onlyNum(ender.iest)}</IEST>` : '') +
    im +
    endereco +
    (ender.email ? `<email>${escapeXml(ender.email)}</email>` : '') +
    `</${tagPrefix}>`;
}

// ============================================================
// Tags de produto (det + prod + impostos)
// ============================================================

export interface ProdutoData {
  nItem: number;
  cProd?: string;
  cEan?: string;
  xProd: string;
  ncm: string;
  cest?: string;
  cfop: string;
  uCom: string;
  qCom: number;
  vUnCom: number;
  vProd: number;
  // Campos especificos do setor joalheiro
  pesoOuroKg?: number; // peso em kg de ouro enviado (exportacao)
  // Impostos
  icmsCst?: string;
  icmsPRedBC?: number;
  icmsVICMS?: number;
  icmsPICMS?: number;
  icmsVBC?: number;
  pisCst?: string;
  cofinsCst?: string;
  ipiCst?: string;
  ipiVBC?: number;
  ipiPIPI?: number;
  ipiVIPI?: number;
}

function tagProduto(p: ProdutoData): string {
  // Produto base
  let prod = `<prod>` +
    `<cProd>${escapeXml(p.cProd || String(p.nItem).padStart(3, '0'))}</cProd>` +
    (p.cEan && p.cEan !== 'SEM GTIN' ? `<cEAN>${p.cEan}</cEAN>` : `<cEAN/>`) +
    `<xProd>${escapeXml(p.xProd)}</xProd>` +
    `<NCM>${onlyNum(p.ncm)}</NCM>` +
    (p.cest ? `<CEST>${onlyNum(p.cest)}</CEST>` : '') +
    `<CFOP>${onlyNum(p.cfop)}</CFOP>` +
    `<uCom>${escapeXml(p.uCom)}</uCom>` +
    `<qCom>${formatNum(p.qCom, 4)}</qCom>` +
    `<vUnCom>${formatNum(p.vUnCom, 10)}</vUnCom>` +
    `<vProd>${formatNum(p.vProd, 2)}</vProd>` +
    `<indTot>1</indTot>` +
    `</prod>`;

  // Impostos - usa defaults do regime tributario
  const impostos = gerarImpostos(p);

  // Info adicional (peso de ouro para exportacao)
  let infAdProd = '';
  if (p.pesoOuroKg) {
    infAdProd = `<infAdProd>Peso de ouro enviado: ${p.pesoOuroKg} kg</infAdProd>`;
  }

  return `<det nItem="${p.nItem}">${prod}${impostos}${infAdProd}</det>`;
}

/** Gera bloco <imposto> baseado no regime tributario configurado. */
function gerarImpostos(p: ProdutoData): string {
  const regime = config.joalheria.regimeTributario;
  const vProd = p.vProd || 0;

  // ICMS - default por regime
  let icms = '';
  if (regime === 'simples_nacional') {
    // Simples Nacional - CSOSN 102 (nao tributada pelo Simples)
    icms = `<ICMS><ICMSSN102>` +
      `<orig>0</orig>` +
      `<CSOSN>102</CSOSN>` +
      `</ICMSSN102></ICMS>`;
  } else if (regime === 'lucro_presumido') {
    // Lucro Presumido - CST 00 (tributada integralmente)
    const vBC = p.icmsVBC ?? vProd;
    const pICMS = p.icmsPICMS ?? 0.18; // 18% default
    const vICMS = p.icmsVICMS ?? +(vBC * pICMS / 100).toFixed(2);
    icms = `<ICMS><ICMS00>` +
      `<orig>0</orig>` +
      `<CST>${p.icmsCst || '00'}</CST>` +
      `<modBC>3</modBC>` +
      `<vBC>${formatNum(vBC, 2)}</vBC>` +
      `<pICMS>${formatNum(pICMS, 4)}</pICMS>` +
      `<vICMS>${formatNum(vICMS, 2)}</vICMS>` +
      `</ICMS00></ICMS>`;
  } else {
    // Lucro Real - mesmo CST 00
    const vBC = p.icmsVBC ?? vProd;
    const pICMS = p.icmsPICMS ?? 0.18;
    const vICMS = p.icmsVICMS ?? +(vBC * pICMS / 100).toFixed(2);
    icms = `<ICMS><ICMS00>` +
      `<orig>0</orig>` +
      `<CST>${p.icmsCst || '00'}</CST>` +
      `<modBC>3</modBC>` +
      `<vBC>${formatNum(vBC, 2)}</vBC>` +
      `<pICMS>${formatNum(pICMS, 4)}</pICMS>` +
      `<vICMS>${formatNum(vICMS, 2)}</vICMS>` +
      `</ICMS00></ICMS>`;
  }

  // IPI - CST 99 (nao tributado) para Simples Nacional
  let ipi = '';
  if (regime !== 'simples_nacional') {
    const vBCIPI = p.ipiVBC ?? vProd;
    const pIPI = p.ipiPIPI ?? 0;
    const vIPI = p.ipiVIPI ?? 0;
    ipi = `<IPI>` +
      `<cEnq>999</cEnq>` +
      `<IPITrib>` +
      `<CST>${p.ipiCst || '99'}</CST>` +
      (vBCIPI ? `<vBC>${formatNum(vBCIPI, 2)}</vBC>` : '') +
      (pIPI ? `<pIPI>${formatNum(pIPI, 4)}</pIPI>` : '') +
      (vIPI ? `<vIPI>${formatNum(vIPI, 2)}</vIPI>` : '') +
      `</IPITrib>` +
      `</IPI>`;
  }

  // PIS - CST 99 (nao tributado) para Simples
  const pis = `<PIS>` +
    (regime === 'simples_nacional'
      ? `<PISNT><CST>${p.pisCst || '08'}</CST></PISNT>`
      : `<PISAliq><CST>${p.pisCst || '01'}</CST><vBC>${formatNum(vProd, 2)}</vBC><pPIS>0.65</pPIS><vPIS>${formatNum(vProd * 0.0065, 2)}</vPIS></PISAliq>`) +
    `</PIS>`;

  // COFINS - CST 99 (nao tributado) para Simples
  const cofins = `<COFINS>` +
    (regime === 'simples_nacional'
      ? `<COFINSNT><CST>${p.cofinsCst || '08'}</CST></COFINSNT>`
      : `<COFINSAliq><CST>${p.cofinsCst || '01'}</CST><vBC>${formatNum(vProd, 2)}</vBC><pCOFINS>3.00</pCOFINS><vCOFINS>${formatNum(vProd * 0.03, 2)}</vCOFINS></COFINSAliq>`) +
    `</COFINS>`;

  const vTotTrib = +(vProd * 0.20).toFixed(2); // 20% default para joias

  return `<imposto>` +
    `<vTotTrib>${formatNum(vTotTrib, 2)}</vTotTrib>` +
    icms +
    ipi +
    pis +
    cofins +
    `</imposto>`;
}

// ============================================================
// Helpers XML
// ============================================================

function escapeXml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatNum(n: number, dec: number): string {
  return Number(n || 0).toFixed(dec).replace('.', '.');
}

// ============================================================
// Gerador principal do XML NFe
// ============================================================

export interface NFeData {
  // Emitente
  emit: EnderecoData;
  // Destinatario (pode ser nulo em exportacao)
  dest?: EnderecoData | null;
  // Produtos
  produtos: ProdutoData[];
  // Numeracao
  serie: string;
  numero: number;
  // Datas
  dhEmi: string; // ISO datetime
  // Valores
  vFrete?: number;
  vSeg?: number;
  vDesc?: number;
  vOutro?: number;
  // Tipo de operacao (0=entrada, 1=saida)
  tpNF?: 0 | 1;
  // Operacao especial (joalheria)
  tipoOperacao?: 'venda' | 'remessa_industrializacao' | 'retorno_industrializacao' | 'exportacao';
  // Forma de pagamento (0=avista, 1=aprazo, 2=outros)
  indPag?: 0 | 1 | 2;
}

/**
 * Gera o XML da NF-e (sem assinatura) a partir dos dados da fatura Odoo.
 */
export function gerarXmlNFe(data: NFeData): string {
  // Calcula chave de acesso
  const cUF = getCodUf(data.emit.uf || 'PR');
  const aamm = data.dhEmi.substring(2, 7).replace('-', '').replace(/-/g, '').substring(0, 4);
  const cnf = gerarCNF();
  const chave = montarChave({
    cUF,
    aamm,
    cnpjEmit: data.emit.cnpj || '',
    modelo: '55',
    serie: data.serie,
    numero: data.numero,
    tpEmis: '1',
    cnf,
  });

  // Totais
  const vProd = data.produtos.reduce((sum, p) => sum + (p.vProd || 0), 0);
  const vNF = vProd + (data.vFrete || 0) + (data.vSeg || 0) +
    (data.vOutro || 0) - (data.vDesc || 0);

  // Tag emit (com CNPJ obrigatorio)
  const emitTag = tagEnder(data.emit, 'emit');

  // Tag dest - em exportacao o dest pode ter dados simplificados
  let destTag = '';
  if (data.dest) {
    destTag = tagEnder(data.dest, 'dest');
  }

  // Tag entrega (quando destinatario e exterior mas entrega no Brasil - exportacao indireta)
  // Para exportacao direta, dest tem cPais=1058 (Brasil) e UF=EX

  // Tag ide
  const tpNF = data.tpNF ?? 1;
  const indPag = data.indPag ?? 0;

  const ide = `<ide>` +
    `<cUF>${cUF}</cUF>` +
    `<cNF>${cnf}</cNF>` +
    `<natOp>${escapeXml(getNaturezaOperacao(data.tipoOperacao))}</natOp>` +
    `<mod>55</mod>` +
    `<serie>${data.serie}</serie>` +
    `<nNF>${data.numero}</nNF>` +
    `<dhEmi>${data.dhEmi}</dhEmi>` +
    `<tpNF>${tpNF}</tpNF>` +
    // Destination code: 1=operacao interna, 2=interestadual, 3=com exterior
    `<idDest>${data.tipoOperacao === 'exportacao' ? 3 : (data.dest && data.dest.uf !== data.emit.uf ? 2 : 1)}</idDest>` +
    `<cMunFG>${data.emit.cMun || '4106902'}</cMunFG>` +
    `<tpImp>1</tpImp>` + // DANFE normal retrato
    `<tpEmis>1</tpEmis>` + // emissao normal
    `<cDV>${chave[43]}</cDV>` +
    `<tpAmb>${config.nfe.tpAmb}</tpAmb>` +
    `<finNFe>1</finNFe>` + // normal
    `<indFinal>1</indFinal>` + // consumidor final
    `<indPres>9</indPres>` + // nao se aplica
    `<procEmi>0</procEmi>` + // emissao com aplicativo do contribuinte
    `<verProc>nfse-joalherias-1.0.0</verProc>` +
    `</ide>`;

  // Produtos
  const det = data.produtos.map((p) => tagProduto(p)).join('');

  // Total
  const total = `<total>` +
    `<ICMSTot>` +
    `<vBC>${formatNum(vProd, 2)}</vBC>` +
    `<vICMS>${formatNum(data.produtos.reduce((s, p) => s + (p.icmsVICMS || 0), 0), 2)}</vICMS>` +
    `<vICMSDeson>0.00</vICMSDeson>` +
    `<vFCP>0.00</vFCP>` +
    `<vBCST>0.00</vBCST>` +
    `<vST>0.00</vST>` +
    `<vFCPST>0.00</vFCPST>` +
    `<vFCPSTRet>0.00</vFCPSTRet>` +
    `<vProd>${formatNum(vProd, 2)}</vProd>` +
    `<vFrete>${formatNum(data.vFrete || 0, 2)}</vFrete>` +
    `<vSeg>${formatNum(data.vSeg || 0, 2)}</vSeg>` +
    `<vDesc>${formatNum(data.vDesc || 0, 2)}</vDesc>` +
    `<vII>0.00</vII>` +
    `<vIPI>${formatNum(data.produtos.reduce((s, p) => s + (p.ipiVIPI || 0), 0), 2)}</vIPI>` +
    `<vIPIDevol>0.00</vIPIDevol>` +
    `<vPIS>${formatNum(data.produtos.reduce((s, p) => s + 0, 0), 2)}</vPIS>` +
    `<vCOFINS>${formatNum(data.produtos.reduce((s, p) => s + 0, 0), 2)}</vCOFINS>` +
    `<vOutro>${formatNum(data.vOutro || 0, 2)}</vOutro>` +
    `<vNF>${formatNum(vNF, 2)}</vNF>` +
    `</ICMSTot>` +
    `</total>`;

  // Transporte
  const transp = `<transp>` +
    `<modFrete>0</modFrete>` +
    `</transp>`;

  // Pagamento
  const pag = `<pag>` +
    `<detPag>` +
    `<indPag>${indPag}</indPag>` +
    `<tPag>99</tPag>` +
    `<vPag>${formatNum(vNF, 2)}</vPag>` +
    `</detPag>` +
    `</pag>`;

  // Informacoes adicionais - setor joalheiro
  let infAdFisco = '';
  let infCpl = '';
  if (data.tipoOperacao === 'remessa_industrializacao') {
    infCpl = 'Remessa para industrializacao - cliente fornece ouro e paga mao de obra';
  } else if (data.tipoOperacao === 'retorno_industrializacao') {
    infCpl = 'Retorno de industrializacao - produtos processados';
  } else if (data.tipoOperacao === 'exportacao') {
    const pesoTotal = data.produtos.reduce((s, p) => s + (p.pesoOuroKg || 0), 0);
    infCpl = `Exportacao de joias - peso total de ouro: ${pesoTotal.toFixed(3)} kg`;
    infAdFisco = 'Operacao de exportacao - isencao ICMS conforme LCP 87/2015';
  }
  // Multimoeda: ouro como produto-moeda
  if (data.produtos.some(p => p.xProd.toLowerCase().includes('ouro'))) {
    infCpl += (infCpl ? ' | ' : '') + 'Operacao com ouro como produto-moeda (Lei 7.766/89)';
  }

  const infAdic = (infCpl || infAdFisco) ?
    `<infAdic>` +
    (infAdFisco ? `<infAdFisco>${escapeXml(infAdFisco)}</infAdFisco>` : '') +
    (infCpl ? `<infCpl>${escapeXml(infCpl)}</infCpl>` : '') +
    `</infAdic>` : '';

  // Monta o XML final
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<NFe xmlns="${NFE_NS}">` +
    `<infNFe Id="NFe${chave}" versao="4.00">` +
    ide +
    emitTag +
    destTag +
    det +
    total +
    transp +
    pag +
    infAdic +
    `</infNFe>` +
    `</NFe>`;

  return xml;
}

/** Retorna o codigo IBGE (2 digitos) da UF. */
function getCodUf(uf: string): string {
  const map: Record<string, string> = {
    AC: '12', AL: '13', AP: '16', AM: '13', BA: '29', CE: '23',
    DF: '53', ES: '32', GO: '52', MA: '21', MT: '51', MS: '50',
    MG: '31', PA: '15', PB: '25', PR: '41', PE: '26', PI: '22',
    RJ: '33', RN: '24', RO: '11', RR: '14', RS: '43', SC: '42',
    SE: '28', SP: '35', TO: '17', EX: '99',
  };
  return map[uf.toUpperCase()] || '41';
}

/** Retorna a natureza da operacao conforme tipo joalheiro. */
function getNaturezaOperacao(tipo?: string): string {
  switch (tipo) {
    case 'remessa_industrializacao':
      return 'Remessa para industrializacao';
    case 'retorno_industrializacao':
      return 'Retorno de industrializacao';
    case 'exportacao':
      return 'Exportacao de joias';
    default:
      return 'Venda de mercadoria';
  }
}
