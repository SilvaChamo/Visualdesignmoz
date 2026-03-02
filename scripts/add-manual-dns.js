const fetch = require('node-fetch');

async function addRecords() {
    const domain = 'visualdesigne.com';
    const apiUrl = 'http://localhost:3002/api/cyberpanel-dns';

    const records = [
        {
            name: '', // Root domain for SPF
            type: 'TXT',
            value: 'v=spf1 include:amazonses.com ~all',
        },
        {
            name: 'resend._domainkey',
            type: 'TXT',
            value: 'p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDNkU+jEhoTLv/3r4I0xewI3U9Ek5YqUx1SZZAqI9b7A2Wdn14DI2t4uofAGNad+xC79kby/2WC53oJySUL7huM0FM0ach8phIDWVjwNCs5nMfTi97dinv7d/cn7QKXKQmJCwaWbOydkhejAXiKZojaSfPE63SeVQbbqqaY268I1wIDAQAB',
        },
        {
            name: '_dmarc',
            type: 'TXT',
            value: 'v=DMARC1; p=none;',
        }
    ];

    for (const record of records) {
        console.log(`Adding ${record.type} record for ${record.name || domain}...`);
        try {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    domainName: domain,
                    name: record.name || domain, // If empty, use domain name
                    type: record.type,
                    value: record.value,
                    ttl: 3600
                }),
            });
            const data = await res.json();
            console.log('Result:', data);
        } catch (err) {
            console.error('Error adding record:', err.message);
        }
    }
}

addRecords();
