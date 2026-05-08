const fs = require('fs');

async function testApi(name, endpoint, payload) {
    try {
        const res = await fetch(`http://localhost:3002/api/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            console.log(`✅ ${name}: OK`);
            return { success: true, data };
        } else {
            console.log(`❌ ${name}: ERRO - ${data.error || JSON.stringify(data)}`);
            return { success: false, data };
        }
    } catch (e) {
        console.log(`❌ ${name}: ERRO HTTP ${e.message}`);
        return { success: false, error: e };
    }
}

async function runTests() {
    const email = 'admin@visualdesignmoz.com';
    const password = 'Ad.Vd#2425?*';

    console.log("Starting tests...\n");

    // First, we need an email ID to test archive, delete, spam, reply, forward.
    // Let's read emails from INBOX
    let testEmailId = null;
    const readRes = await testApi('Ler Emails (Setup)', 'read-emails', {
        email, password, folder: 'INBOX'
    });

    if (readRes.success && readRes.data.emails && readRes.data.emails.length > 0) {
        testEmailId = readRes.data.emails[0].id;
        console.log(`Found email ID to test operations: ${testEmailId}\n`);
    } else {
        console.log("Could not find any emails in INBOX to test operations. We will try with a dummy ID.\n");
        testEmailId = 'dummy-id';
    }

    console.log("--- BOTOES NA LISTA e EMAIL ABERTO ---");

    // Arquivar
    await testApi('Arquivo (📁 Arquivar)', 'archive-email', {
        email, password, emailId: testEmailId, fromFolder: 'INBOX'
    });

    // Spam
    await testApi('Spam (🚫 Spam)', 'archive-email', {
        email, password, emailId: testEmailId, fromFolder: 'INBOX', toFolder: 'Spam'
    });

    // Forward
    await testApi('Encaminhar (↪️ Encaminhar)', 'forward-email', {
        email, password, emailId: testEmailId, forwardTo: 'teste@visualdesignmoz.com', folder: 'INBOX'
    });

    // Deletar
    await testApi('Deletar (🗑️ Deletar)', 'delete-email', {
        email, password, emailId: testEmailId, folder: 'INBOX'
    });

    console.log("\n--- BOTOES NA COMPOSICAO ---");

    // Salvar Rascunho
    const draftSave = await testApi('Salvar Rascunho (💾 Salvar Rascunho)', 'draft-save', {
        email, para: 'teste@visualdesignmoz.com', cc: '', bcc: '', assunto: 'Teste Rascunho', corpo: 'Corpo de teste do rascunho'
    });

    // Carregar Rascunhos
    const draftLoad = await testApi('Carregar Rascunhos (📂 Carregar Rascunhos)', 'draft-load', {
        email
    });

    // Delete draft (to cleanup)
    if (draftSave.success && draftSave.data.draftId) {
        await testApi('Limpeza: Excluir Rascunho', 'draft-delete', { draftId: draftSave.data.draftId });
    }

    // Enviar (Send)
    await testApi('Enviar (✈️ Enviar)', 'send-email', {
        from: email, fromPassword: password, to: 'teste@visualdesignmoz.com', cc: '', bcc: '', subject: 'Teste de Envio', html: 'Teste de corpo de email'
    });

    console.log("\nTests Completed.");
}

runTests();
