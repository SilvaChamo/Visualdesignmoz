const apiKey = "6DD9Pnab8SwL653kQWBW";
const secretKey = "ONEXEunGCinIHM4ZXlVfDgGtGdoLjacOSoZmrRLWAhSpkcPuMRdfMCO5bzhySovp";
const domain = "visualdesing.com";

fetch(`https://spaceship.dev/api/v1/domains/${domain}/available`, {
  headers: { 'X-API-Key': apiKey, 'X-API-Secret': secretKey }
})
.then(res => res.text())
.then(console.log)
.catch(console.error);
