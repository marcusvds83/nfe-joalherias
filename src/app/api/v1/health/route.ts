/**
 * GET /api/v1/health - Health check do middleware NF-e Joalherias
 */

import { NextRequest, NextResponse } from 'next/server';
import { config, odooConfigured, firebaseConfigured } from '@/lib/config';

export async function GET(_req: NextRequest) {
  return NextResponse.json({
    servico: 'nfe-joalherias',
    versao: '1.0.0',
    ambiente: config.nodeEnv,
    timestamp: new Date().toISOString(),
    odoo: {
      url: config.odoo.url,
      db: config.odoo.db,
      user: config.odoo.user,
      enabled: odooConfigured(),
    },
    firebase: {
      project_id: config.firebase.projectId,
      configurado: firebaseConfigured(),
    },
    nfe: {
      modo: config.nfe.modo,
      uf: config.nfe.uf,
      tp_amb: config.nfe.tpAmb === '2' ? 'homologacao' : 'producao',
      regime: config.joalheria.regimeTributario,
    },
  });
}
