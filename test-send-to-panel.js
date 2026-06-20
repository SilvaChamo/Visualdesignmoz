const nodemailer = require('nodemailer');

async function test() {
  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: {
      user: 'ad3ca6001@smtp-brevo.com',
      pass: 'REMOVIDO_POR_SEGURANCA'
    }
  });

  try {
    const info = await transporter.sendMail({
      from: '"VisualDesigne" <geral@visualdesignmoz.com>',
      to: 'silva.chamo@visualdesignmoz.com',
      subject: 'Teste de Recepção',
      text: 'O painel recebe isto?'
    });
    console.log("Enviado via Brevo para o painel:", info.messageId);
  } catch (err) {
    console.error("Erro no envio:", err.message);
  }
}
test();
