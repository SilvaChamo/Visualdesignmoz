const { execSync } = require('child_process');

try {
  const sshCommand = `ssh root@109.199.104.22 "grep 'visualdesignmoz.com' /var/log/mail.log | tail -n 50"`;
  const output = execSync(sshCommand, { encoding: 'utf-8', stdio: 'pipe' });
  console.log(output);
} catch (e) {
  console.error(e.message);
  if (e.stdout) console.log("STDOUT:", e.stdout.toString());
  if (e.stderr) console.log("STDERR:", e.stderr.toString());
}
