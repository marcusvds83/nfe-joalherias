import { NextResponse } from 'next/server';

/**
 * GET /admin - Redireciona para a pagina principal do painel.
 * Mantido por compatibilidade com o padrao do AJL/Accel.
 */

export async function GET() {
  // Redireciona para a raiz onde esta o painel dashboard do middleware
  return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'), {
    status: 302,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

export const dynamic = 'force-static';
export const runtime = 'nodejs';
