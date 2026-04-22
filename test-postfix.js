const { execSync } = require('child_process');

try {
  // Use SSH to check postfix config
  const sshCommand = `ssh -i ~/.ssh/cyberpanel_root root@109.199.104.22 "postconf mynetworks && cat /etc/postfix/main.cf | grep smtpd_client_restrictions"`;
  const output = execSync(sshCommand, { encoding: 'utf-8', stdio: 'pipe' });
  console.log(output);
} catch (e) {
  console.error(e.message);
  if (e.stdout) console.log("STDOUT:", e.stdout.toString());
  if (e.stderr) console.log("STDERR:", e.stderr.toString());
}
