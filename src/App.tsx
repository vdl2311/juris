import React, { useState, useEffect } from 'react';
import { db, fmtDate, fmtMoney, clienteNome, usuarioNome, processoLabel, diasRestantes, loadAllDataFromBackend } from './db';
import {
  Menu, X, LayoutDashboard, Users, FolderKanban, Calendar, CheckSquare,
  DollarSign, FileText, Cpu, Settings, ExternalLink, BarChart3, UsersRound,
  Bell, Scale, Clock, Sparkles, Search, CheckCircle, AlertTriangle, Plus,
  Trash2, Brain, Target, FileCheck, Gavel, Calculator, MessageSquare, ClipboardList,
  LogIn, LogOut, ChevronDown, ShieldCheck, Send, Download, Copy, ArrowLeft, ArrowRight,
  Upload, CheckCircle2, Mail, Lock,
} from 'lucide-react';
import { auth, firebaseConfig, initializeApp } from './firebase';
import { sendPasswordResetEmail, signInWithEmailAndPassword, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import ClienteFormModal from './components/ClienteFormModal';
import ProcessoFormModal from './components/ProcessoFormModal';
import EventoFormModal from './components/EventoFormModal';
import DocumentoFormModal from './components/DocumentoFormModal';
import TarefaFormModal from './components/TarefaFormModal';
import HonorarioFormModal from './components/HonorarioFormModal';
import DespesaFormModal from './components/DespesaFormModal';
import { maskProcesso } from './utils/validation';

const PERMISSOES: Record<string, string[]> = {
  'Administrador': ['dashboard', 'clientes', 'processos', 'agenda', 'tarefas', 'financeiro', 'documentos', 'relatorios', 'usuarios', 'ia', 'integracoes', 'portal', 'inteligencia', 'pesquisa', 'estrategia', 'pecas', 'contratos', 'parecer', 'calculos'],
  'Advogado': ['dashboard', 'clientes', 'processos', 'agenda', 'tarefas', 'financeiro', 'documentos', 'relatorios', 'ia', 'portal', 'inteligencia', 'pesquisa', 'estrategia', 'pecas', 'contratos', 'parecer', 'calculos'],
  'Estagiário': ['dashboard', 'processos', 'agenda', 'tarefas', 'documentos', 'ia', 'pesquisa', 'inteligencia'],
  'Secretária': ['dashboard', 'clientes', 'agenda', 'tarefas', 'documentos', 'integracoes'],
};

const NAV = [
  { id: 'dashboard', label: 'Dashboard', group: 'Visão Geral', icon: LayoutDashboard },
  { id: 'clientes', label: 'Clientes', group: 'Gestão', icon: Users },
  { id: 'processos', label: 'Processos', group: 'Gestão', icon: FolderKanban },
  { id: 'agenda', label: 'Agenda', group: 'Gestão', icon: Calendar },
  { id: 'tarefas', label: 'Tarefas', group: 'Gestão', icon: CheckSquare },
  { id: 'financeiro', label: 'Financeiro', group: 'Gestão', icon: DollarSign },
  { id: 'documentos', label: 'Documentos', group: 'Gestão', icon: FileText },
  { id: 'inteligencia', label: 'Inteligência Jurídica', group: 'IA Jurídica', icon: Brain },
  { id: 'ia', label: 'IA & Automação', group: 'IA Jurídica', icon: Cpu },
  { id: 'pesquisa', label: 'Pesquisa Jurídica', group: 'IA Jurídica', icon: Search },
  { id: 'estrategia', label: 'Estratégia Processual', group: 'IA Jurídica', icon: Target },
  { id: 'pecas', label: 'Elaboração de Peças', group: 'IA Jurídica', icon: FileText },
  { id: 'contratos', label: 'Análise de Contratos', group: 'IA Jurídica', icon: FileCheck },
  { id: 'parecer', label: 'Parecer Jurídico', group: 'IA Jurídica', icon: Gavel },
  { id: 'calculos', label: 'Cálculos Jurídicos', group: 'Ferramentas', icon: Calculator },
  { id: 'integracoes', label: 'Integrações', group: 'Administração', icon: Settings },
  { id: 'portal', label: 'Portal do Cliente', group: 'Administração', icon: ExternalLink },
  { id: 'relatorios', label: 'Relatórios', group: 'Administração', icon: BarChart3 },
  { id: 'usuarios', label: 'Usuários', group: 'Administração', icon: UsersRound },
];

const GROUPS = ['Visão Geral', 'Gestão', 'IA Jurídica', 'Ferramentas', 'Administração'];

function getNotificacoes() {
  const notifs: any[] = [];
  db.eventos.forEach((e) => {
    const d = diasRestantes(e.data);
    if (d >= 0 && d <= 2) notifs.push({ tipo: 'prazo', texto: `${e.tipo} em ${d === 0 ? 'hoje' : d + ' dia(s)'} — ${processoLabel(e.processoId)}`, canal: d <= 1 ? 'WhatsApp + e-mail' : 'e-mail' });
  });
  db.honorarios.filter((h) => h.status === 'atrasado').forEach((h) => {
    notifs.push({ tipo: 'financeiro', texto: `Honorário atrasado — ${clienteNome(h.clienteId)} (${fmtMoney(h.valor)})`, canal: 'e-mail' });
  });
  db.tarefas.filter((t) => t.status !== 'concluida' && diasRestantes(t.prazo) < 0).forEach((t) => {
    notifs.push({ tipo: 'tarefa', texto: `Tarefa atrasada: ${t.titulo}`, canal: 'e-mail' });
  });
  return notifs;
}

export default function App() {
  const [usuarioAtual, setUsuarioAtual] = useState<any>(null);
  const [page, setPage] = useState('dashboard');
  const [modal, setModal] = useState<string | null>(null);
  const [viewingProcesso, setViewingProcesso] = useState<number | null>(null);
  const [, forceRender] = useState({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const confirmAction = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(null);
      }
    });
  };

  const update = () => forceRender({});

  useEffect(() => {
    loadAllDataFromBackend().then(() => {
      setIsLoadingData(false);
    });
  }, []);

  if (isLoadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-white text-sm font-medium">Carregando banco de dados...</p>
        </div>
      </div>
    );
  }

  if (!usuarioAtual) {
    return <LoginScreen onLogin={setUsuarioAtual} />;
  }

  const perm = PERMISSOES[usuarioAtual.perfil] || [];
  const notifs = getNotificacoes();

  const handleNav = (id: string) => {
    setPage(id);
    setViewingProcesso(null);
    setIsSidebarOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-gray-50 text-sm text-slate-800">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 bg-slate-900 text-white h-14 flex items-center justify-between px-4 z-30">
        <div className="flex items-center gap-2">
          <button onClick={() => setIsSidebarOpen(true)} className="p-1"><Menu size={20} /></button>
          <span className="font-semibold">Jurídico<span className="text-amber-400">Manager</span></span>
        </div>
        {notifs.length > 0 && (
          <button onClick={() => handleNav('dashboard')} className="relative p-1">
            <Bell size={18} />
            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">{notifs.length}</span>
          </button>
        )}
      </header>

      {/* Mobile Sidebar */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setIsSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-slate-900 text-slate-200 flex flex-col">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <span className="font-semibold text-white">Jurídico<span className="text-amber-400">Manager</span></span>
              <button onClick={() => setIsSidebarOpen(false)} className="p-1"><X size={20} /></button>
            </div>
            <SidebarContent perm={perm} page={page} handleNav={handleNav} notifs={notifs} />
            <UserFooter usuarioAtual={usuarioAtual} setUsuarioAtual={setUsuarioAtual} setPage={setPage} />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex w-64 bg-slate-900 text-slate-200 flex-col shrink-0">
        <div className="px-5 py-5 border-b border-white/10 flex items-center gap-2">
          <Scale className="w-6 h-6 text-amber-400" />
          <span className="font-semibold text-white text-base">Jurídico<span className="text-amber-400">Manager</span></span>
        </div>
        <button onClick={() => handleNav('dashboard')} className="px-5 py-3 text-sm text-slate-300 hover:bg-white/5 flex items-center gap-2 border-b border-white/10">
          <Bell size={16} />
          <span>Notificações</span>
          {notifs.length > 0 && <span className="ml-auto bg-red-600 text-white text-[10px] rounded-full px-2 py-0.5 font-bold">{notifs.length}</span>}
        </button>
        <SidebarContent perm={perm} page={page} handleNav={handleNav} notifs={[]} />
        <UserFooter usuarioAtual={usuarioAtual} setUsuarioAtual={setUsuarioAtual} setPage={setPage} />
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden mt-14 lg:mt-0">
        {!perm.includes(page) ? (
          <div className="bg-white border rounded-xl p-8 max-w-lg mx-auto mt-12 text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-slate-800 mb-2">Acesso Restrito</h2>
            <p className="text-sm text-slate-500 mb-6">Seu perfil não tem permissão para acessar esta tela.</p>
            <button onClick={() => setPage('dashboard')} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm">Voltar ao Dashboard</button>
          </div>
        ) : (
          <>
            {page === 'dashboard' && <Dashboard />}
            {page === 'clientes' && <Clientes setModal={setModal} update={update} confirmAction={confirmAction} />}
            {page === 'processos' && (viewingProcesso ? <ProcessoDetalhe id={viewingProcesso} setViewingProcesso={setViewingProcesso} update={update} /> : <Processos setViewingProcesso={setViewingProcesso} setModal={setModal} update={update} confirmAction={confirmAction} />)}
            {page === 'agenda' && <Agenda setModal={setModal} update={update} confirmAction={confirmAction} />}
            {page === 'tarefas' && <Tarefas setModal={setModal} update={update} confirmAction={confirmAction} />}
            {page === 'financeiro' && <Financeiro setModal={setModal} update={update} confirmAction={confirmAction} />}
            {page === 'documentos' && <Documentos setModal={setModal} update={update} confirmAction={confirmAction} />}
            {page === 'inteligencia' && <InteligenciaJuridica />}
            {page === 'ia' && <IA />}
            {page === 'pesquisa' && <PesquisaJuridica />}
            {page === 'estrategia' && <EstrategiaProcessual />}
            {page === 'pecas' && <ElaboracaoPecas />}
            {page === 'contratos' && <AnaliseContratos />}
            {page === 'parecer' && <ParecerJuridico />}
            {page === 'calculos' && <CalculosJuridicos />}
            {page === 'integracoes' && <Integracoes update={update} />}
            {page === 'portal' && <PortalCliente />}
            {page === 'relatorios' && <Relatorios />}
            {page === 'usuarios' && <Usuarios confirmAction={confirmAction} />}
          </>
        )}
      </main>

      {/* Modais */}
      {modal === 'novo-cliente' && (
        <ClienteFormModal
          onClose={() => setModal(null)}
          onSuccess={(c) => { db.clientes.push(c); setModal(null); update(); }}
        />
      )}
      {modal === 'novo-processo' && (
        <ProcessoFormModal
          clientes={db.clientes}
          advogados={db.usuarios}
          onClose={() => setModal(null)}
          onSuccess={(p) => { db.processos.push(p); setModal(null); update(); }}
        />
      )}
      {modal === 'novo-evento' && (
        <EventoFormModal
          processos={db.processos}
          onClose={() => setModal(null)}
          onSuccess={(e) => { db.eventos.push(e); setModal(null); update(); }}
        />
      )}
      {modal === 'novo-documento' && (
        <DocumentoFormModal
          clientes={db.clientes}
          processos={db.processos}
          onClose={() => setModal(null)}
          onSuccess={(d) => { db.documentos.push(d); setModal(null); update(); }}
        />
      )}
      {modal === 'nova-tarefa' && (
        <TarefaFormModal
          advogados={db.usuarios}
          processos={db.processos}
          onClose={() => setModal(null)}
          onSuccess={(t) => { db.tarefas.push(t); setModal(null); update(); }}
        />
      )}
      {modal === 'novo-honorario' && (
        <HonorarioFormModal
          clientes={db.clientes}
          processos={db.processos}
          onClose={() => setModal(null)}
          onSuccess={(h) => { db.honorarios.push(h); setModal(null); update(); }}
        />
      )}
      {modal === 'nova-despesa' && (
        <DespesaFormModal
          onClose={() => setModal(null)}
          onSuccess={(d) => { db.despesas.push(d); setModal(null); update(); }}
        />
      )}

      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm border border-slate-100 transform scale-100 transition duration-200">
            <div className="flex items-center gap-3 mb-4 text-red-600">
              <div className="bg-red-50 p-2 rounded-full">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">{confirmModal.title}</h3>
            </div>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              {confirmModal.message}
            </p>
            <div className="flex justify-end gap-3 font-medium">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm shadow-sm transition cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ LOGIN SCREEN ============
function LoginScreen({ onLogin }: { onLogin: (u: any) => void }) {
  const [emailDigitado, setEmailDigitado] = useState('');
  const [senhaDigitada, setSenhaDigitada] = useState('');
  const [showRecuperar, setShowRecuperar] = useState(false);
  const [emailRecuperar, setEmailRecuperar] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [usuariosLocais, setUsuariosLocais] = useState<any[]>(db.usuarios);

  // Recarregar os usuários do backend para sincronizar as senhas do Firestore
  useEffect(() => {
    const carregar = async () => {
      try {
        const res = await fetch('/api/usuarios');
        const data = await res.json();
        if (data.success) {
          setUsuariosLocais(data.data);
          db.usuarios = data.data;
        }
      } catch (err) {
        console.error('Erro ao sincronizar lista de usuários:', err);
      }
    };
    carregar();
  }, [showRecuperar]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!emailDigitado) {
      setLoginError('Digite seu e-mail.');
      return;
    }
    if (!senhaDigitada) {
      setLoginError('Digite sua senha de acesso.');
      return;
    }

    try {
      setLoading(true);
      const userCredential = await signInWithEmailAndPassword(auth, emailDigitado, senhaDigitada);
      
      // Criar um objeto de usuário compatível com o resto da aplicação
      let usuarioCompativel = usuariosLocais.find((u) => u.email === emailDigitado);
      if (!usuarioCompativel) {
        usuarioCompativel = {
          id: userCredential.user.uid,
          nome: userCredential.user.displayName || emailDigitado.split('@')[0],
          email: emailDigitado,
          perfil: (emailDigitado === 'vidal2311usa@gmail.com' || emailDigitado === 'bandavai62@gmail.com') ? 'Administrador' : 'Advogado'
        };
      } else if (emailDigitado === 'vidal2311usa@gmail.com' || emailDigitado === 'bandavai62@gmail.com') {
        usuarioCompativel.perfil = 'Administrador';
      }
      
      onLogin(usuarioCompativel);
    } catch (err: any) {
      console.error('Erro de login:', err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setLoginError('E-mail ou senha incorretos.');
      } else {
        setLoginError('Erro ao fazer login: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRecuperarFirebase = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    if (!emailRecuperar.trim()) {
      setStatusMsg({ type: 'error', text: 'Por favor, insira o e-mail de cadastro.' });
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, emailRecuperar.trim());
      setStatusMsg({ type: 'success', text: 'Se o e-mail estiver cadastrado no Firebase Auth, um link de redefinição de senha foi enviado para sua caixa de entrada.' });
      setEmailRecuperar('');
    } catch (err: any) {
      console.error('Erro Firebase Auth:', err);
      if (err.code === 'auth/operation-not-allowed') {
        setStatusMsg({ type: 'error', text: 'O método de login por E-mail/Senha está desativado no Firebase Console. Ative-o na aba Authentication > Sign-in method.' });
      } else if (err.code === 'auth/user-not-found') {
        setStatusMsg({ type: 'error', text: 'E-mail não encontrado no Firebase Authentication. Crie o usuário primeiro.' });
      } else {
        setStatusMsg({ type: 'error', text: 'Erro ao solicitar recuperação. Verifique o e-mail digitado ou se sua conta já foi criada no Firebase Auth.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="bg-slate-800/60 backdrop-blur border border-white/10 rounded-xl w-[380px] max-w-[90vw] shadow-2xl overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400" />
        <div className="px-7 py-9">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center mb-4">
              <Scale className="w-8 h-8 text-amber-400" />
            </div>
            <h1 className="text-white text-xl font-bold">Sistema Jurídico</h1>
            <p className="text-amber-400 text-sm font-medium">Inteligente IA</p>
            <p className="text-slate-400 text-xs mt-2">Copiloto para Advogados</p>
          </div>

          {!showRecuperar ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-3">
                <label htmlFor="email-login" className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> E-mail de Acesso
                </label>
                <input
                  id="email-login"
                  type="email"
                  placeholder="Digite seu e-mail"
                  className="w-full px-3 py-2.5 rounded-md text-sm bg-slate-900 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
                  value={emailDigitado}
                  onChange={(e) => {
                    setEmailDigitado(e.target.value);
                    setLoginError(null);
                  }}
                />
              </div>

              <div className="space-y-1.5 animate-fade-in">
                <label htmlFor="senha-login" className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" /> Senha de Acesso
                </label>
                <input
                  id="senha-login"
                  type="password"
                  placeholder="Digite sua senha cadastrada"
                  className="w-full px-3 py-2.5 rounded-md text-sm bg-slate-900 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
                  value={senhaDigitada}
                  onChange={(e) => {
                    setSenhaDigitada(e.target.value);
                    setLoginError(null);
                  }}
                />
              </div>

              {loginError && (
                <div className="p-3 rounded text-xs bg-red-500/10 border border-red-500/20 text-red-400">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-amber-500 text-slate-900 py-2.5 rounded-md text-sm font-semibold hover:bg-amber-400 flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <LogIn className="w-4 h-4" /> Entrar
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowRecuperar(true);
                    setStatusMsg(null);
                    setEmailRecuperar('');
                    setNovaSenha('');
                    setConfirmarSenha('');
                  }}
                  className="text-xs text-amber-400 hover:text-amber-300 transition-colors cursor-pointer font-medium"
                >
                  Esqueceu a senha? Redefinir senha do perfil
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRecuperarFirebase} className="space-y-4">
              <h2 className="text-sm font-semibold text-white text-center mb-1">Recuperação de Senha via Firebase</h2>
              <p className="text-xs text-slate-400 text-center leading-relaxed mb-3">
                Identifique seu e-mail corporativo cadastrado. Um link de redefinição será enviado pelo Firebase para sua caixa de entrada.
              </p>

              {statusMsg && (
                <div
                  className={`p-3 rounded text-xs leading-relaxed ${
                    statusMsg.type === 'success'
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/10 border border-red-500/20 text-red-400'
                  }`}
                >
                  {statusMsg.text}
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="email-recuperar" className="text-xs text-slate-300 font-medium">E-mail corporativo cadastrado</label>
                <input
                  id="email-recuperar"
                  type="email"
                  placeholder="exemplo@escritorio.com.br"
                  className="w-full px-3 py-2 rounded-md text-sm bg-slate-900 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
                  value={emailRecuperar}
                  onChange={(e) => setEmailRecuperar(e.target.value)}
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-slate-900 py-2.5 rounded-md text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                {loading ? 'Enviando...' : 'Enviar Link de Recuperação'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowRecuperar(false);
                  setStatusMsg(null);
                }}
                className="w-full border border-white/10 text-slate-300 hover:bg-white/5 py-2.5 rounded-md text-sm font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                Voltar para o login
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ SIDEBAR ============
function SidebarContent({ perm, page, handleNav, notifs }: any) {
  return (
    <nav className="flex-1 overflow-y-auto py-3 custom-scroll">
      {GROUPS.map((group) => {
        const items = NAV.filter((n) => n.group === group && perm.includes(n.id));
        if (items.length === 0) return null;
        return (
          <div key={group} className="mb-4">
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-5 mb-2">{group}</h2>
            {items.map((n) => {
              const Icon = n.icon;
              const isActive = page === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => handleNav(n.id)}
                  className={`w-full flex items-center gap-3 px-5 py-2 text-sm transition-colors border-l-[3px] ${
                    isActive
                      ? 'bg-white/10 text-white border-amber-400'
                      : 'text-slate-300 border-transparent hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon size={16} className={isActive ? 'text-amber-400' : ''} />
                  <span>{n.label}</span>
                </button>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

function UserFooter({ usuarioAtual, setUsuarioAtual, setPage }: any) {
  return (
    <div className="p-4 border-t border-white/10 text-xs text-slate-400">
      <p className="text-white font-medium truncate">{usuarioAtual.nome}</p>
      <p className="truncate">{usuarioAtual.perfil}</p>
      <button
        onClick={() => {
          auth.signOut();
          setUsuarioAtual(null);
          setPage('dashboard');
        }}
        className="w-full mt-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded px-2 py-1.5 text-xs font-medium hover:bg-red-500/20 flex items-center justify-center gap-1 transition-colors"
      >
        <LogOut className="w-3.5 h-3.5" /> Sair
      </button>
    </div>
  );
}

// ============ DASHBOARD ============
function Dashboard() {
  const ativos = db.processos.filter((p) => p.status === 'ativo').length;
  const hoje = new Date().toISOString().slice(0, 10);
  const compromissosHoje = db.eventos.filter((e) => e.data === hoje).length;
  const prazos7 = db.eventos.filter((e) => { const d = diasRestantes(e.data); return d >= 0 && d <= 7; }).length;
  const tarefasPendentes = db.tarefas.filter((t) => t.status !== 'concluida').length;
  const aReceber = db.honorarios.filter((h) => h.status !== 'pago').reduce((s, h) => s + h.valor, 0);
  const proxEventos = [...db.eventos].sort((a, b) => a.data.localeCompare(b.data)).slice(0, 4);
  const notifs = getNotificacoes();

  const stats = [
    { label: 'Processos Ativos', value: ativos, icon: FolderKanban, color: 'text-blue-600' },
    { label: 'Compromissos Hoje', value: compromissosHoje, icon: Calendar, color: 'text-emerald-600' },
    { label: 'Prazos Próximos (7d)', value: prazos7, icon: Clock, color: 'text-orange-600' },
    { label: 'Tarefas Pendentes', value: tarefasPendentes, icon: CheckSquare, color: 'text-purple-600' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500">Panorama do escritório hoje.</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white border rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">{s.label}</p>
                <p className="text-2xl font-bold mt-1">{s.value}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-slate-50 flex items-center justify-center">
                <Icon className={`w-6 h-6 ${s.color}`} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border rounded-xl p-5">
          <div className="flex justify-between items-center mb-4 pb-2 border-b">
            <span className="text-xs font-semibold text-slate-500 uppercase">Próximos Compromissos</span>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Previsão a receber</div>
              <div className="text-base font-bold text-emerald-600">{fmtMoney(aReceber)}</div>
            </div>
          </div>
          <table className="w-full text-xs">
            <tbody>
              {proxEventos.map((e, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2 font-medium">
                    <span className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] uppercase mr-2">{e.tipo}</span>
                    {e.processoId ? `${processoLabel(e.processoId).slice(0, 20)}...` : e.local}
                  </td>
                  <td className="py-2 text-right font-semibold">{fmtDate(e.data)}</td>
                </tr>
              ))}
              {proxEventos.length === 0 && <tr><td colSpan={2} className="text-center text-slate-400 py-4">Sem eventos</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="bg-white border rounded-xl p-5">
          <div className="mb-4 pb-2 border-b">
            <span className="text-xs font-semibold text-slate-500 uppercase">Central de Notificações</span>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto custom-scroll">
            {notifs.map((n, i) => (
              <div key={i} className="flex justify-between items-center py-2 text-xs">
                <span className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${n.tipo === 'prazo' ? 'bg-red-500' : n.tipo === 'financeiro' ? 'bg-amber-500' : 'bg-slate-500'}`} />
                  {n.texto}
                </span>
                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase">{n.canal}</span>
              </div>
            ))}
            {notifs.length === 0 && <p className="text-center text-slate-400 py-4">Nenhuma notificação pendente</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ CLIENTES ============
function Clientes({ setModal, update, confirmAction }: any) {
  const [search, setSearch] = useState('');
  const filtered = db.clientes.filter((c) =>
    c.nome.toLowerCase().includes(search.toLowerCase()) || c.doc.includes(search) || c.contato.includes(search)
  );

  const deleteCliente = async (id: number) => {
    confirmAction(
      'Excluir Cliente',
      'Deseja realmente excluir este cliente? Todos os dados associados serão mantidos, mas o cadastro do cliente será removido.',
      async () => {
        try {
          const res = await fetch(`/api/clientes/${id}`, { method: 'DELETE' });
          if (res.ok) {
            db.clientes = db.clientes.filter((c) => c.id !== id);
            update();
          }
        } catch (err) {
          console.error('Erro ao excluir cliente:', err);
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Clientes</h1>
          <p className="text-sm text-slate-500">Pessoa física e jurídica.</p>
        </div>
        <button onClick={() => setModal('novo-cliente')} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
          <Plus className="w-4 h-4" /> Novo cliente
        </button>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm"
          placeholder="Buscar por nome, CPF, CNPJ ou contato..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="bg-white border rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-xs min-w-[700px]">
          <thead>
            <tr className="bg-slate-50 border-b">
              <th className="px-4 py-3 text-left text-slate-600 uppercase">Nome</th>
              <th className="px-4 py-3 text-left text-slate-600 uppercase">Tipo</th>
              <th className="px-4 py-3 text-left text-slate-600 uppercase">Documento</th>
              <th className="px-4 py-3 text-left text-slate-600 uppercase">Contato</th>
              <th className="px-4 py-3 text-right text-slate-600 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3 font-bold">{c.nome}</td>
                <td className="px-4 py-3"><span className="bg-slate-100 px-2 py-1 rounded text-[10px] font-bold uppercase">{c.tipo}</span></td>
                <td className="px-4 py-3 font-mono">{c.doc}</td>
                <td className="px-4 py-3">{c.contato}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => deleteCliente(c.id)}
                    className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition inline-flex items-center justify-center"
                    title="Excluir"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="text-center text-slate-400 py-8">Nenhum cliente</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ PROCESSOS ============
function Processos({ setViewingProcesso, setModal, update, confirmAction }: any) {
  const [search, setSearch] = useState('');
  const [datajudOpen, setDatajudOpen] = useState(false);
  const [datajud, setDatajud] = useState({ numero: '', loading: false, result: '', error: '' });

  const filtered = db.processos.filter((p) =>
    p.numero.toLowerCase().includes(search.toLowerCase()) ||
    p.classe.toLowerCase().includes(search.toLowerCase()) ||
    clienteNome(p.clienteId).toLowerCase().includes(search.toLowerCase())
  );

  const consultarDatajud = async () => {
    if (!datajud.numero) { setDatajud({ ...datajud, error: 'Digite o número' }); return; }
    setDatajud({ ...datajud, loading: true, error: '', result: '' });
    try {
      const res = await fetch('/api/datajud/' + encodeURIComponent(datajud.numero.replace(/\D/g, '')));
      const data = await res.json();
      if (data.success) {
        setDatajud({ ...datajud, loading: false, result: `✓ ${data.data.numeroProcesso}\nClasse: ${data.data.classe?.nome || '—'}\nTribunal: ${data.data.tribunal || '—'}` });
      } else {
        setDatajud({ ...datajud, loading: false, error: data.message });
      }
    } catch {
      setDatajud({ ...datajud, loading: false, error: 'Erro de conexão' });
    }
  };

  const deleteProcesso = async (id: number) => {
    confirmAction(
      'Excluir Processo',
      'Deseja realmente excluir este processo? Todos os andamentos e informações deste processo serão permanentemente removidos.',
      async () => {
        try {
          const res = await fetch(`/api/processos/${id}`, { method: 'DELETE' });
          if (res.ok) {
            db.processos = db.processos.filter((p) => p.id !== id);
            update();
          }
        } catch (err) {
          console.error('Erro ao excluir processo:', err);
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Processos</h1>
          <p className="text-sm text-slate-500">Acompanhamento de processos.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setDatajudOpen(true)} className="bg-white border px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5">
            <Scale className="w-4 h-4" /> Consultar Datajud
          </button>
          <button onClick={() => setModal('novo-processo')} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Novo processo
          </button>
        </div>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="bg-white border rounded-xl overflow-x-auto">
        <table className="w-full text-xs min-w-[800px]">
          <thead>
            <tr className="bg-slate-50 border-b">
              <th className="px-4 py-3 text-left text-slate-600 uppercase">Número</th>
              <th className="px-4 py-3 text-left text-slate-600 uppercase">Cliente</th>
              <th className="px-4 py-3 text-left text-slate-600 uppercase">Classe</th>
              <th className="px-4 py-3 text-left text-slate-600 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-slate-600 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3 font-mono font-bold">{p.numero}</td>
                <td className="px-4 py-3 font-semibold">{clienteNome(p.clienteId)}</td>
                <td className="px-4 py-3">{p.classe}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${p.status === 'ativo' ? 'bg-emerald-50 text-emerald-700' : p.status === 'suspenso' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{p.status}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setViewingProcesso(p.id)} className="text-slate-800 font-semibold hover:underline mr-3">Ver detalhes</button>
                  <button
                    onClick={() => deleteProcesso(p.id)}
                    className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition inline-flex items-center justify-center align-middle"
                    title="Excluir"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="text-center text-slate-400 py-8">Nenhum processo</td></tr>}
          </tbody>
        </table>
      </div>

      {datajudOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Consultar Datajud (CNJ)</h2>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-lg text-sm font-mono mb-2"
              placeholder="0000000-00.0000.0.00.0000"
              value={datajud.numero}
              onChange={(e) => setDatajud({ ...datajud, numero: maskProcesso(e.target.value), error: '' })}
            />
            {datajud.error && <p className="text-red-600 text-xs mb-2">{datajud.error}</p>}
            {datajud.loading && <p className="text-slate-600 text-xs mb-2">Consultando...</p>}
            {datajud.result && <pre className="bg-slate-50 p-3 rounded text-xs whitespace-pre-wrap mb-2">{datajud.result}</pre>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setDatajudOpen(false)} className="px-4 py-2 border rounded-lg text-sm">Fechar</button>
              <button onClick={consultarDatajud} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm">Consultar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProcessoDetalhe({ id, setViewingProcesso, update }: any) {
  const [novoAndamento, setNovoAndamento] = useState('');
  const p = db.processos.find((p) => p.id === id);
  if (!p) return null;

  const addAndamento = async () => {
    if (novoAndamento.trim()) {
      try {
        const res = await fetch(`/api/processos/${p.id}/andamentos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ desc: novoAndamento.trim() }),
        });
        if (res.ok) {
          const json = await res.json();
          p.andamentos = json.data.andamentos;
          setNovoAndamento('');
          update();
        }
      } catch (err) {
        console.error('Erro ao adicionar andamento:', err);
      }
    }
  };

  return (
    <div>
      <button onClick={() => setViewingProcesso(null)} className="text-slate-800 hover:underline mb-2">← Voltar</button>
      <h1 className="text-xl font-bold text-slate-800 mb-1">{p.numero}</h1>
      <p className="text-sm text-slate-500 mb-6">{p.tribunal} · {p.vara} · Cliente: {clienteNome(p.clienteId)}</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <div className="bg-white border rounded-xl p-4"><p className="text-xs text-slate-500 uppercase">Classe</p><p className="font-semibold mt-1">{p.classe}</p></div>
        <div className="bg-white border rounded-xl p-4"><p className="text-xs text-slate-500 uppercase">Advogado</p><p className="font-semibold mt-1">{usuarioNome(p.advogadoId)}</p></div>
        <div className="bg-white border rounded-xl p-4"><p className="text-xs text-slate-500 uppercase">Valor</p><p className="font-semibold mt-1">{fmtMoney(p.valorCausa)}</p></div>
        <div className="bg-white border rounded-xl p-4"><p className="text-xs text-slate-500 uppercase">Status</p><p className="font-semibold mt-1">{p.status}</p></div>
      </div>
      <div className="bg-white border rounded-xl p-5">
        <h3 className="font-semibold mb-4">Andamentos</h3>
        <div className="border-l-2 border-slate-200 pl-4 space-y-3">
          {p.andamentos.map((a, i) => (
            <div key={i} className="relative">
              <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-amber-500" />
              <div className="text-xs text-slate-500">{fmtDate(a.data)}</div>
              <div className="text-sm">{a.desc}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <input type="text" className="flex-1 px-3 py-2 border rounded text-sm" placeholder="Novo andamento..." value={novoAndamento} onChange={(e) => setNovoAndamento(e.target.value)} />
          <button onClick={addAndamento} className="bg-slate-800 text-white px-4 py-2 rounded text-sm">Adicionar</button>
        </div>
      </div>
    </div>
  );
}

// ============ AGENDA ============
function Agenda({ setModal, update, confirmAction }: any) {
  const eventos = [...db.eventos].sort((a, b) => a.data.localeCompare(b.data));

  const deleteEvento = async (id: number) => {
    confirmAction(
      'Excluir Compromisso',
      'Deseja realmente excluir este compromisso da agenda?',
      async () => {
        db.eventos = db.eventos.filter((e) => e.id !== id);
        update();
        try {
          await fetch(`/api/eventos/${id}`, { method: 'DELETE' });
        } catch (err) {
          console.error('Erro ao excluir evento:', err);
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Agenda Jurídica</h1>
          <p className="text-sm text-slate-500">Audiências, prazos e reuniões.</p>
        </div>
        <button onClick={() => setModal('novo-evento')} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
          <Plus className="w-4 h-4" /> Novo evento
        </button>
      </div>
      <div className="bg-white border rounded-xl overflow-x-auto shadow-xs">
        <table className="w-full text-xs min-w-[700px]">
          <thead>
            <tr className="bg-slate-50 border-b">
              <th className="px-4 py-3 text-left text-slate-600 uppercase font-semibold">Data/Hora</th>
              <th className="px-4 py-3 text-left text-slate-600 uppercase font-semibold">Tipo</th>
              <th className="px-4 py-3 text-left text-slate-600 uppercase font-semibold">Processo</th>
              <th className="px-4 py-3 text-left text-slate-600 uppercase font-semibold">Local</th>
              <th className="px-4 py-3 text-left text-slate-600 uppercase font-semibold">Situação</th>
              <th className="px-4 py-3 text-center text-slate-600 uppercase font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {eventos.map((e) => {
              const d = diasRestantes(e.data);
              return (
                <tr key={e.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-800">{fmtDate(e.data)} {e.hora}</td>
                  <td className="px-4 py-3"><span className="bg-slate-100 px-2 py-1 rounded text-[10px] font-bold uppercase text-slate-600">{e.tipo}</span></td>
                  <td className="px-4 py-3 font-mono text-slate-800">{processoLabel(e.processoId)}</td>
                  <td className="px-4 py-3 text-slate-700">{e.local}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${d < 0 ? 'bg-red-50 text-red-700' : d <= 1 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {d < 0 ? 'Vencido' : d === 0 ? 'Hoje' : `${d}d`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => deleteEvento(e.id)}
                      className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {eventos.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-8">Nenhum evento</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ TAREFAS (KANBAN) ============
function Tarefas({ setModal, update, confirmAction }: any) {
  const cols = [
    { key: 'pendente', label: 'Pendente', bg: 'bg-slate-50' },
    { key: 'andamento', label: 'Em Andamento', bg: 'bg-blue-50' },
    { key: 'concluida', label: 'Concluída', bg: 'bg-emerald-50' },
  ];
  const [draggedId, setDraggedId] = useState<number | null>(null);

  const moveTarefa = async (id: number, newStatus: string) => {
    const t = db.tarefas.find((t) => t.id === id);
    if (t) {
      t.status = newStatus as any;
      update();
      try {
        await fetch(`/api/tarefas/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        });
      } catch (err) {
        console.error('Erro ao atualizar status da tarefa:', err);
      }
    }
  };

  const deleteTarefa = async (id: number) => {
    confirmAction(
      'Excluir Tarefa',
      'Deseja realmente excluir esta tarefa do quadro?',
      async () => {
        db.tarefas = db.tarefas.filter((t) => t.id !== id);
        update();
        try {
          await fetch(`/api/tarefas/${id}`, { method: 'DELETE' });
        } catch (err) {
          console.error('Erro ao excluir tarefa:', err);
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tarefas</h1>
          <p className="text-sm text-slate-500">Quadro Kanban — arraste entre colunas.</p>
        </div>
        <button
          onClick={() => setModal('nova-tarefa')}
          className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 self-start sm:self-auto transition"
        >
          <Plus className="w-4 h-4" /> Nova Tarefa
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {cols.map((c) => {
          const list = db.tarefas.filter((t) => t.status === c.key);
          return (
            <div
              key={c.key}
              className={`rounded-lg border p-4 min-h-[400px] ${c.bg}`}
              onDrop={(e) => { e.preventDefault(); if (draggedId) { moveTarefa(draggedId, c.key); setDraggedId(null); } }}
              onDragOver={(e) => e.preventDefault()}
            >
              <div className="flex justify-between mb-3">
                <span className="text-xs font-bold uppercase text-slate-600">{c.label}</span>
                <span className="text-xs font-bold bg-slate-200 px-2 py-0.5 rounded text-slate-700">{list.length}</span>
              </div>
              <div className="space-y-2">
                {list.map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={() => setDraggedId(t.id)}
                    className="bg-white border rounded-lg p-3 cursor-grab hover:shadow-sm transition relative group"
                  >
                    <div className="flex justify-between mb-1">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${t.prioridade === 'alta' ? 'bg-red-50 text-red-700' : t.prioridade === 'media' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{t.prioridade}</span>
                      <span className="text-[11px] text-slate-500 mr-6">{fmtDate(t.prazo)}</span>
                    </div>
                    <p className="font-semibold text-sm text-slate-800 pr-4">{t.titulo}</p>
                    <p className="text-xs text-slate-500 mt-1">{usuarioNome(t.responsavelId)}</p>
                    {t.processoId && (
                      <p className="text-[10px] text-slate-400 font-mono mt-1">Proc: {processoLabel(t.processoId)}</p>
                    )}
                    <button
                      onClick={() => deleteTarefa(t.id)}
                      className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition duration-150 cursor-pointer"
                      title="Excluir tarefa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {list.length === 0 && <p className="text-center text-xs text-slate-400 py-6">Arraste tarefas aqui</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ FINANCEIRO ============
function Financeiro({ setModal, update, confirmAction }: any) {
  const receber = db.honorarios.filter((h) => h.status !== 'pago').reduce((s, h) => s + h.valor, 0);
  const recebido = db.honorarios.filter((h) => h.status === 'pago').reduce((s, h) => s + h.valor, 0);
  const atrasado = db.honorarios.filter((h) => h.status === 'atrasado').reduce((s, h) => s + h.valor, 0);
  const totalDespesas = db.despesas.reduce((s, d) => s + d.valor, 0);

  const cards = [
    { label: 'Recebido', value: fmtMoney(recebido), color: 'text-emerald-600' },
    { label: 'A receber', value: fmtMoney(receber), color: 'text-amber-600' },
    { label: 'Inadimplência', value: fmtMoney(atrasado), color: 'text-red-600' },
    { label: 'Despesas Totais', value: fmtMoney(totalDespesas), color: 'text-rose-600' },
  ];

  const pagarHonorario = async (id: number) => {
    try {
      const res = await fetch(`/api/honorarios/${id}/pago`, { method: 'PUT' });
      if (res.ok) {
        const hon = db.honorarios.find((h) => h.id === id);
        if (hon) hon.status = 'pago';
        update();
      }
    } catch (err) {
      console.error('Erro ao pagar honorário:', err);
    }
  };

  const deleteHonorario = async (id: number) => {
    confirmAction(
      'Excluir Honorário',
      'Deseja realmente excluir este lançamento de honorário?',
      async () => {
        try {
          const res = await fetch(`/api/honorarios/${id}`, { method: 'DELETE' });
          if (res.ok) {
            db.honorarios = db.honorarios.filter((h) => h.id !== id);
            update();
          }
        } catch (err) {
          console.error('Erro ao excluir honorário:', err);
        }
      }
    );
  };

  const pagarDespesa = async (id: number) => {
    try {
      const res = await fetch(`/api/despesas/${id}/pago`, { method: 'PUT' });
      if (res.ok) {
        const des = db.despesas.find((d) => d.id === id);
        if (des) des.status = 'pago';
        update();
      }
    } catch (err) {
      console.error('Erro ao pagar despesa:', err);
    }
  };

  const deleteDespesa = async (id: number) => {
    confirmAction(
      'Excluir Despesa',
      'Deseja realmente excluir este lançamento de despesa?',
      async () => {
        try {
          const res = await fetch(`/api/despesas/${id}`, { method: 'DELETE' });
          if (res.ok) {
            db.despesas = db.despesas.filter((d) => d.id !== id);
            update();
          }
        } catch (err) {
          console.error('Erro ao excluir despesa:', err);
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Financeiro</h1>
          <p className="text-sm text-slate-500">Gestão de honorários e despesas.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setModal('novo-honorario')}
            className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5" /> Lançar Honorário
          </button>
          <button
            onClick={() => setModal('nova-despesa')}
            className="bg-rose-800 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5" /> Lançar Despesa
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white border rounded-xl p-4 shadow-xs">
            <p className="text-xs text-slate-500 uppercase font-medium">{c.label}</p>
            <p className={`text-xl font-bold mt-1 ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Tabela de Honorários */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-slate-800">Honorários e Contratos</h2>
        <div className="bg-white border rounded-xl overflow-x-auto shadow-xs">
          <table className="w-full text-xs min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="px-4 py-3 text-left text-slate-600 uppercase font-semibold">Cliente</th>
                <th className="px-4 py-3 text-left text-slate-600 uppercase font-semibold">Valor</th>
                <th className="px-4 py-3 text-left text-slate-600 uppercase font-semibold">Tipo</th>
                <th className="px-4 py-3 text-left text-slate-600 uppercase font-semibold">Status</th>
                <th className="px-4 py-3 text-left text-slate-600 uppercase font-semibold">Vencimento</th>
                <th className="px-4 py-3 text-center text-slate-600 uppercase font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {db.honorarios.map((h) => (
                <tr key={h.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{clienteNome(h.clienteId)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{fmtMoney(h.valor)}</td>
                  <td className="px-4 py-3"><span className="bg-slate-100 px-2 py-1 rounded text-[10px] font-bold uppercase text-slate-600">{h.tipo}</span></td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${h.status === 'pago' ? 'bg-emerald-50 text-emerald-700' : h.status === 'atrasado' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{h.status}</span></td>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(h.vencimento)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center items-center gap-1.5">
                      {h.status !== 'pago' && (
                        <button
                          onClick={() => pagarHonorario(h.id)}
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[10px] font-semibold transition"
                        >
                          Marcar Pago
                        </button>
                      )}
                      <button
                        onClick={() => deleteHonorario(h.id)}
                        className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {db.honorarios.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-slate-400 py-8">Nenhum honorário cadastrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabela de Despesas */}
      <div className="space-y-3 pt-4">
        <h2 className="text-lg font-bold text-slate-800">Despesas / Custas Judiciais</h2>
        <div className="bg-white border rounded-xl overflow-x-auto shadow-xs">
          <table className="w-full text-xs min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="px-4 py-3 text-left text-slate-600 uppercase font-semibold">Descrição</th>
                <th className="px-4 py-3 text-left text-slate-600 uppercase font-semibold">Valor</th>
                <th className="px-4 py-3 text-left text-slate-600 uppercase font-semibold">Status</th>
                <th className="px-4 py-3 text-left text-slate-600 uppercase font-semibold">Vencimento</th>
                <th className="px-4 py-3 text-center text-slate-600 uppercase font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {db.despesas.map((d) => (
                <tr key={d.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{d.descricao}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{fmtMoney(d.valor)}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${d.status === 'pago' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{d.status}</span></td>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(d.vencimento)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center items-center gap-1.5">
                      {d.status !== 'pago' && (
                        <button
                          onClick={() => pagarDespesa(d.id)}
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[10px] font-semibold transition"
                        >
                          Marcar Pago
                        </button>
                      )}
                      <button
                        onClick={() => deleteDespesa(d.id)}
                        className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {db.despesas.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-slate-400 py-8">Nenhuma despesa cadastrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============ DOCUMENTOS ============
function Documentos({ setModal, update, confirmAction }: any) {
  const deleteDocumento = async (id: number) => {
    confirmAction(
      'Excluir Documento',
      'Deseja realmente excluir este documento do sistema? Esta ação é irreversível.',
      async () => {
        try {
          const res = await fetch(`/api/documentos/${id}`, { method: 'DELETE' });
          if (res.ok) {
            db.documentos = db.documentos.filter((d) => d.id !== id);
            update();
          }
        } catch (err) {
          console.error('Erro ao excluir documento:', err);
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Documentos</h1>
          <p className="text-sm text-slate-500">Contratos, procurações e peças.</p>
        </div>
        <button onClick={() => setModal('novo-documento')} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
          <Plus className="w-4 h-4" /> Enviar documento
        </button>
      </div>
      <div className="bg-white border rounded-xl overflow-x-auto">
        <table className="w-full text-xs min-w-[700px]">
          <thead>
            <tr className="bg-slate-50 border-b">
              <th className="px-4 py-3 text-left text-slate-600 uppercase">Documento</th>
              <th className="px-4 py-3 text-left text-slate-600 uppercase">Cliente</th>
              <th className="px-4 py-3 text-left text-slate-600 uppercase">Data</th>
              <th className="px-4 py-3 text-left text-slate-600 uppercase">Assinatura</th>
              <th className="px-4 py-3 text-right text-slate-600 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody>
            {db.documentos.map((d) => (
              <tr key={d.id} className="border-b last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium flex items-center gap-2"><FileText className="w-4 h-4 text-slate-400" /> {d.nome}</td>
                <td className="px-4 py-3">{clienteNome(d.clienteId)}</td>
                <td className="px-4 py-3">{fmtDate(d.data)}</td>
                <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${d.assinatura === 'assinado' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{d.assinatura || 'pendente'}</span></td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => deleteDocumento(d.id)}
                    className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition inline-flex items-center justify-center"
                    title="Excluir"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {db.documentos.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-slate-400 py-8">Nenhum documento cadastrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ INTELIGÊNCIA JURÍDICA (CHAT) ============
function InteligenciaJuridica() {
  const [mensagens, setMensagens] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const enviar = async () => {
    if (!input.trim() || loading) return;
    const nova = { role: 'user' as const, content: input.trim() };
    const hist = [...mensagens, nova];
    setMensagens(hist);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/ia/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem: nova.content, historico: hist }),
      });
      const data = await res.json();
      if (data.success) {
        setMensagens([...hist, { role: 'assistant', content: data.data.resposta }]);
      } else {
        setMensagens([...hist, { role: 'assistant', content: 'Erro: ' + (data.message || 'Falha na IA') }]);
      }
    } catch (e: any) {
      setMensagens([...hist, { role: 'assistant', content: 'Erro de conexão.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Inteligência Jurídica</h1>
      <p className="text-sm text-slate-500 mb-4">Chat conversacional com IA.</p>
      <div className="bg-white border rounded-xl flex flex-col h-[600px]">
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scroll">
          {mensagens.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
              <Brain className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">Faça perguntas sobre legislação, jurisprudência e estratégia.</p>
            </div>
          )}
          {mensagens.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`rounded-lg p-3 max-w-[80%] text-sm ${m.role === 'user' ? 'bg-slate-800 text-white' : 'bg-slate-100'}`}>
                <pre className="whitespace-pre-wrap font-sans">{m.content}</pre>
              </div>
            </div>
          ))}
          {loading && <div className="text-center text-sm text-slate-500">Analisando...</div>}
        </div>
        <div className="border-t p-3 flex gap-2">
          <textarea
            className="flex-1 px-3 py-2 border rounded-lg text-sm resize-none"
            rows={2}
            placeholder="Digite sua pergunta..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
          />
          <button onClick={enviar} disabled={loading || !input.trim()} className="bg-slate-800 text-white px-4 rounded-lg text-sm">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ IA & AUTOMAÇÃO ============
function IA() {
  const [resumo, setResumo] = useState({ loading: false, text: '' });
  const [minuta, setMinuta] = useState({ loading: false, text: '' });

  const resumirProcesso = async () => {
    const select = document.getElementById('ia-processo') as HTMLSelectElement;
    const pid = select.value;
    setResumo({ loading: true, text: '' });
    try {
      const res = await fetch('/api/ia/resumir-processo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processoId: pid }),
      });
      const data = await res.json();
      if (data.success) setResumo({ loading: false, text: data.data.resumo });
      else setResumo({ loading: false, text: 'Erro: ' + data.message });
    } catch { setResumo({ loading: false, text: 'Erro de conexão.' }); }
  };

  const gerarDoc = async () => {
    if (!db.clientes || db.clientes.length === 0) {
      setMinuta({ loading: false, text: 'Erro: Nenhum cliente cadastrado no sistema. Por favor, cadastre um cliente primeiro.' });
      return;
    }
    const tipo = (document.getElementById('ia-tipo-doc') as HTMLSelectElement).value;
    const pid = (document.getElementById('ia-doc-processo') as HTMLSelectElement).value;
    const instr = (document.getElementById('ia-doc-instrucoes') as HTMLTextAreaElement).value;

    let targetClienteId = db.clientes[0].id;
    if (pid) {
      const proc = db.processos.find((p) => p.id === parseInt(pid));
      if (proc) {
        targetClienteId = proc.clienteId;
      }
    }

    setMinuta({ loading: true, text: '' });
    try {
      const res = await fetch('/api/ia/gerar-documento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, clienteId: targetClienteId, processoId: pid || null, observacoes: instr }),
      });
      const data = await res.json();
      if (data.success) setMinuta({ loading: false, text: data.data.documentoGerado });
      else setMinuta({ loading: false, text: 'Erro: ' + data.message });
    } catch { setMinuta({ loading: false, text: 'Erro de conexão.' }); }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">IA & Automação</h1>
      <p className="text-sm text-slate-500 mb-6">Recursos de IA aplicados ao escritório.</p>

      <div className="bg-white border rounded-xl p-5 mb-4">
        <h3 className="font-semibold mb-2">Resumir Processo</h3>
        <p className="text-xs text-slate-500 mb-3">Gera resumo executivo dos andamentos.</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <select id="ia-processo" className="w-full sm:flex-1 px-3 py-2 border rounded text-sm min-w-0">
            {db.processos.map((p) => <option key={p.id} value={p.id}>{p.numero} — {p.assunto}</option>)}
          </select>
          <button onClick={resumirProcesso} className="w-full sm:w-auto bg-slate-800 text-white px-4 py-2 rounded text-sm shrink-0">Resumir com IA</button>
        </div>
        {(resumo.loading || resumo.text) && (
          <div className="bg-amber-50 border p-3 rounded mt-3 text-sm whitespace-pre-wrap">
            {resumo.loading ? 'Gerando com IA...' : resumo.text}
          </div>
        )}
      </div>

      <div className="bg-white border rounded-xl p-5">
        <h3 className="font-semibold mb-2">Gerar Documento</h3>
        <p className="text-xs text-slate-500 mb-3">Petição, contestação, procuração ou contrato.</p>
        <div className="space-y-3">
          <select id="ia-tipo-doc" className="w-full px-3 py-2 border rounded text-sm">
            <option>Petição inicial</option>
            <option>Contestação</option>
            <option>Procuração</option>
            <option>Contrato de honorários</option>
          </select>
          <select id="ia-doc-processo" className="w-full px-3 py-2 border rounded text-sm">
            <option value="">— Sem processo vinculado —</option>
            {db.processos.map((p) => <option key={p.id} value={p.id}>{p.numero}</option>)}
          </select>
          <textarea id="ia-doc-instrucoes" rows={3} className="w-full px-3 py-2 border rounded text-sm" placeholder="Instruções específicas..." />
          <button onClick={gerarDoc} className="w-full sm:w-auto bg-slate-800 text-white px-4 py-2 rounded text-sm">Gerar minuta</button>
          {(minuta.loading || minuta.text) && (
            <div className="bg-amber-50 border p-3 rounded text-sm whitespace-pre-wrap">
              {minuta.loading ? 'Gerando com IA...' : minuta.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ PESQUISA JURÍDICA ============
function PesquisaJuridica() {
  const [consulta, setConsulta] = useState('');
  const [resultado, setResultado] = useState('');
  const [loading, setLoading] = useState(false);

  const pesquisar = async () => {
    if (!consulta.trim()) return;
    setLoading(true);
    setResultado('');
    try {
      const res = await fetch('/api/ia/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem: `PESQUISA JURÍDICA: ${consulta}` }),
      });
      const data = await res.json();
      if (data.success) setResultado(data.data.resposta);
      else setResultado('Erro: ' + data.message);
    } catch { setResultado('Erro de conexão.'); }
    setLoading(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Pesquisa Jurídica</h1>
      <p className="text-sm text-slate-500 mb-4">Pesquise legislação, jurisprudência e doutrina.</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border rounded-xl p-5 space-y-3">
          <textarea className="w-full px-3 py-2 border rounded text-sm" rows={4} placeholder="Sua pesquisa..." value={consulta} onChange={(e) => setConsulta(e.target.value)} />
          <button onClick={pesquisar} disabled={loading} className="w-full bg-slate-800 text-white px-4 py-2 rounded text-sm flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4" /> {loading ? 'Pesquisando...' : 'Pesquisar'}
          </button>
        </div>
        <div className="bg-white border rounded-xl p-5">
          {resultado ? <pre className="whitespace-pre-wrap text-sm">{resultado}</pre> : <p className="text-center text-slate-400 text-sm py-12">Resultado aparecerá aqui</p>}
        </div>
      </div>
    </div>
  );
}

// ============ ESTRATÉGIA PROCESSUAL ============
function EstrategiaProcessual() {
  const [caso, setCaso] = useState('');
  const [resultado, setResultado] = useState('');
  const [loading, setLoading] = useState(false);

  const analisar = async () => {
    if (!caso.trim()) return;
    setLoading(true);
    setResultado('');
    try {
      const res = await fetch('/api/ia/estrategia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caso }),
      });
      const data = await res.json();
      if (data.success) setResultado(data.data.estrategia);
      else setResultado('Erro: ' + data.message);
    } catch { setResultado('Erro de conexão.'); }
    setLoading(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Estratégia Processual</h1>
      <p className="text-sm text-slate-500 mb-4">Análise estratégica com IA.</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border rounded-xl p-5 space-y-3">
          <textarea className="w-full px-3 py-2 border rounded text-sm" rows={8} placeholder="Descreva o caso..." value={caso} onChange={(e) => setCaso(e.target.value)} />
          <button onClick={analisar} disabled={loading} className="w-full bg-slate-800 text-white px-4 py-2 rounded text-sm flex items-center justify-center gap-2">
            <Target className="w-4 h-4" /> {loading ? 'Analisando...' : 'Gerar Estratégia'}
          </button>
        </div>
        <div className="bg-white border rounded-xl p-5">
          {resultado ? <pre className="whitespace-pre-wrap text-sm">{resultado}</pre> : <p className="text-center text-slate-400 text-sm py-12">Resultado aparecerá aqui</p>}
        </div>
      </div>
    </div>
  );
}

// ============ ELABORAÇÃO DE PEÇAS ============
function ElaboracaoPecas() {
  const [tipo, setTipo] = useState('Petição Inicial');
  const [dados, setDados] = useState('');
  const [resultado, setResultado] = useState('');
  const [loading, setLoading] = useState(false);

  const gerar = async () => {
    if (!dados.trim()) return;
    if (!db.clientes || db.clientes.length === 0) {
      setResultado('Erro: Nenhum cliente cadastrado no sistema. Por favor, cadastre um cliente primeiro.');
      return;
    }
    setLoading(true);
    setResultado('');
    try {
      const res = await fetch('/api/ia/gerar-documento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, clienteId: db.clientes[0].id, observacoes: dados }),
      });
      const data = await res.json();
      if (data.success) setResultado(data.data.documentoGerado);
      else setResultado('Erro: ' + data.message);
    } catch { setResultado('Erro de conexão.'); }
    setLoading(false);
  };

  const copiar = () => { navigator.clipboard.writeText(resultado); alert('Copiado!'); };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Elaboração de Peças</h1>
      <p className="text-sm text-slate-500 mb-4">Gere petições, recursos e contratos com IA.</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border rounded-xl p-5 space-y-3">
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full px-3 py-2 border rounded text-sm">
            <option>Petição Inicial</option>
            <option>Contestação</option>
            <option>Apelação</option>
            <option>Recurso Especial</option>
            <option>Habeas Corpus</option>
            <option>Mandado de Segurança</option>
            <option>Embargos</option>
            <option>Procuração</option>
            <option>Contrato de honorários</option>
            <option>Notificação Extrajudicial</option>
          </select>
          <textarea className="w-full px-3 py-2 border rounded text-sm" rows={10} placeholder="Dados do caso..." value={dados} onChange={(e) => setDados(e.target.value)} />
          <button onClick={gerar} disabled={loading} className="w-full bg-slate-800 text-white px-4 py-2 rounded text-sm flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4" /> {loading ? 'Gerando...' : 'Gerar Peça'}
          </button>
        </div>
        <div className="bg-white border rounded-xl p-5">
          {resultado ? (
            <>
              <div className="flex justify-end mb-2">
                <button onClick={copiar} className="text-xs border px-3 py-1 rounded flex items-center gap-1"><Copy className="w-3 h-3" /> Copiar</button>
              </div>
              <pre className="whitespace-pre-wrap text-sm">{resultado}</pre>
            </>
          ) : <p className="text-center text-slate-400 text-sm py-12">Peça gerada aparecerá aqui</p>}
        </div>
      </div>
    </div>
  );
}

// ============ ANÁLISE DE CONTRATOS ============
function AnaliseContratos() {
  const [contrato, setContrato] = useState('');
  const [tipo, setTipo] = useState('Locação');
  const [resultado, setResultado] = useState('');
  const [loading, setLoading] = useState(false);

  const analisar = async () => {
    if (!contrato.trim()) return;
    setLoading(true);
    setResultado('');
    try {
      const res = await fetch('/api/ia/analise-contrato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contrato, tipoContrato: tipo }),
      });
      const data = await res.json();
      if (data.success) setResultado(data.data.analise);
      else setResultado('Erro: ' + data.message);
    } catch { setResultado('Erro de conexão.'); }
    setLoading(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Análise de Contratos</h1>
      <p className="text-sm text-slate-500 mb-4">Identifique cláusulas abusivas, riscos e melhorias.</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border rounded-xl p-5 space-y-3">
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full px-3 py-2 border rounded text-sm">
            <option>Locação</option>
            <option>Compra e Venda</option>
            <option>Prestação de Serviços</option>
            <option>Trabalho/CLT</option>
            <option>Empresarial</option>
            <option>Mútuo</option>
          </select>
          <textarea className="w-full px-3 py-2 border rounded text-sm font-mono" rows={12} placeholder="Cole o contrato..." value={contrato} onChange={(e) => setContrato(e.target.value)} />
          <button onClick={analisar} disabled={loading} className="w-full bg-slate-800 text-white px-4 py-2 rounded text-sm flex items-center justify-center gap-2">
            <FileCheck className="w-4 h-4" /> {loading ? 'Analisando...' : 'Analisar'}
          </button>
        </div>
        <div className="bg-white border rounded-xl p-5">
          {resultado ? <pre className="whitespace-pre-wrap text-sm">{resultado}</pre> : <p className="text-center text-slate-400 text-sm py-12">Análise aparecerá aqui</p>}
        </div>
      </div>
    </div>
  );
}

// ============ PARECER JURÍDICO ============
function ParecerJuridico() {
  const [caso, setCaso] = useState('');
  const [resultado, setResultado] = useState('');
  const [loading, setLoading] = useState(false);

  const gerar = async () => {
    if (!caso.trim()) return;
    setLoading(true);
    setResultado('');
    try {
      const res = await fetch('/api/ia/parecer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caso }),
      });
      const data = await res.json();
      if (data.success) setResultado(data.data.parecer);
      else setResultado('Erro: ' + data.message);
    } catch { setResultado('Erro de conexão.'); }
    setLoading(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Parecer Jurídico</h1>
      <p className="text-sm text-slate-500 mb-4">Elabore pareceres estruturados com IA.</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border rounded-xl p-5 space-y-3">
          <textarea className="w-full px-3 py-2 border rounded text-sm" rows={12} placeholder="Descreva o caso..." value={caso} onChange={(e) => setCaso(e.target.value)} />
          <button onClick={gerar} disabled={loading} className="w-full bg-slate-800 text-white px-4 py-2 rounded text-sm flex items-center justify-center gap-2">
            <Gavel className="w-4 h-4" /> {loading ? 'Elaborando...' : 'Elaborar Parecer'}
          </button>
        </div>
        <div className="bg-white border rounded-xl p-5">
          {resultado ? <pre className="whitespace-pre-wrap text-sm">{resultado}</pre> : <p className="text-center text-slate-400 text-sm py-12">Parecer aparecerá aqui</p>}
        </div>
      </div>
    </div>
  );
}

// ============ CÁLCULOS JURÍDICOS ============
function CalculosJuridicos() {
  const [principal, setPrincipal] = useState('');
  const [taxa, setTaxa] = useState('');
  const [periodos, setPeriodos] = useState('');
  const [tipoJuros, setTipoJuros] = useState('simples');
  const [resultado, setResultado] = useState<{ juros: number; total: number } | null>(null);

  const calcular = () => {
    const p = parseFloat(principal.replace(',', '.'));
    const t = parseFloat(taxa.replace(',', '.')) / 100;
    const n = parseInt(periodos) || 1;
    if (isNaN(p) || isNaN(t)) return;
    const juros = tipoJuros === 'simples' ? p * t * n : p * (Math.pow(1 + t, n) - 1);
    setResultado({ juros, total: p + juros });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Cálculos Jurídicos</h1>
      <p className="text-sm text-slate-500 mb-4">Juros, atualização monetária e honorários.</p>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-800 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>Estimativas para conferência preliminar. Use ferramentas próprias para valores oficiais.</span>
      </div>
      <div className="bg-white border rounded-xl p-5 max-w-xl">
        <h3 className="font-semibold mb-4">Cálculo de Juros</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <input className="px-3 py-2 border rounded text-sm" placeholder="Principal (R$)" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
          <input className="px-3 py-2 border rounded text-sm" placeholder="Taxa (%)" value={taxa} onChange={(e) => setTaxa(e.target.value)} />
          <input className="px-3 py-2 border rounded text-sm" placeholder="Períodos" value={periodos} onChange={(e) => setPeriodos(e.target.value)} />
          <select className="px-3 py-2 border rounded text-sm" value={tipoJuros} onChange={(e) => setTipoJuros(e.target.value)}>
            <option value="simples">Simples</option>
            <option value="compostos">Compostos</option>
          </select>
        </div>
        <button onClick={calcular} className="bg-slate-800 text-white px-4 py-2 rounded text-sm flex items-center gap-2">
          <Calculator className="w-4 h-4" /> Calcular
        </button>
        {resultado && (
          <div className="mt-4 bg-slate-50 p-3 rounded space-y-1 text-sm">
            <div className="flex justify-between"><span>Juros:</span><span className="font-semibold text-orange-600">+{fmtMoney(resultado.juros)}</span></div>
            <div className="flex justify-between border-t pt-1"><span>Total:</span><span className="font-bold">{fmtMoney(resultado.total)}</span></div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ INTEGRAÇÕES ============
function Integracoes({ update }: any) {
  const i = db.integracoes;
  const horasDesde = (iso: string) => Math.round((Date.now() - new Date(iso).getTime()) / 3600000);
  const toggle = async (key: string) => {
    const updated = { ...i, [key]: !(i as any)[key] };
    try {
      const res = await fetch('/api/integracoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        const json = await res.json();
        db.integracoes = json.data;
        update();
      }
    } catch (err) {
      console.error('Erro ao atualizar integração:', err);
    }
  };

  const items = [
    { key: 'whatsapp', nome: 'WhatsApp Business', desc: 'Lembretes de prazo e audiência' },
    { key: 'email', nome: 'E-mail Transacional', desc: 'Notificações automáticas' },
    { key: 'tribunal', nome: 'Acompanhamento Processual', desc: `Última sincronia: há ${horasDesde(i.ultimaSincroniaTribunal)}h` },
    { key: 'ocr', nome: 'OCR de Documentos', desc: 'Extração de texto de PDFs' },
    { key: 'assinatura', nome: 'Assinatura Eletrônica', desc: 'DocuSign/Clicksign' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Integrações</h1>
      <p className="text-sm text-slate-500 mb-4">Conexões externas do sistema.</p>
      <div className="bg-white border rounded-xl">
        {items.map((item, idx) => (
          <div key={item.key} className={`flex justify-between items-center p-4 ${idx < items.length - 1 ? 'border-b' : ''}`}>
            <div>
              <div className="font-semibold text-sm">{item.nome}</div>
              <div className="text-xs text-slate-500">{item.desc}</div>
            </div>
            <button
              onClick={() => toggle(item.key)}
              className={`w-12 h-6 rounded-full relative transition-colors ${(i as any)[item.key] ? 'bg-emerald-500' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${(i as any)[item.key] ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ PORTAL DO CLIENTE ============
function PortalCliente() {
  const [clienteId, setClienteId] = useState(db.clientes[0]?.id || 1);
  const cliente = db.clientes.find((c) => c.id === clienteId);
  const processos = db.processos.filter((p) => p.clienteId === clienteId);
  const docs = db.documentos.filter((d) => d.clienteId === clienteId);
  const hon = db.honorarios.filter((h) => h.clienteId === clienteId);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Portal do Cliente</h1>
      <p className="text-sm text-slate-500 mb-4">Pré-visualização do que o cliente vê.</p>
      <select className="mb-4 px-3 py-2 border rounded text-sm" value={clienteId} onChange={(e) => setClienteId(parseInt(e.target.value))}>
        {db.clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
      </select>
      <div className="bg-slate-800 text-white rounded-xl p-5 mb-4">
        <p className="text-xs text-slate-300">Bem-vindo(a)</p>
        <p className="text-xl font-semibold">{cliente?.nome}</p>
      </div>
      <h3 className="font-semibold mb-3">Meus Processos</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {processos.map((p) => (
          <div key={p.id} className="bg-white border rounded-xl p-4">
            <div className="font-semibold text-sm">{p.numero}</div>
            <div className="text-xs text-slate-500 mb-2">{p.classe} — {p.assunto}</div>
            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${p.status === 'ativo' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{p.status === 'ativo' ? 'Em andamento' : 'Encerrado'}</span>
          </div>
        ))}
        {processos.length === 0 && <p className="text-slate-400 text-sm">Nenhum processo vinculado</p>}
      </div>
      <h3 className="font-semibold mb-3">Situação Financeira</h3>
      <div className="bg-white border rounded-xl">
        {hon.map((h) => (
          <div key={h.id} className="flex justify-between p-3 border-b last:border-0 text-sm">
            <span>{fmtMoney(h.valor)} — vence em {fmtDate(h.vencimento)}</span>
            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${h.status === 'pago' ? 'bg-emerald-50 text-emerald-700' : h.status === 'atrasado' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{h.status}</span>
          </div>
        ))}
        {hon.length === 0 && <p className="text-center text-slate-400 p-4 text-sm">Nenhum registro</p>}
      </div>
    </div>
  );
}

// ============ RELATÓRIOS ============
function Relatorios() {
  const porAdvogado: Record<number, number> = {};
  db.processos.forEach((p) => { porAdvogado[p.advogadoId] = (porAdvogado[p.advogadoId] || 0) + 1; });
  const ativos = db.processos.filter((p) => p.status === 'ativo').length;
  const encerrados = db.processos.filter((p) => p.status === 'encerrado').length;

  const exportarCSV = () => {
    const linhas = [['Indicador', 'Valor'], ['Clientes', String(db.clientes.length)], ['Processos', String(db.processos.length)], ['Ativos', String(ativos)], ['Encerrados', String(encerrados)]];
    const csv = linhas.map((l) => l.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'relatorio.csv';
    a.click();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Relatórios</h1>
          <p className="text-sm text-slate-500">Indicadores do escritório.</p>
        </div>
        <button onClick={exportarCSV} className="bg-white border px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border rounded-xl p-4"><p className="text-xs text-slate-500 uppercase">Clientes</p><p className="text-2xl font-bold mt-1">{db.clientes.length}</p></div>
        <div className="bg-white border rounded-xl p-4"><p className="text-xs text-slate-500 uppercase">Processos</p><p className="text-2xl font-bold mt-1">{db.processos.length}</p></div>
        <div className="bg-white border rounded-xl p-4"><p className="text-xs text-slate-500 uppercase">Ativos</p><p className="text-2xl font-bold mt-1 text-emerald-600">{ativos}</p></div>
        <div className="bg-white border rounded-xl p-4"><p className="text-xs text-slate-500 uppercase">Encerrados</p><p className="text-2xl font-bold mt-1 text-slate-500">{encerrados}</p></div>
      </div>
      <div className="bg-white border rounded-xl p-5">
        <h3 className="font-semibold mb-3">Processos por Advogado</h3>
        <table className="w-full text-sm">
          <tbody>
            {Object.entries(porAdvogado).map(([id, qtd]) => (
              <tr key={id} className="border-b last:border-0">
                <td className="py-2">{usuarioNome(parseInt(id))}</td>
                <td className="py-2 text-right font-semibold">{qtd}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ USUÁRIOS ============
function Usuarios({ confirmAction }: any) {
  const [novoUsuario, setNovoUsuario] = useState({ nome: '', email: '', perfil: 'Advogado' });
  const [showForm, setShowForm] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [, forceRender] = useState({});

  const criar = async () => {
    if (!novoUsuario.nome || !novoUsuario.email) return;
    setStatus(null);
    try {
      // Criar o usuário no Firebase Auth usando uma instância secundária para não deslogar o admin
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
        setStatus({ type: 'success', message: `Usuário criado com sucesso! Senha temporária: ${password}` });
        forceRender({});
      } else {
        setStatus({ type: 'error', message: data.message || 'Erro ao salvar usuário no banco de dados.' });
      }
    } catch (err: any) {
      console.error('Erro ao criar usuário:', err);
      setStatus({ type: 'error', message: 'Erro ao criar usuário: ' + (err.message || 'Erro desconhecido') });
    }
  };

  const excluir = async (id: number) => {
    confirmAction(
      'Excluir Usuário',
      'Deseja realmente remover o acesso deste usuário do sistema?',
      async () => {
        await fetch(`/api/usuarios/${id}`, { method: 'DELETE' });
        const idx = db.usuarios.findIndex((u) => u.id === id);
        if (idx >= 0) db.usuarios.splice(idx, 1);
        forceRender({});
      }
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Usuários</h1>
          <p className="text-sm text-slate-500">Gestão de acessos.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
          <Plus className="w-4 h-4" /> Novo usuário
        </button>
      </div>
      {status && (
        <div className={`p-3 rounded-lg mb-4 text-sm flex items-center gap-2 ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {status.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {status.message}
        </div>
      )}
      {showForm && (
        <div className="bg-white border rounded-xl p-4 mb-4 space-y-3">
          <input className="w-full px-3 py-2 border rounded text-sm" placeholder="Nome" value={novoUsuario.nome} onChange={(e) => setNovoUsuario({ ...novoUsuario, nome: e.target.value })} />
          <input className="w-full px-3 py-2 border rounded text-sm" placeholder="E-mail" value={novoUsuario.email} onChange={(e) => setNovoUsuario({ ...novoUsuario, email: e.target.value })} />
          <select className="w-full px-3 py-2 border rounded text-sm" value={novoUsuario.perfil} onChange={(e) => setNovoUsuario({ ...novoUsuario, perfil: e.target.value })}>
            <option>Administrador</option>
            <option>Advogado</option>
            <option>Estagiário</option>
            <option>Secretária</option>
          </select>
          <button onClick={criar} className="bg-emerald-600 text-white px-4 py-2 rounded text-sm">Salvar</button>
        </div>
      )}
      <div className="bg-white border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b">
              <th className="px-4 py-3 text-left text-slate-600 uppercase text-xs">Nome</th>
              <th className="px-4 py-3 text-left text-slate-600 uppercase text-xs">E-mail</th>
              <th className="px-4 py-3 text-left text-slate-600 uppercase text-xs">Perfil</th>
              <th className="px-4 py-3 text-right text-slate-600 uppercase text-xs">Ações</th>
            </tr>
          </thead>
          <tbody>
            {db.usuarios.map((u) => (
              <tr key={u.id} className="border-b last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{u.nome}</td>
                <td className="px-4 py-3 text-slate-600">{u.email}</td>
                <td className="px-4 py-3"><span className="bg-slate-100 px-2 py-1 rounded text-xs font-semibold">{u.perfil}</span></td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => excluir(u.id)} className="text-red-600 hover:text-red-800"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
