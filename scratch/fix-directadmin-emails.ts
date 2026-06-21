import { readFileSync } from 'fs';
import { getAdminDirectAdminAPI } from '../src/lib/directadmin-adapter';

async function main() {
  // Load environment variables
  console.log('Loading .env.local...');
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }

  const api = await getAdminDirectAdminAPI();
  const targetPassword = 'Ad.Vd#2425?*';
  const domain = 'visualdesignmoz.com';

  console.log('\n--- Updating geral@visualdesignmoz.com password ---');
  try {
    const res = await api.changeEmailPassword({
      email: `geral@${domain}`,
      password: targetPassword,
    });
    console.log('Result:', res);
  } catch (err: any) {
    console.error('Error changing password:', err.message);
  }

  console.log('\n--- Creating affiliead@visualdesignmoz.com ---');
  try {
    const res = await api.createEmail({
      domain,
      userName: 'affiliead',
      password: targetPassword,
      quota: '250',
    });
    console.log('Result:', res);
  } catch (err: any) {
    console.error('Error creating affiliead:', err.message);
  }

  console.log('\n--- Creating invite@visualdesignmoz.com ---');
  try {
    const res = await api.createEmail({
      domain,
      userName: 'invite',
      password: targetPassword,
      quota: '250',
    });
    console.log('Result:', res);
  } catch (err: any) {
    console.error('Error creating invite:', err.message);
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
});
