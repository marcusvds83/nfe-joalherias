/**
 * src/lib/config.ts - Configuracoes central do middleware NF-e Joalherias
 * ====================================================================
 * Todas as configuracoes sao lidas de variaveis de ambiente.
 * No Render, defina-as no painel Environment Variables.
 */

export const config = {
  // === Servidor ===
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiKey: process.env.API_KEY || '',

  // === Odoo (autenticacao via email + API Key) ===
  odoo: {
    enabled: process.env.ODOO_ENABLED === '1',
    url: (process.env.ODOO_URL || '').replace(/\/+$/, ''),
    db: process.env.ODOO_DB || '',
    user: process.env.ODOO_USER || '',
    apiKey: process.env.ODOO_API_KEY || '',
    pollingIntervalMs: parseInt(process.env.ODOO_POLLING_MS || '20000', 10),
  },

  // === Firebase (cofre do certificado A1) ===
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    collection: process.env.FIREBASE_CERT_COLLECTION || 'certificados',
    docId: process.env.FIREBASE_CERT_DOC_ID || 'joalheria-a1',
  },

  // === NF-e (SEFAZ - emissao propria com certificado A1) ===
  nfe: {
    modo: process.env.NFE_EMISSAO_MODO || 'proprio', // 'proprio' | 'sieg'
    uf: (process.env.NFE_UF || 'PR').toUpperCase(),
    tpAmb: process.env.NFE_TP_AMB || '2', // 1=producao, 2=homologacao
    certDir: process.env.NFE_CERT_DIR || '/var/data',
    certKek: process.env.NFE_CERT_KEK || process.env.API_KEY || 'joalheria-nfe-local-kek',
    danfeProvider: process.env.NFE_DANFE_PROVIDER || 'local',
    tlsInsecure: process.env.NFE_TLS_INSECURE === '1',
    statusOnError: process.env.NFE_STATUS_ON_ERROR || 'erro',
    versao: '4.00',
    seriePadrao: '1',
  },

  // === Setor Joalheiro - regras de negocio especificas ===
  joalheria: {
    // Regime tributario default (simples_nacional | lucro_presumido | lucro_real)
    regimeTributario: process.env.JOALHERIA_REGIME_TRIBUTARIO || 'simples_nacional',
    // NCM padrao para joias de ourivesaria (71131900 - Artigos de joalheria de prata)
    ouroCodigoNcm: process.env.JOALHERIA_OURO_CODIGO_NCM || '71131900',
    // Moeda de referencia para precificacao de metal (BRL | USD | OZ)
    moedaRef: process.env.JOALHERIA_MOEDA_REF || 'BRL',
    // CFOP defaults (operacoes mais comuns no setor)
    cfop: {
      vendaDentroEstado: '5101',
      vendaForaEstado: '6101',
      remessaIndustrializacao: '5901',
      retornoIndustrializacao: '1910',
      exportacao: '7101',
    },
    // Unidades de medida padrao
    unidades: {
      metal: 'KG', // Ouro como produto-moeda eh precificado em quilos
      pedra: 'UND', // Pedras em unidades
      maoDeObra: 'UND', // Mae de obra em unidades (servico associado)
    },
  },

  // === Logs ===
  logLevel: process.env.LOG_LEVEL || 'info',
} as const;

/** Helper: ambiente eh producao? */
export const isProd = config.nodeEnv === 'production';

/** Helper: ambiente eh homologacao? */
export const isHomolog = config.nfe.tpAmb === '2';

/** Helper: Odoo esta configurado corretamente? */
export const odooConfigured = (): boolean =>
  config.odoo.enabled &&
  !!config.odoo.url &&
  !!config.odoo.db &&
  !!config.odoo.user &&
  !!config.odoo.apiKey;

/** Helper: Firebase esta configurado? */
export const firebaseConfigured = (): boolean =>
  !!config.firebase.projectId &&
  !!config.firebase.clientEmail &&
  !!config.firebase.privateKey;
