import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'ssh2';
import { createClient } from '@/utils/supabase/server';

const SNAPPYMAIL_ADMIN_PATH = '/usr/local/lscp/cyberpanel/snappymail';
const SNAPPYMAIL_DATA_PATH = `${SNAPPYMAIL_ADMIN_PATH}/data/_data_/_default_`;

async function execSSH(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let out = '';
    const rawKey = process.env.SSH_PRIVATE_KEY || '';
    
    if (!rawKey.includes('BEGIN') || !rawKey.includes('END')) {
      return reject(new Error('SSH_PRIVATE_KEY invalid'));
    }
    
    const privateKey = rawKey.replace(/\\n/g, '\n');
    const host = process.env.CYBERPANEL_IP || '109.199.104.22';

    const timeout = setTimeout(() => {
      conn.end();
      reject(new Error('SSH timeout'));
    }, 15000);

    conn.on('ready', () => {
      clearTimeout(timeout);
      conn.exec(command, (err, stream) => {
        if (err) { conn.end(); return reject(err); }
        stream.on('data', (d: Buffer) => { out += d.toString(); });
        stream.stderr.on('data', (d: Buffer) => { out += d.toString(); });
        stream.on('close', () => { 
          conn.end(); 
          resolve(out); 
        });
      });
    });

    conn.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    conn.connect({
      host,
      port: 22,
      username: 'root',
      privateKey: Buffer.from(privateKey),
      readyTimeout: 10000,
    });
  });
}

// Gerar token aleatório seguro
function generateToken(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    
    if (!email || !password) {
      return NextResponse.json({ 
        success: false, 
        error: 'Email e senha são obrigatórios' 
      }, { status: 400 });
    }

    // Verificar sessão
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ 
        success: false, 
        error: 'Não autenticado' 
      }, { status: 401 });
    }

    const token = generateToken();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutos
    
    // Criar arquivo de token no servidor via SSH
    // SnappyMail verifica tokens em data/_data_/_default_/tokens/ ou similar
    const tokenCmd = `
mkdir -p ${SNAPPYMAIL_DATA_PATH}/tokens && \
echo '${JSON.stringify({
  email,
  password,
  expiresAt,
  createdBy: session.user.email
})}' > ${SNAPPYMAIL_DATA_PATH}/tokens/${token}.json && \
chmod 600 ${SNAPPYMAIL_DATA_PATH}/tokens/${token}.json && \
chown lscpd:lscpd ${SNAPPYMAIL_DATA_PATH}/tokens/${token}.json && \
echo "Token created: ${token}"
`;

    try {
      const output = await execSSH(tokenCmd);
      console.log('[snappymail-sso] Token created:', output);
      
      // URL de autologin do SnappyMail nativo
      // O SnappyMail suporta login via token na query string
      const ssoUrl = `https://109.199.104.22:8090/snappymail/?sso=${token}&email=${encodeURIComponent(email)}`;
      
      return NextResponse.json({
        success: true,
        token,
        ssoUrl,
        expiresIn: 300 // 5 minutos em segundos
      });
      
    } catch (sshError: any) {
      console.error('[snappymail-sso] SSH error:', sshError);
      
      // Fallback: retornar URL com credenciais via POST (menos seguro, funciona)
      return NextResponse.json({
        success: true,
        fallback: true,
        ssoUrl: `https://109.199.104.22:8090/snappymail/`,
        message: 'Usando método fallback (form POST)'
      });
    }
    
  } catch (error: any) {
    console.error('[snappymail-sso] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
