async function run() {
  try {
    const res = await fetch('http://127.0.0.1:3002/api/git-deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'git-push', message: 'feat: force brute configs & blocked IP sync' })
    });
    console.log('Status:', res.status);
    console.log('Body:', await res.json());
  } catch (err) {
    console.error('Error:', err.message);
  }
}
run();
