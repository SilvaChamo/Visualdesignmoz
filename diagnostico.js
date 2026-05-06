const https = require('https');

const data = JSON.stringify({
  apikey: "pk1_91bb58fe60361a40dadee348763e91b7c2878920e9a3b37cc7f7be2f517e11c7",
  secretapikey: "sk1_aa30d608b6f09c8d17bcf0ca4675340d26e364f40f10afbdf1fbd6704a97b161"
});

const options = {
  hostname: 'api.porkbun.com',
  path: '/api/json/v3/domain/check/agrodatamoz.com',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  console.log('Status Code:', res.statusCode);
  let responseBody = '';
  res.on('data', (d) => { responseBody += d; });
  res.on('end', () => {
    console.log('Response Body:', responseBody.substring(0, 1000));
  });
});

req.on('error', (error) => {
  console.error('Error:', error.message);
});

req.write(data);
req.end();
