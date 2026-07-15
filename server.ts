import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import nodemailer from 'nodemailer';
import {
  validateCPF,
  validateCNPJ,
  validatePhone,
  cleanNonDigits,
} from './src/utils/validation.js';
import { db, addDays } from './src/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inicialização do Firebase Admin SDK para acesso administrativo ao Firestore
let firestoreDb: Firestore | null = null;
let firebaseInitError: string | null = null;
let firebaseConfig: any = null;

try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    
    // Inicializa o Admin SDK. Em ambiente Cloud Run, ele usa a Service Account padrão automaticamente.
    // Em ambientes como o Vercel, podemos passar as credenciais por variável de ambiente.
    if (getApps().length === 0) {
      let serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (serviceAccountVar) {
        try {
          serviceAccountVar = serviceAccountVar.trim();
          // Remove aspas simples ou duplas extras caso o usuário tenha colado com aspas no Vercel
          if (serviceAccountVar.startsWith('"') && serviceAccountVar.endsWith('"')) {
            serviceAccountVar = serviceAccountVar.slice(1, -1);
          } else if (serviceAccountVar.startsWith("'") && serviceAccountVar.endsWith("'")) {
            serviceAccountVar = serviceAccountVar.slice(1, -1);
          }
          
          const serviceAccount = JSON.parse(serviceAccountVar);
          if (serviceAccount && typeof serviceAccount === 'object' && serviceAccount.private_key) {
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
          }
          admin.initializeApp({
            credential: (admin as any).credential.cert(serviceAccount),
            projectId: firebaseConfig.projectId
          });
          console.log('[FIREBASE] Admin SDK inicializado com sucesso usando Service Account fornecida.');
        } catch (jsonErr: any) {
          firebaseInitError = `Erro ao analisar JSON da Service Account: ${jsonErr.message}`;
          console.error('[FIREBASE] Erro ao analisar FIREBASE_SERVICE_ACCOUNT JSON. Inicializando com padrão:', jsonErr.message);
          admin.initializeApp({
            projectId: firebaseConfig.projectId
          });
        }
      } else {
        admin.initializeApp({
          projectId: firebaseConfig.projectId
        });
      }
    }
    
    if (firebaseConfig.firestoreDatabaseId) {
      firestoreDb = getFirestore(getApps()[0] || undefined as any, firebaseConfig.firestoreDatabaseId);
    } else {
      firestoreDb = getFirestore();
    }
    console.log('[FIREBASE] Admin SDK inicializado com sucesso.');
  } else {
    firebaseInitError = 'Arquivo firebase-applet-config.json não encontrado.';
    console.warn('[FIREBASE] Arquivo firebase-applet-config.json não encontrado. Operando em memória.');
  }
} catch (err: any) {
  firebaseInitError = `Erro global no Firebase Admin: ${err.message}`;
  console.error('[FIREBASE] Erro ao inicializar o Firebase Admin:', err.message);
}

// Sincronização e persistência do Banco em arquivo local
const LOCAL_DB_PATH = process.env.VERCEL
  ? '/tmp/db_local.json'
  : path.join(process.cwd(), 'db_local.json');

function saveLocalDb() {
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify({
      usuarios: db.usuarios,
      clientes: db.clientes,
      processos: db.processos,
      eventos: db.eventos,
      tarefas: db.tarefas,
      honorarios: db.honorarios,
      despesas: db.despesas,
      documentos: db.documentos,
      auditoria: db.auditoria,
      integracoes: db.integracoes,
      nextId: db.nextId
    }, null, 2), 'utf-8');
    console.log('[LOCAL DB] Banco de dados local persistido com sucesso.');
  } catch (err: any) {
    console.error('[LOCAL DB] Erro ao salvar banco local:', err.message);
  }
}

function loadLocalDb() {
  try {
    let pathToRead = LOCAL_DB_PATH;
    if (process.env.VERCEL && !fs.existsSync(pathToRead)) {
      const rootDbPath = path.join(process.cwd(), 'db_local.json');
      if (fs.existsSync(rootDbPath)) {
        pathToRead = rootDbPath;
        console.log('[LOCAL DB] Usando db_local.json do diretório raiz em ambiente Vercel.');
      }
    }

    if (fs.existsSync(pathToRead)) {
      const data = JSON.parse(fs.readFileSync(pathToRead, 'utf-8'));
      if (data.usuarios) db.usuarios = data.usuarios;
      if (data.clientes) db.clientes = data.clientes;
      if (data.processos) db.processos = data.processos;
      if (data.eventos) db.eventos = data.eventos;
      if (data.tarefas) db.tarefas = data.tarefas;
      if (data.honorarios) db.honorarios = data.honorarios;
      if (data.despesas) db.despesas = data.despesas;
      if (data.documentos) db.documentos = data.documentos;
      if (data.auditoria) db.auditoria = data.auditoria;
      if (data.integracoes) db.integracoes = data.integracoes;
      if (data.nextId) db.nextId = data.nextId;
      console.log('[LOCAL DB] Banco de dados carregado com sucesso de:', pathToRead, 'Próximos IDs:', db.nextId);
    } else {
      console.log('[LOCAL DB] Arquivo db_local.json não encontrado. Usando dados iniciais.');
    }
  } catch (err: any) {
    console.error('[LOCAL DB] Erro ao carregar banco local:', err.message);
  }
}

// Inicializar banco local na inicialização do servidor
loadLocalDb();
saveLocalDb();

// Sincronização do Banco em memória com o Firestore
async function syncFirestore() {
  if (!firestoreDb) {
    console.warn('[FIREBASE] Firestore não inicializado. Ignorando sincronização.');
    return;
  }
  
  console.log('[FIREBASE] Iniciando sincronização com o Firestore...');
  
  try {
    const collections = [
      { name: 'usuarios', key: 'usuarios' },
      { name: 'clientes', key: 'clientes' },
      { name: 'processos', key: 'processos' },
      { name: 'eventos', key: 'eventos' },
      { name: 'tarefas', key: 'tarefas' },
      { name: 'honorarios', key: 'honorarios' },
      { name: 'despesas', key: 'despesas' },
      { name: 'documentos', key: 'documentos' },
      { name: 'auditoria', key: 'auditoria' }
    ];

    for (const coll of collections) {
      try {
        const collRef = firestoreDb.collection(coll.name);
        const snap = await collRef.get();
        
        if (snap.empty) {
          console.log(`[FIREBASE] Coleção '${coll.name}' vazia. Semeando dados iniciais...`);
          const initialData = db[coll.key as keyof typeof db] as any[];
          for (const item of initialData) {
            await collRef.doc(String(item.id)).set(item);
          }
        } else {
          console.log(`[FIREBASE] Carregando '${coll.name}' do Firestore...`);
          let loadedData: any[] = [];
          snap.forEach((docSnap: any) => {
            loadedData.push(docSnap.data());
          });
          
          // Realizar a limpeza e de-duplicação de usuários no Firestore se a coleção contiver duplicatas
          if (coll.name === 'usuarios') {
            console.log('[FIREBASE] Executando rotina de limpeza e de-duplicação de usuários...');
            
            const emailGroups: { [email: string]: any[] } = {};
            loadedData.forEach((u) => {
              const email = (u.email || '').toLowerCase().trim();
              if (email) {
                if (!emailGroups[email]) emailGroups[email] = [];
                emailGroups[email].push(u);
              }
            });
            
            const uniqueUsersToKeep: any[] = [];
            const idsToDelete = new Set<string>();
            const docsToWrite = new Map<string, any>();
            
            for (const email of Object.keys(emailGroups)) {
              const dupes = emailGroups[email];
              if (dupes.length === 1) {
                uniqueUsersToKeep.push(dupes[0]);
              } else {
                dupes.sort((a, b) => {
                  const aId = typeof a.id === 'number' ? a.id : parseInt(String(a.id)) || 999999;
                  const bId = typeof b.id === 'number' ? b.id : parseInt(String(b.id)) || 999999;
                  if (email === 'vidal2311usa@gmail.com') {
                    if (aId === 1) return -1;
                    if (bId === 1) return 1;
                  }
                  if (email === 'cria2311@gmail.com') {
                    if (aId === 5) return -1;
                    if (bId === 5) return 1;
                  }
                  if (email === 'bandavai62@gmail.com') {
                    if (aId === 6) return -1;
                    if (bId === 6) return 1;
                  }
                  return aId - bId;
                });
                
                const keep = dupes[0];
                uniqueUsersToKeep.push(keep);
                
                for (let i = 1; i < dupes.length; i++) {
                  idsToDelete.add(String(dupes[i].id));
                }
              }
            }
            
            const usedIds = new Set<number>();
            let nextUnusedId = 15;
            const finalUsers: any[] = [];
            
            for (const u of uniqueUsersToKeep) {
              let currentId = typeof u.id === 'number' ? u.id : parseInt(String(u.id)) || nextUnusedId++;
              
              if (usedIds.has(currentId)) {
                const emailLower = (u.email || '').toLowerCase().trim();
                if (emailLower === 'vidal2311usa@gmail.com') currentId = 1;
                else if (emailLower === 'cria2311@gmail.com') currentId = 5;
                else if (emailLower === 'bandavai62@gmail.com') currentId = 6;
                else {
                  while (usedIds.has(nextUnusedId)) {
                    nextUnusedId++;
                  }
                  currentId = nextUnusedId++;
                }
              }
              
              usedIds.add(currentId);
              const finalUser = { ...u, id: currentId };
              finalUsers.push(finalUser);
              
              if (String(u.id) !== String(currentId)) {
                idsToDelete.add(String(u.id));
                docsToWrite.set(String(currentId), finalUser);
              }
            }
            
            for (const idDel of idsToDelete) {
              console.log(`[DE-DUP STARTUP] Removendo documento de usuário ID ${idDel} do Firestore.`);
              await collRef.doc(idDel).delete().catch(() => null);
            }
            for (const [idWrite, docData] of docsToWrite.entries()) {
              console.log(`[DE-DUP STARTUP] Gravando documento de usuário ID ${idWrite} com e-mail ${docData.email}.`);
              await collRef.doc(idWrite).set(docData).catch(() => null);
            }
            
            loadedData = finalUsers;
          }
          
          // Ordena os dados e define na memória local
          loadedData.sort((a, b) => (a.id || 0) - (b.id || 0));
          (db as any)[coll.key] = loadedData;
          
          saveLocalDb();
          
          // Sincronizar o nextId de forma segura contra NaNs de IDs não-numéricos
          if (loadedData.length > 0) {
            const numericIds = loadedData.map(item => {
              const parsed = typeof item.id === 'number' ? item.id : parseInt(String(item.id));
              return isNaN(parsed) ? 0 : parsed;
            });
            const maxId = Math.max(...numericIds, 0);
            const singularKey = coll.key.endsWith('s') ? coll.key.slice(0, -1) : coll.key;
            if ((db.nextId as any)[singularKey] !== undefined) {
              (db.nextId as any)[singularKey] = maxId + 1;
            } else if ((db.nextId as any)[coll.key] !== undefined) {
              (db.nextId as any)[coll.key] = maxId + 1;
            }
          }
        }
      } catch (errColl: any) {
        console.error(`[FIREBASE] Erro ao carregar/sincronizar coleção '${coll.name}':`, errColl.message);
      }
    }

    // Sincronizar usuários do Firebase Auth com a coleção 'usuarios' do Firestore
    try {
      console.log('[FIREBASE] Sincronizando usuários do Firebase Auth...');
      const authUsers = await getAuth().listUsers();
      const existingEmails = new Set(db.usuarios.map(u => (u.email || '').toLowerCase()));
      let maxId = Math.max(...db.usuarios.map(u => u.id || 0), 0);

      const usuariosRef = firestoreDb.collection('usuarios');
      let altered = false;
      for (const authUser of authUsers.users) {
        if (authUser.email) {
          const emailLower = authUser.email.toLowerCase();
          if (!existingEmails.has(emailLower)) {
            maxId++;
            const newUser = {
              id: maxId,
              nome: authUser.displayName || authUser.email.split('@')[0],
              email: authUser.email,
              perfil: (emailLower === 'vidal2311usa@gmail.com' || emailLower === 'bandavai62@gmail.com') ? 'Administrador' : 'Advogado'
            };
            console.log(`[FIREBASE] Adicionando novo usuário encontrado no Auth para o Firestore: ${emailLower}`);
            await usuariosRef.doc(String(newUser.id)).set(newUser);
            db.usuarios.push(newUser);
            existingEmails.add(emailLower);
            altered = true;
          }
        }
      }
    } catch (errAuth: any) {
      console.error('[FIREBASE] Erro ao sincronizar usuários do Firebase Auth:', errAuth.message);
    }

    // Sincronizar as integrações
    try {
      const configRef = firestoreDb.collection('config').doc('integracoes');
      const docSnap = await configRef.get();
      if (docSnap.exists) {
        db.integracoes = docSnap.data() as any;
      } else {
        await configRef.set(db.integracoes);
      }
    } catch (errInt: any) {
      console.error('[FIREBASE] Erro ao sincronizar configurações de integrações:', errInt.message);
    }

    // Sincronizar os contadores de IDs baseados no máximo ID carregado de forma segura contra NaNs
    const safeMaxId = (arr: any[]) => {
      const numericIds = arr.map(x => {
        const parsed = typeof x.id === 'number' ? x.id : parseInt(String(x.id));
        return isNaN(parsed) ? 0 : parsed;
      });
      return Math.max(...numericIds, 0);
    };

    db.nextId = {
      cliente: safeMaxId(db.clientes) + 1,
      processo: safeMaxId(db.processos) + 1,
      evento: safeMaxId(db.eventos) + 1,
      tarefa: safeMaxId(db.tarefas) + 1,
      honorario: safeMaxId(db.honorarios) + 1,
      documento: safeMaxId(db.documentos) + 1,
      usuario: safeMaxId(db.usuarios) + 1,
      despesa: safeMaxId(db.despesas) + 1,
      auditoria: safeMaxId(db.auditoria) + 1,
    };
    console.log('[FIREBASE] Sincronização concluída! Próximos IDs:', db.nextId);
    saveLocalDb();
  } catch (errGlobal: any) {
    console.error('[FIREBASE] Erro global na sincronização:', errGlobal.message);
  }
}

// Lazy initialization do Gemini
let genaiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genaiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is required.');
    }
    genaiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
  }
  return genaiClient;
}

const app = express();

let syncPromise: Promise<void> | null = null;

function ensureSync() {
  if (!syncPromise) {
    console.log('[FIREBASE] Iniciando sincronização do banco com Firestore...');
    syncPromise = syncFirestore().catch((err) => {
      console.error('[FIREBASE] Falha crítica na sincronização inicial:', err.message);
      syncPromise = null; // permite retentar na próxima requisição
      throw err;
    });
  }
  return syncPromise;
}

async function ensureAdminUser() {
  const emailLower = 'vidal2311usa@gmail.com';
  const targetPassword = '@Vdl2311';
  
  // 1. Garantir que o usuário está no array de usuários locais (com a senha correta)
  const localUser = db.usuarios.find(u => (u.email || '').toLowerCase() === emailLower);
  if (localUser) {
    localUser.senha = targetPassword;
    localUser.perfil = 'Administrador';
    localUser.nome = 'Administrador Vidal';
  } else {
    const maxId = Math.max(...db.usuarios.map(u => u.id || 0), 0) + 1;
    db.usuarios.push({
      id: maxId,
      nome: 'Administrador Vidal',
      email: emailLower,
      perfil: 'Administrador',
      senha: targetPassword
    });
  }
  saveLocalDb();

  // 2. Garantir o usuário no Firebase Auth se o SDK estiver inicializado
  try {
    if (getApps().length > 0) {
      let authUser;
      try {
        authUser = await getAuth().getUserByEmail(emailLower);
        console.log(`[FIREBASE AUTH] Usuário ${emailLower} já existe. Atualizando senha...`);
        await getAuth().updateUser(authUser.uid, {
          password: targetPassword,
          displayName: 'Administrador Vidal'
        });
        console.log(`[FIREBASE AUTH] Usuário ${emailLower} atualizado com sucesso.`);
      } catch (getErr: any) {
        if (getErr.code === 'auth/user-not-found') {
          console.log(`[FIREBASE AUTH] Usuário ${emailLower} não encontrado. Criando...`);
          await getAuth().createUser({
            email: emailLower,
            password: targetPassword,
            displayName: 'Administrador Vidal',
            emailVerified: true
          });
          console.log(`[FIREBASE AUTH] Usuário ${emailLower} criado com sucesso.`);
        } else {
          throw getErr;
        }
      }

      // 3. Garantir o usuário no Firestore se conectado
      if (firestoreDb) {
        const userInDb = db.usuarios.find(u => (u.email || '').toLowerCase() === emailLower);
        if (userInDb) {
          const cleanUser = {
            id: userInDb.id,
            nome: userInDb.nome,
            email: userInDb.email,
            perfil: userInDb.perfil
          };
          await firestoreDb.collection('usuarios').doc(String(userInDb.id)).set(cleanUser);
          console.log(`[FIRESTORE] Usuário ${emailLower} sincronizado.`);
        }
      }
    }
  } catch (err: any) {
    console.error('[FIREBASE AUTH/FIRESTORE] Erro ao assegurar usuário admin:', err.message);
  }
}

async function startServer() {
  const PORT = parseInt(process.env.PORT || '3000', 10);

  // Inicializações assíncronas em segundo plano (não-bloqueante) para que o Express monte todas as rotas de forma síncrona
  // e evite race conditions ou timeouts em ambientes serverless como o Vercel.
  (async () => {
    if (firestoreDb) {
      try {
        await firestoreDb.listCollections();
        console.log('[FIREBASE] Conectado e autenticado no Firestore com sucesso.');
      } catch (connectionErr: any) {
        console.warn('[FIREBASE] Sem permissão para conectar ao Firestore (operando em modo contingência local):', connectionErr.message);
        firestoreDb = null;
        firebaseInitError = `Sem permissão de acesso ao Firestore: ${connectionErr.message}`;
      }
    }
    try {
      await ensureAdminUser();
    } catch (adminErr: any) {
      console.error('[FIREBASE] Erro ao assegurar usuário admin em segundo plano:', adminErr.message);
    }
  })();
}

// Inicializar middlewares e rotas de forma síncrona/imediata no nível do módulo (para Vercel Serverless)
app.use(express.json());

// Middleware para garantir sincronização antes de qualquer requisição de API
app.use(async (req, res, next) => {
    if (req.path.startsWith('/api')) {
      try {
        await ensureSync();
      } catch (err: any) {
        console.error('[MIDDLEWARE] Erro ao aguardar sincronização do banco:', err.message);
      }
    }
    next();
  });

  async function logAudit(req: express.Request, acao: string, detalhes: string) {
    const usuarioEmail = req.headers['x-user-email'] as string || 'sistema@escritorio.com.br';
    const usuarioNome = req.headers['x-user-name'] as string || 'Sistema';
    const newLog = {
      id: db.nextId.auditoria++,
      usuarioEmail,
      usuarioNome,
      acao,
      detalhes,
      dataHora: new Date().toISOString()
    };
    db.auditoria.push(newLog);
    try {
      if (firestoreDb) {
        await firestoreDb.collection('auditoria').doc(String(newLog.id)).set(newLog);
      }
    } catch (err: any) {
      console.error('[FIREBASE] Erro ao salvar log de auditoria:', err.message);
    }
    saveLocalDb();
  }

  // === AUDITORIA ===
  app.get('/api/auditoria', (_req, res) => {
    const sorted = [...db.auditoria].sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());
    res.json({ success: true, data: sorted });
  });

  app.post('/api/auditoria', async (req, res) => {
    const { acao, detalhes } = req.body;
    if (!acao || !detalhes) {
      res.status(400).json({ success: false, message: 'Ação e detalhes são obrigatórios.' });
      return;
    }
    await logAudit(req, acao, detalhes);
    res.status(201).json({ success: true });
  });

  // === DIAGNÓSTICOS E STATUS ===
  app.get('/api/firebase-status', async (req, res) => {
    let pingSuccess = false;
    let pingError = null;
    
    if (firestoreDb) {
      try {
        await firestoreDb.collection('config').doc('ping').set({ timestamp: new Date().toISOString() });
        pingSuccess = true;
      } catch (pingErr: any) {
        pingError = pingErr.message;
      }
    }
    
    res.json({
      success: true,
      firebaseInitialized: !!firestoreDb,
      projectId: firebaseConfig?.projectId || null,
      hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
      serviceAccountLength: process.env.FIREBASE_SERVICE_ACCOUNT ? process.env.FIREBASE_SERVICE_ACCOUNT.length : 0,
      initError: firebaseInitError,
      firestorePing: pingSuccess,
      pingError: pingError,
      geminiApiKeyConfigured: !!process.env.GEMINI_API_KEY,
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: !!process.env.VERCEL
    });
  });

  // === CLIENTES ===
  app.get('/api/clientes', (_req, res) => {
    res.json({ success: true, data: db.clientes });
  });

  app.post('/api/clientes', async (req, res) => {
    const { tipo, nome, doc, contato, email, endereco } = req.body;
    const errors: Record<string, string> = {};

    if (!nome || nome.trim().length < 3) {
      errors.nome = 'Nome deve conter pelo menos 3 caracteres.';
    }
    if (tipo === 'PF') {
      const cpfCheck = validateCPF(doc);
      if (!cpfCheck.isValid) errors.doc = `[BACKEND] ${cpfCheck.message}`;
    } else if (tipo === 'PJ') {
      const cnpjCheck = validateCNPJ(doc);
      if (!cnpjCheck.isValid) errors.doc = `[BACKEND] ${cnpjCheck.message}`;
    }
    const phoneCheck = validatePhone(contato);
    if (!phoneCheck.isValid) errors.contato = `[BACKEND] ${phoneCheck.message}`;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'E-mail inválido.';
    }

    if (Object.keys(errors).length > 0) {
      res.status(400).json({ success: false, message: 'Falha na validação.', errors });
      return;
    }

    const newClient = {
      id: db.nextId.cliente++,
      tipo,
      nome,
      doc,
      contato,
      email: email || '',
      endereco: endereco || '',
      created_at: new Date().toISOString().slice(0, 10),
    };
    try {
      if (firestoreDb) {
        await firestoreDb.collection('clientes').doc(String(newClient.id)).set(newClient);
      }
      db.clientes.push(newClient);
      saveLocalDb();
      await logAudit(req, 'Criar Cliente', `Criou o cliente ${newClient.nome} (ID: ${newClient.id}, Tipo: ${newClient.tipo})`);
      res.status(201).json({ success: true, message: 'Cliente cadastrado!', data: newClient });
    } catch (err: any) {
      console.error('[FIREBASE] Erro ao salvar cliente:', err.message);
      res.status(500).json({ success: false, message: 'Erro ao gravar cliente no Firestore: ' + err.message });
    }
  });

  app.delete('/api/clientes/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const clientToDelete = db.clientes.find((c) => c.id === id);
    const clientName = clientToDelete ? clientToDelete.nome : 'Desconhecido';
    try {
      if (firestoreDb) {
        await firestoreDb.collection('clientes').doc(String(id)).delete();
      }
      db.clientes = db.clientes.filter((c) => c.id !== id);
      saveLocalDb();
      await logAudit(req, 'Deletar Cliente', `Excluiu o cliente ${clientName} (ID: ${id})`);
      res.json({ success: true, message: 'Cliente excluído com sucesso!' });
    } catch (err: any) {
      console.error('[FIREBASE] Erro ao deletar cliente:', err.message);
      res.status(500).json({ success: false, message: 'Erro ao excluir cliente no Firestore: ' + err.message });
    }
  });

  // === PROCESSOS ===
  app.get('/api/processos', (_req, res) => {
    res.json({ success: true, data: db.processos });
  });

  app.post('/api/processos', async (req, res) => {
    const { numero, tribunal, vara, classe, assunto, clienteId, advogadoId, valorCausa } = req.body;
    if (!numero || !clienteId || !advogadoId) {
      res.status(400).json({ success: false, message: 'Campos obrigatórios ausentes.' });
      return;
    }
    const newProcesso = {
      id: db.nextId.processo++,
      numero,
      tribunal: tribunal || 'TJMG',
      vara: vara || 'Vara Única',
      classe: classe || 'Ação Ordinária',
      assunto: assunto || 'Geral',
      clienteId: parseInt(clienteId),
      advogadoId: parseInt(advogadoId),
      status: 'ativo' as const,
      valorCausa: parseFloat(valorCausa) || 0,
      andamentos: [{ data: new Date().toISOString().slice(0, 10), desc: 'Processo cadastrado' }],
    };
    db.processos.push(newProcesso);
    try {
      if (firestoreDb) {
        await firestoreDb.collection('processos').doc(String(newProcesso.id)).set(newProcesso);
      }
    } catch (err: any) {
      console.error('[FIREBASE] Erro ao salvar processo:', err.message);
    }
    await logAudit(req, 'Criar Processo', `Criou o processo nº ${newProcesso.numero} (ID: ${newProcesso.id})`);
    res.status(201).json({ success: true, data: newProcesso });
  });

  app.post('/api/processos/:id/andamentos', async (req, res) => {
    const id = parseInt(req.params.id);
    const { desc } = req.body;
    if (!desc?.trim()) {
      res.status(400).json({ success: false, message: 'Descrição vazia.' });
      return;
    }
    const proc = db.processos.find((p) => p.id === id);
    if (!proc) {
      res.status(404).json({ success: false, message: 'Processo não encontrado.' });
      return;
    }
    proc.andamentos.push({ data: new Date().toISOString().slice(0, 10), desc: desc.trim() });
    try {
      if (firestoreDb) {
        await firestoreDb.collection('processos').doc(String(proc.id)).set(proc);
      }
    } catch (err: any) {
      console.error('[FIREBASE] Erro ao atualizar andamento do processo:', err.message);
    }
    await logAudit(req, 'Adicionar Andamento', `Adicionou andamento ao processo nº ${proc.numero}: "${desc.trim()}"`);
    res.json({ success: true, data: proc });
  });

  app.delete('/api/processos/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const procToDelete = db.processos.find((p) => p.id === id);
    const procNum = procToDelete ? procToDelete.numero : 'Desconhecido';
    db.processos = db.processos.filter((p) => p.id !== id);
    try {
      if (firestoreDb) {
        await firestoreDb.collection('processos').doc(String(id)).delete();
      }
    } catch (err: any) {
      console.error('[FIREBASE] Erro ao deletar processo:', err.message);
    }
    await logAudit(req, 'Deletar Processo', `Excluiu o processo nº ${procNum} (ID: ${id})`);
    res.json({ success: true });
  });

  // === EVENTOS ===
  app.get('/api/eventos', (_req, res) => {
    res.json({ success: true, data: db.eventos });
  });

  app.post('/api/eventos', async (req, res) => {
    const { tipo, processoId, data, hora, local } = req.body;
    if (!tipo || !data || !hora) {
      res.status(400).json({ success: false, message: 'Campos obrigatórios ausentes.' });
      return;
    }
    const newEvent = {
      id: db.nextId.evento++,
      tipo,
      processoId: processoId ? parseInt(processoId) : null,
      data,
      hora,
      local: local || 'Escritório',
    };
    db.eventos.push(newEvent);
    try {
      if (firestoreDb) {
        await firestoreDb.collection('eventos').doc(String(newEvent.id)).set(newEvent);
      }
    } catch (err: any) {
      console.error('[FIREBASE] Erro ao salvar evento:', err.message);
    }
    await logAudit(req, 'Criar Evento', `Criou o evento "${newEvent.tipo}" na data ${newEvent.data} às ${newEvent.hora}`);
    res.status(201).json({ success: true, data: newEvent });
  });

  app.delete('/api/eventos/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const evToDelete = db.eventos.find((e) => e.id === id);
    const evType = evToDelete ? evToDelete.tipo : 'Desconhecido';
    db.eventos = db.eventos.filter((e) => e.id !== id);
    try {
      if (firestoreDb) {
        await firestoreDb.collection('eventos').doc(String(id)).delete();
      }
    } catch (err: any) {
      console.error('[FIREBASE] Erro ao deletar evento:', err.message);
    }
    await logAudit(req, 'Deletar Evento', `Excluiu o evento "${evType}" (ID: ${id})`);
    res.json({ success: true });
  });

  // === TAREFAS ===
  app.get('/api/tarefas', (_req, res) => {
    res.json({ success: true, data: db.tarefas });
  });

  app.post('/api/tarefas', async (req, res) => {
    const { titulo, responsavelId, processoId, prioridade, prazo } = req.body;
    if (!titulo || !responsavelId) {
      res.status(400).json({ success: false, message: 'Campos obrigatórios ausentes.' });
      return;
    }
    const newTask = {
      id: db.nextId.tarefa++,
      titulo,
      responsavelId: parseInt(responsavelId),
      processoId: processoId ? parseInt(processoId) : null,
      prioridade: prioridade || 'media',
      status: 'pendente' as const,
      prazo: prazo || new Date().toISOString().slice(0, 10),
    };
    db.tarefas.push(newTask);
    try {
      if (firestoreDb) {
        await firestoreDb.collection('tarefas').doc(String(newTask.id)).set(newTask);
      }
    } catch (err: any) {
      console.error('[FIREBASE] Erro ao salvar tarefa:', err.message);
    }
    await logAudit(req, 'Criar Tarefa', `Criou a tarefa "${newTask.titulo}" (ID: ${newTask.id})`);
    res.status(201).json({ success: true, data: newTask });
  });

  app.put('/api/tarefas/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    const task = db.tarefas.find((t) => t.id === id);
    if (!task) {
      res.status(404).json({ success: false, message: 'Tarefa não encontrada.' });
      return;
    }
    task.status = status;
    try {
      if (firestoreDb) {
        await firestoreDb.collection('tarefas').doc(String(task.id)).set(task);
      }
    } catch (err: any) {
      console.error('[FIREBASE] Erro ao atualizar tarefa:', err.message);
    }
    await logAudit(req, 'Atualizar Tarefa', `Alterou o status da tarefa "${task.titulo}" para "${status}"`);
    res.json({ success: true, data: task });
  });

  app.delete('/api/tarefas/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const tToDelete = db.tarefas.find((t) => t.id === id);
    const tTitle = tToDelete ? tToDelete.titulo : 'Desconhecido';
    db.tarefas = db.tarefas.filter((t) => t.id !== id);
    try {
      if (firestoreDb) {
        await firestoreDb.collection('tarefas').doc(String(id)).delete();
      }
    } catch (err: any) {
      console.error('[FIREBASE] Erro ao deletar tarefa:', err.message);
    }
    await logAudit(req, 'Deletar Tarefa', `Excluiu a tarefa "${tTitle}" (ID: ${id})`);
    res.json({ success: true });
  });

  // === HONORÁRIOS ===
  app.get('/api/honorarios', (_req, res) => {
    res.json({ success: true, data: db.honorarios });
  });

  app.post('/api/honorarios', async (req, res) => {
    const { clienteId, processoId, valor, tipo, vencimento } = req.body;
    if (!clienteId || !valor || !vencimento) {
      res.status(400).json({ success: false, message: 'Campos obrigatórios ausentes.' });
      return;
    }
    const newHonorario = {
      id: db.nextId.honorario++,
      clienteId: parseInt(clienteId),
      processoId: processoId ? parseInt(processoId) : null,
      valor: parseFloat(valor),
      tipo: tipo || 'fixo',
      status: 'pendente' as const,
      vencimento,
    };
    db.honorarios.push(newHonorario);
    try {
      if (firestoreDb) {
        await firestoreDb.collection('honorarios').doc(String(newHonorario.id)).set(newHonorario);
      }
    } catch (err: any) {
      console.error('[FIREBASE] Erro ao salvar honorário:', err.message);
    }
    await logAudit(req, 'Criar Honorário', `Criou o honorário no valor de R$ ${newHonorario.valor} (ID: ${newHonorario.id})`);
    res.status(201).json({ success: true, data: newHonorario });
  });

  app.put('/api/honorarios/:id/pago', async (req, res) => {
    const id = parseInt(req.params.id);
    const hon = db.honorarios.find((h) => h.id === id);
    if (!hon) {
      res.status(404).json({ success: false, message: 'Honorário não encontrado.' });
      return;
    }
    hon.status = 'pago';
    try {
      if (firestoreDb) {
        await firestoreDb.collection('honorarios').doc(String(hon.id)).set(hon);
      }
    } catch (err: any) {
      console.error('[FIREBASE] Erro ao atualizar honorário:', err.message);
    }
    await logAudit(req, 'Baixa de Honorário', `Marcou o honorário ID ${hon.id} como pago`);
    res.json({ success: true, data: hon });
  });

  app.delete('/api/honorarios/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    db.honorarios = db.honorarios.filter((h) => h.id !== id);
    try {
      if (firestoreDb) {
        await firestoreDb.collection('honorarios').doc(String(id)).delete();
      }
    } catch (err: any) {
      console.error('[FIREBASE] Erro ao deletar honorário:', err.message);
    }
    await logAudit(req, 'Deletar Honorário', `Excluiu o honorário ID ${id}`);
    res.json({ success: true });
  });

  // === DESPESAS ===
  app.get('/api/despesas', (_req, res) => {
    res.json({ success: true, data: db.despesas });
  });

  app.post('/api/despesas', async (req, res) => {
    const { descricao, valor, vencimento } = req.body;
    if (!descricao || !valor || !vencimento) {
      res.status(400).json({ success: false, message: 'Campos obrigatórios ausentes.' });
      return;
    }
    const newDespesa = {
      id: db.nextId.despesa++,
      descricao,
      valor: parseFloat(valor),
      vencimento,
      status: 'pendente' as const,
    };
    db.despesas.push(newDespesa);
    try {
      if (firestoreDb) {
        await firestoreDb.collection('despesas').doc(String(newDespesa.id)).set(newDespesa);
      }
    } catch (err: any) {
      console.error('[FIREBASE] Erro ao salvar despesa:', err.message);
    }
    await logAudit(req, 'Criar Despesa', `Criou a despesa "${newDespesa.descricao}" no valor de R$ ${newDespesa.valor}`);
    res.status(201).json({ success: true, data: newDespesa });
  });

  app.put('/api/despesas/:id/pago', async (req, res) => {
    const id = parseInt(req.params.id);
    const despesa = db.despesas.find((d) => d.id === id);
    if (!despesa) {
      res.status(404).json({ success: false, message: 'Despesa não encontrada.' });
      return;
    }
    despesa.status = 'pago';
    try {
      if (firestoreDb) {
        await firestoreDb.collection('despesas').doc(String(despesa.id)).set(despesa);
      }
    } catch (err: any) {
      console.error('[FIREBASE] Erro ao atualizar despesa:', err.message);
    }
    await logAudit(req, 'Baixa de Despesa', `Marcou a despesa "${despesa.descricao}" (ID: ${despesa.id}) como paga`);
    res.json({ success: true, data: despesa });
  });

  app.delete('/api/despesas/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const dToDelete = db.despesas.find((d) => d.id === id);
    const dDesc = dToDelete ? dToDelete.descricao : 'Desconhecido';
    db.despesas = db.despesas.filter((d) => d.id !== id);
    try {
      if (firestoreDb) {
        await firestoreDb.collection('despesas').doc(String(id)).delete();
      }
    } catch (err: any) {
      console.error('[FIREBASE] Erro ao deletar despesa:', err.message);
    }
    await logAudit(req, 'Deletar Despesa', `Excluiu a despesa "${dDesc}" (ID: ${id})`);
    res.json({ success: true });
  });

  // === DOCUMENTOS ===
  app.get('/api/documentos', (_req, res) => {
    res.json({ success: true, data: db.documentos });
  });

  app.post('/api/documentos', async (req, res) => {
    const { nome, clienteId, processoId } = req.body;
    if (!nome || !clienteId) {
      res.status(400).json({ success: false, message: 'Campos obrigatórios ausentes.' });
      return;
    }
    const newDoc = {
      id: db.nextId.documento++,
      nome,
      clienteId: parseInt(clienteId),
      processoId: processoId ? parseInt(processoId) : null,
      data: new Date().toISOString().slice(0, 10),
      assinatura: 'pendente',
      origem: 'upload',
    };
    db.documentos.push(newDoc);
    try {
      if (firestoreDb) {
        await firestoreDb.collection('documentos').doc(String(newDoc.id)).set(newDoc);
      }
    } catch (err: any) {
      console.error('[FIREBASE] Erro ao salvar documento:', err.message);
    }
    await logAudit(req, 'Criar Documento', `Criou o documento "${newDoc.nome}" (ID: ${newDoc.id})`);
    res.status(201).json({ success: true, data: newDoc });
  });

  app.delete('/api/documentos/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const docToDelete = db.documentos.find((d) => d.id === id);
    const docNome = docToDelete ? docToDelete.nome : 'Desconhecido';
    db.documentos = db.documentos.filter((d) => d.id !== id);
    try {
      if (firestoreDb) {
        await firestoreDb.collection('documentos').doc(String(id)).delete();
      }
    } catch (err: any) {
      console.error('[FIREBASE] Erro ao deletar documento:', err.message);
    }
    await logAudit(req, 'Deletar Documento', `Excluiu o documento "${docNome}" (ID: ${id})`);
    res.json({ success: true });
  });

  // === USUÁRIOS ===
  app.get('/api/usuarios', async (_req, res) => {
    if (firestoreDb) {
      try {
        const authUsers = await getAuth().listUsers();
        const existingEmails = new Set(db.usuarios.map(u => (u.email || '').toLowerCase()));
        let maxId = Math.max(...db.usuarios.map(u => u.id || 0), 0);

        const usuariosRef = firestoreDb.collection('usuarios');
        let altered = false;
        for (const authUser of authUsers.users) {
          if (authUser.email) {
            const emailLower = authUser.email.toLowerCase();
            if (!existingEmails.has(emailLower)) {
              maxId++;
              const newUser = {
                id: maxId,
                nome: authUser.displayName || authUser.email.split('@')[0],
                email: authUser.email,
                perfil: (emailLower === 'vidal2311usa@gmail.com' || emailLower === 'bandavai62@gmail.com') ? 'Administrador' : 'Advogado'
              };
              console.log(`[FIREBASE] Adicionando novo usuário encontrado no Auth para o Firestore: ${emailLower}`);
              await usuariosRef.doc(String(newUser.id)).set(newUser);
              db.usuarios.push(newUser);
              existingEmails.add(emailLower);
              altered = true;
            }
          }
        }
        if (altered) {
          db.nextId.usuario = maxId + 1;
          saveLocalDb();
        }
      } catch (err: any) {
        console.error('[FIREBASE] Erro ao sincronizar usuários em /api/usuarios:', err.message);
      }
    }
    res.json({ success: true, data: db.usuarios });
  });

  app.post('/api/usuarios', async (req, res) => {
    const { nome, email, perfil, id, senha } = req.body;
    if (!nome || !email || !perfil) {
      res.status(400).json({ success: false, message: 'Campos obrigatórios ausentes.' });
      return;
    }
    const targetId = id ? parseInt(id) : db.nextId.usuario++;
    if (!id && targetId >= db.nextId.usuario) {
      db.nextId.usuario = targetId + 1;
    }
    const newUser = { id: targetId, nome, email, perfil };
    try {
      if (firestoreDb) {
        // Tentar criar no Firebase Auth se não existir
        try {
          const tempPassword = senha || Math.random().toString(36).slice(-10) + 'A1!';
          await getAuth().createUser({
            email: email.toLowerCase().trim(),
            password: tempPassword,
            displayName: nome
          });
          console.log(`[FIREBASE] Usuário ${email} criado no Firebase Auth pelo backend.`);
        } catch (authErr: any) {
          if (authErr.code === 'auth/email-already-exists') {
            console.log(`[FIREBASE] Usuário ${email} já existe no Firebase Auth.`);
          } else {
            console.error(`[FIREBASE] Erro ao criar usuário no Auth pelo backend:`, authErr.message);
          }
        }

        await firestoreDb.collection('usuarios').doc(String(newUser.id)).set(newUser);
      }
      db.usuarios.push(newUser);
      saveLocalDb();
      await logAudit(req, 'Criar Usuário', `Criou o usuário "${newUser.nome}" (${newUser.email}, Perfil: ${newUser.perfil})`);
      res.status(201).json({ success: true, data: newUser, firestoreIsNotNull: !!firestoreDb, err: firebaseInitError });
    } catch (err: any) {
      console.error('[FIREBASE] Erro ao salvar usuário:', err.message);
      res.status(500).json({ success: false, message: 'Erro ao gravar usuário no Firestore: ' + err.message });
    }
  });

  app.post('/api/garantir-usuario-auth', async (req, res) => {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ success: false, message: 'O e-mail é obrigatório.' });
      return;
    }
    const emailLower = email.toLowerCase().trim();
    const user = db.usuarios.find((u) => (u.email || '').toLowerCase().trim() === emailLower);
    
    if (!user) {
      res.status(404).json({ success: false, message: 'E-mail corporativo não cadastrado no sistema.' });
      return;
    }

    if (firestoreDb) {
      try {
        try {
          await getAuth().getUserByEmail(emailLower);
          console.log(`[FIREBASE] Usuário ${emailLower} já existe no Firebase Auth.`);
        } catch (authErr: any) {
          if (authErr.code === 'auth/user-not-found') {
            const tempPassword = Math.random().toString(36).slice(-10) + 'A1!';
            await getAuth().createUser({
              email: emailLower,
              password: tempPassword,
              displayName: user.nome || emailLower.split('@')[0],
            });
            console.log(`[FIREBASE] Usuário ${emailLower} criado com sucesso no Firebase Auth via garantia de recuperação.`);
          } else {
            throw authErr;
          }
        }
        res.json({ success: true, message: 'Usuário garantido no Firebase Auth.' });
      } catch (err: any) {
        console.error('[FIREBASE] Erro ao garantir usuário no Firebase Auth:', err.message);
        res.status(500).json({ success: false, message: 'Erro ao registrar usuário no Firebase Auth: ' + err.message });
      }
    } else {
      res.json({ success: true, message: 'Modo contingência (sem FirestoreDb).' });
    }
  });

  app.delete('/api/usuarios/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const uToDelete = db.usuarios.find((u) => u.id === id);
    const uEmail = uToDelete ? uToDelete.email : 'Desconhecido';
    try {
      if (firestoreDb) {
        await firestoreDb.collection('usuarios').doc(String(id)).delete();
      }
      db.usuarios = db.usuarios.filter((u) => u.id !== id);
      saveLocalDb();
      await logAudit(req, 'Deletar Usuário', `Excluiu o usuário "${uEmail}" (ID: ${id})`);
      res.json({ success: true, message: 'Usuário excluído com sucesso!' });
    } catch (err: any) {
      console.error('[FIREBASE] Erro ao deletar usuário:', err.message);
      res.status(500).json({ success: false, message: 'Erro ao excluir usuário no Firestore: ' + err.message });
    }
  });

  // Store reset tokens in memory: { email: { token, expires } }
  const resetTokens = new Map<string, { token: string, expires: number }>();

  app.post('/api/recuperar-senha', async (req, res) => {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ success: false, message: 'O e-mail corporativo é obrigatório.' });
      return;
    }
    const user = db.usuarios.find((u) => u.email.toLowerCase() === email.toLowerCase().trim());
    if (!user) {
      res.status(404).json({ success: false, message: 'E-mail corporativo não cadastrado no sistema.' });
      return;
    }

    // Generate a 6 digit code
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 15 * 60 * 1000; // 15 minutes
    resetTokens.set(email.toLowerCase().trim(), { token, expires });

    // Send email using nodemailer
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      console.warn('[EMAIL] Variáveis de ambiente SMTP não configuradas. Simulação de envio apenas.');
      console.log(`[EMAIL SIMULADO] Para: ${email}, Código: ${token}`);
      res.json({ success: true, message: `O código seria enviado para ${email}, mas o servidor SMTP não está configurado. O código de teste é: ${token}` });
      return;
    }

    try {
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: parseInt(SMTP_PORT || '465'),
        secure: parseInt(SMTP_PORT || '465') === 465,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: SMTP_FROM || SMTP_USER,
        to: email.trim(),
        subject: 'Recuperação de Senha — IA & Automação',
        text: `Olá ${user.nome},\n\nRecebemos uma solicitação de redefinição de senha para sua conta.\n\nSeu código de verificação é: ${token}\n\nEste código expira em 15 minutos.\n\nSe você não solicitou esta alteração, desconsidere este e-mail.`,
        html: `<p>Olá ${user.nome},</p><p>Recebemos uma solicitação de redefinição de senha para sua conta.</p><p>Seu código de verificação é: <strong>${token}</strong></p><p>Este código expira em 15 minutos.</p><p>Se você não solicitou esta alteração, desconsidere este e-mail.</p>`
      });

      res.json({ success: true, message: `Código de verificação enviado para o e-mail: ${email.trim()}` });
    } catch (err: any) {
      console.error('[EMAIL] Erro ao enviar e-mail:', err);
      res.status(500).json({ success: false, message: 'Falha ao enviar e-mail. Verifique as configurações SMTP.' });
    }
  });

  app.post('/api/redefinir-senha', async (req, res) => {
    const { email, token, novaSenha } = req.body;
    if (!email || !token || !novaSenha) {
      res.status(400).json({ success: false, message: 'E-mail, código e nova senha são obrigatórios.' });
      return;
    }

    const emailKey = email.toLowerCase().trim();
    const tokenData = resetTokens.get(emailKey);

    if (!tokenData) {
      res.status(400).json({ success: false, message: 'Nenhum código de recuperação solicitado ou ele já expirou.' });
      return;
    }

    if (Date.now() > tokenData.expires) {
      resetTokens.delete(emailKey);
      res.status(400).json({ success: false, message: 'O código de recuperação expirou. Solicite um novo.' });
      return;
    }

    if (tokenData.token !== token.trim()) {
      res.status(400).json({ success: false, message: 'Código de verificação incorreto.' });
      return;
    }

    const user = db.usuarios.find((u) => u.email.toLowerCase() === emailKey);
    if (!user) {
      res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
      return;
    }

    // Update password
    user.senha = novaSenha;
    try {
      if (firestoreDb) {
        await firestoreDb.collection('usuarios').doc(String(user.id)).set(user);
      }
    } catch (err: any) {
      console.error('[FIREBASE] Erro ao salvar senha do usuário:', err.message);
    }

    // Sincronizar redefinição de senha com o Firebase Auth para permitir o login pelo Firebase client
    try {
      const authUser = await getAuth().getUserByEmail(emailKey);
      await getAuth().updateUser(authUser.uid, { password: novaSenha });
      console.log(`[FIREBASE] Senha atualizada no Firebase Auth com sucesso para ${emailKey}`);
    } catch (authErr: any) {
      console.warn('[FIREBASE] Usuário não existia no Auth ou erro de sinc ao redefinir, tentando criar:', authErr.message);
      try {
        await getAuth().createUser({
          email: emailKey,
          password: novaSenha,
          displayName: user.nome || emailKey.split('@')[0],
        });
        console.log(`[FIREBASE] Usuário ${emailKey} criado no Firebase Auth com a nova senha.`);
      } catch (createErr: any) {
        console.error('[FIREBASE] Erro ao criar usuário no Auth ao redefinir:', createErr.message);
      }
    }

    await logAudit(req, 'Redefinir Senha', `Redefiniu a senha do usuário ${user.nome} (${user.email})`);

    resetTokens.delete(emailKey); // use token only once
    res.json({ success: true, message: 'Senha redefinida com sucesso!' });
  });

  // === CONFIGURAÇÕES / INTEGRAÇÕES ===
  app.get('/api/integracoes', (_req, res) => {
    res.json({ success: true, data: db.integracoes });
  });

  app.put('/api/integracoes', async (req, res) => {
    db.integracoes = { ...db.integracoes, ...req.body };
    try {
      if (firestoreDb) {
        await firestoreDb.collection('config').doc('integracoes').set(db.integracoes);
      }
    } catch (err: any) {
      console.error('[FIREBASE] Erro ao salvar configurações de integrações:', err.message);
    }
    await logAudit(req, 'Atualizar Integrações', `Atualizou as configurações de integrações do sistema: ${JSON.stringify(req.body)}`);
    res.json({ success: true, data: db.integracoes });
  });

  // === DATAJUD (Consulta processo no CNJ) ===
  app.get('/api/datajud/:numero', async (req, res) => {
    try {
      const numero = req.params.numero.replace(/\D/g, '');
      const parts = numero.match(/^(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})$/);
      if (!parts) {
        res.status(400).json({ success: false, message: 'Formato inválido.' });
        return;
      }
      const ramo = parts[4];
      const tribunal = parts[5];

      const trfs: Record<string, string> = { '01': 'trf1', '02': 'trf2', '03': 'trf3', '04': 'trf4', '05': 'trf5', '06': 'trf6' };
      const trts: Record<string, string> = { '01': 'trt1', '02': 'trt2', '03': 'trt3', '04': 'trt4', '05': 'trt5', '06': 'trt6', '07': 'trt7', '08': 'trt8', '09': 'trt9', '10': 'trt10', '11': 'trt11', '12': 'trt12', '13': 'trt13', '14': 'trt14', '15': 'trt15', '16': 'trt16', '17': 'trt17', '18': 'trt18', '19': 'trt19', '20': 'trt20', '21': 'trt21', '22': 'trt22', '23': 'trt23', '24': 'trt24' };
      const tjs: Record<string, string> = { '01': 'tjac', '02': 'tjal', '03': 'tjap', '04': 'tjam', '05': 'tjba', '06': 'tjce', '07': 'tjdft', '08': 'tjes', '09': 'tjgo', '10': 'tjma', '11': 'tjmt', '12': 'tjms', '13': 'tjmg', '14': 'tjpa', '15': 'tjpb', '16': 'tjpr', '17': 'tjpe', '18': 'tjpi', '19': 'tjrj', '20': 'tjrn', '21': 'tjrs', '22': 'tjro', '23': 'tjrr', '24': 'tjsc', '25': 'tjsp', '26': 'tjse', '27': 'tjto' };

      let tribunalIndex = '';
      if (ramo === '4') tribunalIndex = trfs[tribunal];
      else if (ramo === '5') tribunalIndex = trts[tribunal];
      else if (ramo === '8') tribunalIndex = tjs[tribunal];
      else if (['1', '2', '3'].includes(ramo)) tribunalIndex = 'stj';

      if (!tribunalIndex) {
        res.status(400).json({ success: false, message: 'Tribunal não suportado.' });
        return;
      }

      const datajudRes = await fetch(
        `https://api-publica.datajud.cnj.jus.br/api_publica_${tribunalIndex}/_search`,
        {
          method: 'POST',
          headers: {
            Authorization: 'APIKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: { match: { numeroProcesso: numero } }, size: 1 }),
        }
      );

      if (!datajudRes.ok) {
        res.status(datajudRes.status).json({ success: false, message: 'Erro ao consultar Datajud.' });
        return;
      }

      const data = await datajudRes.json() as any;
      if (!data.hits?.hits?.length) {
        res.status(404).json({ success: false, message: 'Processo não encontrado.' });
        return;
      }
      res.json({ success: true, data: data.hits.hits[0]._source });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Erro interno.' });
    }
  });

  // === IA: RESUMIR PROCESSO ===
  app.post('/api/ia/resumir-processo', async (req, res) => {
    const { processoId } = req.body;
    const proc = db.processos.find((p) => p.id === parseInt(processoId));
    if (!proc) {
      res.status(404).json({ success: false, message: 'Processo não encontrado.' });
      return;
    }
    const client = db.clientes.find((c) => c.id === proc.clienteId);
    const andamentosText = (proc.andamentos || []).map((a: any) => `- [${a.data}] ${a.desc}`).join('\n');

    const prompt = `Como assistente jurídico, elabore um resumo executivo deste processo:
Número: ${proc.numero}
Classe: ${proc.classe}
Assunto: ${proc.assunto}
Cliente: ${client?.nome || 'N/A'}
Andamentos:
${andamentosText}

Resuma em até 6 linhas com: visão geral, situação atual e próximos passos.`;

    try {
      const ai = getGenAI();
      const response = await ai.models.generateContent({ model: 'gemini-3.5-flash', contents: prompt });
      res.json({ success: true, data: { resumo: response.text } });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Erro na IA: ' + err.message, error: err.message });
    }
  });

  // === IA: GERAR DOCUMENTO ===
  app.post('/api/ia/gerar-documento', async (req, res) => {
    const { tipo, clienteId, processoId, observacoes } = req.body;
    const client = db.clientes.find((c) => c.id === parseInt(clienteId));
    if (!client) {
      res.status(404).json({ success: false, message: 'Cliente não encontrado.' });
      return;
    }

    let procDetails = '';
    if (processoId) {
      const proc = db.processos.find((p) => p.id === parseInt(processoId));
      if (proc) {
        procDetails = `\nProcesso: ${proc.numero}\nTribunal: ${proc.tribunal} · Vara: ${proc.vara}`;
      }
    }

    const prompt = `Aja como advogado especialista. Redija ${tipo} em português brasileiro.

Cliente: ${client.nome}, documento: ${client.doc}${procDetails}

Instruções: ${observacoes || 'Nenhuma observação adicional.'}

Estruturas recomendadas: endereçamento, qualificação, fatos, fundamentos legais, pedidos e valor da causa (se aplicável).`;

    try {
      const ai = getGenAI();
      const response = await ai.models.generateContent({ model: 'gemini-3.5-flash', contents: prompt });
      res.json({ success: true, data: { documentoGerado: response.text } });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Erro na IA: ' + err.message, error: err.message });
    }
  });

  // === IA: CHAT JURÍDICO ===
  app.post('/api/ia/chat', async (req, res) => {
    const { mensagem, historico } = req.body;

    const systemPrompt = `Você é o Sistema Jurídico Inteligente, um assistente para advogados brasileiros.
Comunicação técnica, objetiva e fundamentada. Diferencie fatos, hipóteses e opiniões.
Não invente leis ou decisões. Quando citar legislação, identifique a fonte.
Estruture respostas em: Resumo, Questões jurídicas, Legislação, Análise, Estratégias, Riscos, Próximos passos.`;

    const contents = [
      systemPrompt,
      ...(historico || []).map((m: any) => `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content}`),
      `Usuário: ${mensagem}`,
    ].join('\n\n');

    try {
      const ai = getGenAI();
      const response = await ai.models.generateContent({ model: 'gemini-3.5-flash', contents });
      res.json({ success: true, data: { resposta: response.text } });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Erro na IA: ' + err.message, error: err.message });
    }
  });

  // === IA: ANÁLISE DE CONTRATO ===
  app.post('/api/ia/analise-contrato', async (req, res) => {
    const { contrato, tipoContrato } = req.body;

    const prompt = `Analise o contrato abaixo como advogado especialista.
Tipo: ${tipoContrato || 'Não especificado'}

CONTRATO:
${contrato}

Identifique: cláusulas abusivas, risks, responsabilidades, multas, garantias, lacunas e sugestões de melhoria. Cite o número da cláusula.`;

    try {
      const ai = getGenAI();
      const response = await ai.models.generateContent({ model: 'gemini-3.5-flash', contents: prompt });
      res.json({ success: true, data: { analise: response.text } });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Erro na IA: ' + err.message, error: err.message });
    }
  });

  // === IA: ESTRATÉGIA PROCESSUAL ===
  app.post('/api/ia/estrategia', async (req, res) => {
    const { caso, areaDireito, objetivo } = req.body;

    const prompt = `Analise estrategicamente o caso como advogado experiente.
Área: ${areaDireito || 'Não especificada'}
Objetivo: ${objetivo || 'Não especificado'}

CASO:
${caso}

Identifique: pontos fortes, pontos fracos, riscos, teses favoráveis, teses contrárias, defesas da parte adversa, estratégias de provas e alternativas.`;

    try {
      const ai = getGenAI();
      const response = await ai.models.generateContent({ model: 'gemini-3.5-flash', contents: prompt });
      res.json({ success: true, data: { estrategia: response.text } });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Erro na IA: ' + err.message, error: err.message });
    }
  });

  // === IA: PARECER JURÍDICO ===
  app.post('/api/ia/parecer', async (req, res) => {
    const { caso, areaDireito, pergunta } = req.body;

    const prompt = `Elabore parecer jurídico estruturado.
Área: ${areaDireito || 'Não especificada'}
${pergunta ? `Pergunta: ${pergunta}` : ''}

CASO:
${caso}

Estruture com: Sumário, Relatório (fatos), Fundamentação (análise jurídica com legislação e jurisprudência), Conclusão e Recomendações.`;

    try {
      const ai = getGenAI();
      const response = await ai.models.generateContent({ model: 'gemini-3.5-flash', contents: prompt });
      res.json({ success: true, data: { parecer: response.text } });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Erro na IA: ' + err.message, error: err.message });
    }
  });

async function startListening() {
  const PORT = parseInt(process.env.PORT || '3000', 10);

  // === Vite em desenvolvimento ===
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
      root: __dirname,
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Não iniciar o listen se estiver no Vercel (as funções serverless controlam o ciclo de vida)
  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[SERVER] Rodando em http://localhost:${PORT}`);
      // Sincroniza em segundo plano sem bloquear a inicialização do servidor
      syncFirestore().catch((err) => {
        console.error('[FIREBASE] Falha assíncrona na sincronização:', err);
      });
    });
  } else {
    console.log('[SERVER] Iniciado em modo Vercel serverless.');
    // Garantir sincronização inicial para Vercel na inicialização do arquivo
    syncFirestore().catch((err) => {
      console.error('[FIREBASE] Sincronização inicial em modo serverless falhou:', err);
    });
  }
}

// Inicia as inicializações de segundo plano do Firebase/Admin
startServer().catch((err) => {
  console.error('Erro ao iniciar inicializações de fundo:', err);
});

// Inicia o roteamento do Vite e do servidor de desenvolvimento ou static files
startListening().catch((err) => {
  console.error('Erro ao iniciar roteamento de escuta:', err);
});

export default app;
