const { ImapFlow } = require('imapflow');

async function test() {
    const imapClient = new ImapFlow({
        host: '37.27.17.25',
        port: 993,
        secure: true,
        auth: { user: 'admin@visualdesignmoz.com', pass: 'Ad.Vd#2425?*' },
        tls: { rejectUnauthorized: false },
        logger: false
    });

    try {
        await imapClient.connect();
        console.log('✅ Connected');
        
        let folders = await imapClient.list();
        console.log('Folders:');
        folders.forEach(f => console.log(' - ' + f.path + ' (specialUse: ' + f.specialUse + ')'));
        
        await imapClient.logout();
    } catch(e) {
        console.error('Error:', e);
    }
}
test();
