import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /admin - Redireciona para a pagina principal do painel.
 * Mantido por compatibilidade com o padrao do AJL/Accel.
 * 
 * Usa redirect RELATIVO (nao URL absoluta) para funcionar em qualquer host:
 * - Em producao (Render): https://nfe-joalherias.onrender.com/admin -> /
 * - Em desenvolvimento: http://localhost:3000/admin -> /
 */

export async function GET(req: NextRequest) {
  // Redirect relativo para / (funciona em qualquer dominio)
  const baseUrl = req.nextUrl.origin || 'http://localhost:3000';
  return NextResponse.redirect(new URL('/', baseUrl), {
    status: 302,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
