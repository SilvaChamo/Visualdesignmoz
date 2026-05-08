const nodemailer = require('nodemailer');

// USANDO IP DIRETO PARA EVITAR ERROS DE DNS
const DA_SMTP_HOST = '109.199.104.22';
const DA_SMTP_PORT = 587;
const DA_SMTP_USER = 'marketing@visualdesignmoz.com';
const DA_SMTP_PASS = 'mark#mail2026?*';

async function sendDirectTests() {
  const targetEmail = "silva.chamo@gmail.com";
  
  console.log(`🚀 Iniciando teste SMTP via IP Direto para: ${targetEmail}`);

  const transporter = nodemailer.createTransport({
    host: DA_SMTP_HOST,
    port: DA_SMTP_PORT,
    secure: false, 
    auth: {
      user: DA_SMTP_USER,
      pass: DA_SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false // Importante para quando usamos IP em vez de domínio
    }
  });

  for (let i = 1; i <= 5; i++) {
    try {
      console.log(`📦 Enviando email ${i}/5...`);
      const info = await transporter.sendMail({
        from: `"Sistema VisualDesigne" <${DA_SMTP_USER}>`,
        to: targetEmail,
        subject: `Teste Via IP DirectAdmin #${i}`,
        html: `<h1>Sucesso Total!</h1><p>Email ${i} enviado via IP Direto do DirectAdmin.</p>`
      });
      console.log(`✅ Email ${i} enviado!`);
    } catch (error) {
      console.error(`❌ Falha no email ${i}:`, error.message);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
}

sendDirectTests();
