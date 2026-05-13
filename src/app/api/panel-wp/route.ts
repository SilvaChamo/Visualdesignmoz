import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { success: false, error: 'Gestão WordPress remota foi desactivada.' },
    { status: 501 }
  );
}
