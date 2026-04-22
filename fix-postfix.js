const { execSync } = require('child_process');

try {
  // Add permit_mynetworks to smtpd_client_restrictions so localhost can send emails
  const sshCommand = `ssh -i ~/.ssh/cyberpanel_root root@109.199.104.22 "sed -i 's/smtpd_client_restrictions = permit_sasl_authenticated,reject/smtpd_client_restrictions = permit_mynetworks, permit_sasl_authenticated, reject/g' /etc/postfix/main.cf && systemctl restart postfix"`;
  const output = execSync(sshCommand, { encoding: 'utf-8', stdio: 'pipe' });
  console.log("Postfix fixed!");
  console.log(output);
} catch (e) {
  console.error(e.message);
  if (e.stdout) console.log("STDOUT:", e.stdout.toString());
  if (e.stderr) console.log("STDERR:", e.stderr.toString());
}
