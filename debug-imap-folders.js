const { ImapFlow } = require('imapflow');

async function debugFolder(folderPath) {
    const client = new ImapFlow({
        host: '37.27.17.25',
        port: 993,
        secure: true,
        auth: { user: "admin@visualdesignmoz.com", pass: "Ad.Vd#2425?*" },
        tls: { rejectUnauthorized: false },
        logger: false
    });

    console.log(`\n--- Testando pasta: ${folderPath} ---`);
    try {
        await client.connect();
        console.log('Conectado.');

        try {
            const lock = await client.getMailboxLock(folderPath);
            console.log(`Lock obtido para ${folderPath}.`);

            const total = client.mailbox ? client.mailbox.exists || 0 : 0;
            console.log(`Total de emails: ${total}`);

            if (total > 0) {
                console.log('Tentando fetch do último email...');
                for await (const msg of client.fetch(total.toString(), { envelope: true })) {
                    console.log(`Fetch OK. Assunto: ${msg.envelope.subject}`);
                }
            }

            lock.release();
        } catch (lockError) {
            console.log(`Erro no Lock/Fetch: ${lockError.message}`);
        }

        await client.logout();
        console.log('Desconectado.');
    } catch (e) {
        console.log(`Erro de Conexão: ${e.message}`);
    }
}

async function run() {
    await debugFolder('INBOX');
    await debugFolder('INBOX.Sent');
    await debugFolder('INBOX.Archive');
}

run();
