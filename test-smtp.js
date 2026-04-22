const { execSync } = require('child_process');

try {
  const sshCommand = `ssh root@109.199.104.22 "python3 -c \\"
import smtplib
try:
    server = smtplib.SMTP('localhost', 587)
    server.set_debuglevel(1)
    server.starttls()
    server.login('silva.chamo@visualdesigne.com', 'Meckito#77?*')
    server.sendmail('silva.chamo@visualdesigne.com', 'info@visualdesigne.com', 'Subject: Test\\n\\nThis is a test.')
    server.quit()
    print('SUCCESS')
except Exception as e:
    print('ERROR:', str(e))
\\""`;
  const output = execSync(sshCommand, { encoding: 'utf-8', stdio: 'pipe' });
  console.log(output);
} catch (e) {
  console.error(e.message);
  if (e.stdout) console.log("STDOUT:", e.stdout.toString());
  if (e.stderr) console.log("STDERR:", e.stderr.toString());
}
