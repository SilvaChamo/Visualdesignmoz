#!/usr/bin/env node
/**
 * Script para listar todas as pastas IMAP disponíveis no servidor
 * Uso: node scripts/list-imap-folders.js
 */

const { ImapFlow } = require('imapflow');

// Credenciais padrão
const CREDENCIAIS = {
  'silva.chamo@visualdesignmoz.com': 'Meckito#1977?*',
  'duduchamatavele@visualdesignmoz.com': 'Dudu#2425?*',
  'geral@visualdesignmoz.com': 'Ge.Vd#2425?*',
  'admin@visualdesignmoz.com': 'Ad.Vd#2425?*',
  'info@visualdesignmoz.com': 'Informação!#2020?*',
  'suporte@visualdesignmoz.com': 'SupaEmail#2026?*',
  'noreply@visualdesignmoz.com': 'VisualDesign#2026',
};

const IMAP_HOST = process.env.IMAP_HOST || '109.199.104.22';
const IMAP_PORT = 993;

async function listFolders(email, password) {
  console.log(`\n📧 Listando pastas para: ${email}`);
  console.log('=' .repeat(60));
  
  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: { user: email, pass: password },
    tls: { rejectUnauthorized: false },
    logger: false
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao IMAP');
    
    const mailboxes = await client.list();
    
    console.log(`\n📁 Total de pastas encontradas: ${mailboxes.length}\n`);
    
    mailboxes.forEach((mb, idx) => {
      const flags = mb.flags ? Array.from(mb.flags).join(', ') : 'none';
      const specialUse = mb.specialUse || 'none';
      
      console.log(`${idx + 1}. ${mb.path}`);
      console.log(`   Flags: ${flags}`);
      console.log(`   SpecialUse: ${specialUse}`);
      console.log('');
    });
    
    // Verificar pastas específicas
    console.log('\n🔍 Verificando pastas comuns:\n');
    const commonFolders = ['INBOX', 'INBOX.Sent', 'Sent', 'INBOX.Drafts', 'Drafts', 'INBOX.Trash', 'Trash', 'INBOX.Archive', 'Archive', 'INBOX.Spam', 'Spam', 'Junk', 'INBOX.Junk'];
    
    for (const folder of commonFolders) {
      try {
        const lock = await client.getMailboxLock(folder);
        const total = client.mailbox ? client.mailbox.exists || 0 : 0;
        console.log(`✅ ${folder}: ${total} emails`);
        lock.release();
      } catch (e) {
        console.log(`❌ ${folder}: Não existe`);
      }
    }
    
    await client.logout();
    console.log('\n✅ Desconectado\n');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

// Usar a primeira conta como padrão
const defaultEmail = Object.keys(CREDENCIAIS)[0];
const defaultPassword = CREDENCIAIS[defaultEmail];

console.log('🔧 IMAP Folder Lister');
console.log(`Servidor: ${IMAP_HOST}:${IMAP_PORT}`);

listFolders(defaultEmail, defaultPassword);
