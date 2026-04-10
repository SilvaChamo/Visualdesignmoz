import { NextRequest, NextResponse } from 'next/server';
import { validateEmailList, validateEmail, BulkValidationResult } from '@/lib/email-validation';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { emails, mode = 'bulk' } = body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Lista de emails não fornecida ou vazia'
      }, { status: 400 });
    }

    // Limita a 1000 emails por requisição
    if (emails.length > 1000) {
      return NextResponse.json({
        success: false,
        error: 'Limite de 1000 emails por validação excedido'
      }, { status: 400 });
    }

    let result: BulkValidationResult | any;

    if (mode === 'single') {
      // Validação individual
      const validation = await validateEmail(emails[0]);
      result = {
        total: 1,
        valid: validation.isValid ? 1 : 0,
        invalid: validation.isValid ? 0 : 1,
        disposable: validation.isDisposable ? 1 : 0,
        roleBased: validation.isRoleBased ? 1 : 0,
        withTypos: validation.suggestions?.length ? 1 : 0,
        results: [validation],
        validEmails: validation.isValid ? [validation.email] : [],
        invalidEmails: validation.isValid ? [] : [validation.email]
      };
    } else {
      // Validação em massa
      result = await validateEmailList(emails);
    }

    return NextResponse.json({
      success: true,
      validation: result,
      summary: {
        total: result.total,
        valid: result.valid,
        invalid: result.invalid,
        validPercentage: result.total > 0 ? Math.round((result.valid / result.total) * 100) : 0,
        riskLevel: result.invalid > result.valid ? 'high' : result.invalid > 0 ? 'medium' : 'low'
      }
    });

  } catch (error: any) {
    console.error('Erro na validação de emails:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Erro ao validar emails'
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({
        success: false,
        error: 'Email não fornecido'
      }, { status: 400 });
    }

    const validation = await validateEmail(email);

    return NextResponse.json({
      success: true,
      validation: validation,
      isValid: validation.isValid,
      canProceed: validation.isValid
    });

  } catch (error: any) {
    console.error('Erro na validação de email:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Erro ao validar email'
    }, { status: 500 });
  }
}
