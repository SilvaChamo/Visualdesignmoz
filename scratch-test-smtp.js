const nodemailer = require('nodemailer');

async function testSMTP() {
    console.log("Testing SMTP connection...");
    const SMTP_HOST = 'mail.visualdesigne.com';
    const SMTP_PORT = 587;
    const SMTP_SECURE = false;

    const fromEmail = 'silva.chamo@visualdesigne.com';
    const fromPassword = 'Meckito#1977?*';

    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        requireTLS: true,
        auth: {
            user: fromEmail,
            pass: fromPassword
        },
        tls: {
            rejectUnauthorized: false
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000
    });

    try {
        await transporter.verify();
        console.log("Verified successfully!");
        
        const info = await transporter.sendMail({
            from: `"VisualDesigne Test" <${fromEmail}>`,
            to: "silva.chamo@gmail.com",
            subject: "Test Send from Code",
            html: "<b>Testing if CyberPanel SMTP allows sending!</b>",
        });

        console.log("Email sent: ", info);
    } catch (err) {
        console.error("Error:", err);
    }
}

testSMTP();
