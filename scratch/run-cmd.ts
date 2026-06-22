import { executeServerCommand } from '../src/lib/server-ssh-exec';

async function main() {
  try {
    console.log('Fetching systemctl status...');
    const result = await executeServerCommand('systemctl status directadmin da-cookie-proxy');
    console.log('=== SYSTEMCTL STATUS ===');
    console.log(result);

    console.log('\nFetching active network ports...');
    const ports = await executeServerCommand('ss -tlnp | grep -E ":2026|:2027"');
    console.log('=== PORTS ===');
    console.log(ports);

    console.log('\nFetching systemd logs for da-cookie-proxy...');
    const logs = await executeServerCommand('journalctl -u da-cookie-proxy -n 30 --no-pager');
    console.log('=== LOGS ===');
    console.log(logs);
  } catch (err) {
    console.error('Error running remote command:', err);
  }
}

main();
