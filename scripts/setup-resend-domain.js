const { Resend } = require('resend');
const fs = require('fs');
const path = require('path');

async function setupDomain() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || apiKey === 're_placeholder') {
        console.error('Error: RESEND_API_KEY is not set or is a placeholder.');
        process.exit(1);
    }

    const resend = new Resend(apiKey);
    const domainName = 'visualdesignmoz.com';

    try {
        console.log(`Adding domain ${domainName} to Resend...`);
        const { data, error } = await resend.domains.create({
            name: domainName,
            region: 'us-east-1',
        });

        if (error) {
            if (error.message.includes('already exists')) {
                console.log(`Domain ${domainName} already exists on Resend. Retrieving records...`);
                const { data: existingData, error: existingError } = await resend.domains.get(domainName);
                if (existingError) throw existingError;
                printRecords(existingData);
            } else {
                throw error;
            }
        } else {
            console.log('Domain added successfully!');
            printRecords(data);
        }
    } catch (err) {
        console.error('Error during Resend domain setup:', err.message);
    }
}

function printRecords(domainData) {
    console.log('\n--- DNS Records required for Resend ---\n');
    if (domainData.records) {
        domainData.records.forEach(record => {
            console.log(`Type: ${record.type}`);
            console.log(`Name: ${record.name}`);
            console.log(`Value: ${record.value}`);
            console.log('---');
        });

        // Save records to a JSON file for the next step
        fs.writeFileSync(
            path.join(__dirname, 'resend-records.json'),
            JSON.stringify(domainData.records, null, 2)
        );
        console.log('\nRecords saved to resend-records.json');
    } else {
        console.log('No records found in the response.');
    }
}

setupDomain();
