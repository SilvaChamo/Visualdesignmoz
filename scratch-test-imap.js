const { ImapFlow } = require('imapflow');

async function testIMAP() {
    const fromEmail = 'silva.chamo@visualdesignmoz.com';
    const fromPassword = 'Meckito#1977?*';
    
    const imapClient = new ImapFlow({
        host: 'mail.visualdesignmoz.com',
        port: 993,
        secure: true,
        auth: { user: fromEmail, pass: fromPassword },
        tls: { rejectUnauthorized: false },
        logger: false
    });

    try {
        await imapClient.connect();
        
        const folders = await imapClient.list();
        folders.forEach(f => {
            console.log("Found folder:", f.path);
        });

        const fullMessage = "From: teste\r\nTo: teste\r\nSubject: Test\r\n\r\nTest body";
        const sentFolder = folders.find(f => f.path.toLowerCase().includes('sent') || f.path.toLowerCase().includes('enviado'));
        
        if (sentFolder) {
            console.log("Trying to append to", sentFolder.path);
            await imapClient.append(sentFolder.path, fullMessage, ['\\Seen']);
            console.log("Successfully appended!");
        } else {
            console.log("No sent folder found to append to!");
        }
        
        await imapClient.logout();
    } catch (e) {
        console.error("IMAP Error:", e);
    }
}
testIMAP();
