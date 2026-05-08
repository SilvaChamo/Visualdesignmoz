import { NextResponse } from 'next/server';
import { getDirectAdminWordPressUrl } from '@/lib/server-config';

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      supported: false,
      directAdminUrl: getDirectAdminWordPressUrl(),
      error: 'Instalação automática WordPress ainda não está ligada ao DirectAdmin. Use o WordPress Manager no DirectAdmin.',
    },
    { status: 501 }
  );
}
