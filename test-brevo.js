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
      from: '"VisualDesigne" <silva.chamo@visualdesignmoz.com>',
      to: 'silva.chamo@gmail.com',
      subject: 'Teste Brevo Visualdesign',
      text: 'Funciona o Brevo com este domínio?'
    });
    console.log("Enviado via Brevo:", info.messageId);
  } catch (err) {
    console.error("Erro no envio Brevo:", err.message);
  }
}
test();
