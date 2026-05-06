const fetch = require('node-fetch');

async function check() {
  const payload = {
    apikey: "pk1_91bb58fe60361a40dadee348763e91b7c2878920e9a3b37cc7f7be2f517e11c7",
    secretapikey: "sk1_aa30d608b6f09c8d17bcf0ca4675340d26e364f40f10afbdf1fbd6704a97b161"
  };

  const res = await fetch('https://api.porkbun.com/api/json/v3/domain/check/agrodatamoz.com', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
check();
