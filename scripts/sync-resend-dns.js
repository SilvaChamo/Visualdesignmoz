const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

async function syncDNS() {
    const recordsPath = path.join(__dirname, 'resend-records.json');
    if (!fs.existsSync(recordsPath)) {
        console.error('Error: resend-records.json not found. Run setup-resend-domain.js first.');
        process.exit(1);
    }

    const records = JSON.parse(fs.readFileSync(recordsPath, 'utf8'));
    const domain = 'visualdesigne.com';
    const apiUrl = 'http://localhost:3002/api/cyberpanel-dns';

    console.log(`Syncing ${records.length} records to CyberPanel for ${domain}...`);

    for (const record of records) {
        const payload = {
            domainName: domain,
            name: record.name, // Resend provides the full name, e.g., 'resend._domainkey'
            type: record.type,
            value: record.value,
            ttl: 3600,
        };

        console.log(`Adding ${record.type} record: ${record.name}...`);
        try {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.success) {
                console.log(`Successfully added ${record.name}`);
            } else {
                console.error(`Failed to add ${record.name}:`, data.details || data.error);
            }
        } catch (err) {
            console.error(`Error adding ${record.name}:`, err.message);
        }
    }
}

syncDNS();
