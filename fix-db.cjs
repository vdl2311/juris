const fs = require('fs');
let code = fs.readFileSync('src/db.ts', 'utf-8');
code = code.replace(/usuarios: \[\],.*?  \],/s, 'usuarios: [],');
fs.writeFileSync('src/db.ts', code);
