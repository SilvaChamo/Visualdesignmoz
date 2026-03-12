const { ImapFlow } = require('imapflow');

async function listFolders() {
    const client = new ImapFlow({
        host: '109.199.104.22',
        port: 993,
        secure: true,
        auth: { user: "admin@visualdesigne.com", pass: "Ad.Vd#2425?*" },
        tls: { rejectUnauthorized: false },
        logger: false
    });

    try {
        await client.connect();
        const folders = await client.list();
        console.log(JSON.stringify(folders, null, 2));
        await client.logout();
    } catch (e) {
        console.log(`Erro: ${e.message}`);
    }
}

listFolders();
