import { NextRequest, NextResponse } from 'next/server';
import { cacheService } from '@/lib/cache-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pattern } = body;
    
    if (pattern) {
      // Limpar cache por padrão
      cacheService.clearPattern(pattern);
      return NextResponse.json({ 
        success: true, 
        message: `Cache limpo para padrão: ${pattern}` 
      });
    } else {
      // Limpar todo o cache
      cacheService.clear();
      return NextResponse.json({ 
        success: true, 
        message: 'Todo o cache limpo' 
      });
    }
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

export async function GET() {
  // Retornar chaves do cache para debug
  const keys = cacheService.getKeys();
  return NextResponse.json({ 
    keys, 
    count: keys.length 
  });
}
