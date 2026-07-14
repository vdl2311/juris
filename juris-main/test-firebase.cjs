const firebaseConfig = require('./firebase-applet-config.json');
async function test() {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', password: 'password123', returnSecureToken: false })
  });
  console.log(await res.json());
}
test();
