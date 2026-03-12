const folders = [
    { name: 'Caixa de Entrada', imap: 'INBOX' },
    { name: 'Enviados', imap: 'Sent' },
    { name: 'Rascunhos', imap: 'Drafts' },
    { name: 'Arquivo', imap: 'Archive' },
    { name: 'Lixo', imap: 'Trash' },
    { name: 'Spam', imap: 'Junk' }
];

async function measureFolder(folder) {
    const start = Date.now();
    try {
        const res = await fetch('http://localhost:3002/api/read-emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: "admin@visualdesigne.com",
                password: "Ad.Vd#2425?*",
                folder: folder.imap
            })
        });
        const data = await res.json();
        const end = Date.now();
        const duration = (end - start) / 1000;
        if (data.success) {
            console.log(`✅ ${folder.name} (${folder.imap}): ${duration.toFixed(2)}s (${data.emails.length} emails)`);
        } else {
            console.log(`❌ ${folder.name} (${folder.imap}): ERRO em ${duration.toFixed(2)}s - ${data.error}`);
        }
    } catch (e) {
        const end = Date.now();
        console.log(`❌ ${folder.name} (${folder.imap}): FALHA em ${((end - start) / 1000).toFixed(2)}s - ${e.message}`);
    }
}

async function runBenchmark() {
    console.log("Iniciando benchmark de performance das pastas de email...\n");
    for (const folder of folders) {
        await measureFolder(folder);
    }
    console.log("\nBenchmark concluído.");
}

runBenchmark();
