const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');
const oldCriar = `  const criar = async () => {
    if (!novoUsuario.nome || !novoUsuario.email) return;
    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novoUsuario),
      });
      const data = await res.json();
      if (data.success) {
        db.usuarios.push(data.data);
        setNovoUsuario({ nome: '', email: '', perfil: 'Advogado' });
        setShowForm(false);
        forceRender({});
      }
    } catch {}
  };`;
  
const newCriar = `  const criar = async () => {
    if (!novoUsuario.nome || !novoUsuario.email) return;
    try {
      const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp-" + Date.now());
      const secondaryAuth = getAuth(secondaryApp);
      
      const password = 'SenhaTemporaria123!';
      await createUserWithEmailAndPassword(secondaryAuth, novoUsuario.email, password);
      await secondaryAuth.signOut();
      
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novoUsuario),
      });
      const data = await res.json();
      if (data.success) {
        db.usuarios.push(data.data);
        setNovoUsuario({ nome: '', email: '', perfil: 'Advogado' });
        setShowForm(false);
        forceRender({});
        alert(\`Usuário criado com sucesso. A senha temporária é: \${password}\`);
      }
    } catch (err: any) {
      alert('Erro ao criar usuário: ' + err.message);
    }
  };`;

code = code.replace(oldCriar, newCriar);
fs.writeFileSync('src/App.tsx', code);
