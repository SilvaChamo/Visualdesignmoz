import { executeCyberPanelCommand } from './src/lib/cyberpanel-exec';

async function main() {
  try {
    const res = await executeCyberPanelCommand('echo SSH_WORKED');
    console.log('Result:', res);
  } catch (e) {
    console.error('Error:', e);
  }
}

main();
