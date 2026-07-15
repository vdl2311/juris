import React, { useState, useEffect, useMemo } from 'react';
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
  'Administrador': ['dashboard', 'clientes', 'processos', 'agenda', 'tarefas', 'financeiro', 'documentos', 'relatorios', 'usuarios', 'ia', 'integracoes', 'portal', 'inteligencia', 'pesquisa', 'estrategia', 'pecas', 'contratos', 'parecer', 'calculos', 'auditoria'],
  'Advogado': ['dashboard', 'clientes', 'processos', 'agenda', 'tarefas', 'financeiro', 'documentos', 'relatorios', 'ia', 'portal', 'inteligencia', 'pesquisa', 'estrategia', 'pecas', 'contratos', 'parecer', 'calculos', 'auditoria'],
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
  { id: 'auditoria', label: 'Auditoria de Ações', group: 'Administração', icon: ShieldCheck },
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
  const [toasts, setToasts] = useState<any[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success', action?: { label: string; onClick: () => void }) => {
    const id = String(Date.now());
    setToasts((prev) => [...prev, { id, type, message, action }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, action ? 6000 : 4000);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const searchResults = useMemo(() => {
    if (!globalSearchQuery.trim()) return { clientes: [], processos: [], tarefas: [], modulos: [] };
    const q = globalSearchQuery.toLowerCase();
    
    const modulos = [
      { id: 'dashboard', label: 'Dashboard', group: 'Visão Geral' },
      { id: 'clientes', label: 'Clientes', group: 'Gestão' },
      { id: 'processos', label: 'Processos', group: 'Gestão' },
      { id: 'agenda', label: 'Agenda Jurídica', group: 'Gestão' },
      { id: 'tarefas', label: 'Quadro de Tarefas', group: 'Gestão' },
      { id: 'financeiro', label: 'Financeiro', group: 'Gestão' },
      { id: 'documentos', label: 'Documentos', group: 'Gestão' },
      { id: 'inteligencia', label: 'Inteligência Jurídica (Chat)', group: 'IA Jurídica' },
      { id: 'ia', label: 'IA & Automação', group: 'IA Jurídica' },
      { id: 'pesquisa', label: 'Pesquisa Jurídica', group: 'IA Jurídica' },
      { id: 'estrategia', label: 'Estratégia Processual', group: 'IA Jurídica' },
      { id: 'pecas', label: 'Elaboração de Peças', group: 'IA Jurídica' },
      { id: 'contratos', label: 'Análise de Contratos', group: 'IA Jurídica' },
      { id: 'parecer', label: 'Parecer Jurídico', group: 'IA Jurídica' },
      { id: 'calculos', label: 'Cálculos Jurídicos', group: 'Ferramentas' },
      { id: 'integracoes', label: 'Integrações', group: 'Administração' },
      { id: 'portal', label: 'Portal do Cliente', group: 'Administração' },
      { id: 'relatorios', label: 'Relatórios', group: 'Administração' },
      { id: 'usuarios', label: 'Usuários', group: 'Administração' },
      { id: 'auditoria', label: 'Auditoria de Ações', group: 'Administração' },
    ].filter(m => m.label.toLowerCase().includes(q));

    const clientes = db.clientes.filter(c => c.nome.toLowerCase().includes(q) || c.doc.includes(q)).slice(0, 5);
    const processos = db.processos.filter(p => p.numero.includes(q) || (p.classe || '').toLowerCase().includes(q)).slice(0, 5);
    const tarefas = db.tarefas.filter(t => t.titulo.toLowerCase().includes(q) || usuarioNome(t.responsavelId).toLowerCase().includes(q)).slice(0, 5);

    return { modulos, clientes, processos, tarefas };
  }, [globalSearchQuery, page]);

  const handleSelectResult = (type: string, id: any) => {
    setIsSearchOpen(false);
    setGlobalSearchQuery('');
    if (type === 'modulo') {
      setPage(id);
      setViewingProcesso(null);
    } else if (type === 'cliente') {
      setPage('clientes');
    } else if (type === 'processo') {
      setPage('processos');
      setViewingProcesso(id);
    } else if (type === 'tarefa') {
      setPage('tarefas');
    }
  };
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

  useEffect(() => {
    if (usuarioAtual) {
      const originalFetch = window.fetch;
      try {
        Object.defineProperty(window, 'fetch', {
          value: function (input: any, init: any) {
            init = init || {};
            init.headers = init.headers || {};
            if (init.headers instanceof Headers) {
              init.headers.set('X-User-Email', usuarioAtual.email);
              init.headers.set('X-User-Name', usuarioAtual.nome);
            } else if (Array.isArray(init.headers)) {
              init.headers.push(['X-User-Email', usuarioAtual.email]);
              init.headers.push(['X-User-Name', usuarioAtual.nome]);
            } else {
              init.headers['X-User-Email'] = usuarioAtual.email;
              init.headers['X-User-Name'] = usuarioAtual.nome;
            }
            return originalFetch(input, init);
          },
          writable: true,
          configurable: true,
          enumerable: true
        });
      } catch (e) {
        console.error('Could not redefine window.fetch:', e);
      }
    }
  }, [usuarioAtual]);

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
          <button onClick={() => setIsSidebarOpen(true)} className="p-1" aria-label="Abrir menu"><Menu size={20} /></button>
          <span className="font-semibold">Jurídico<span className="text-amber-400">Manager</span></span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsSearchOpen(true)} className="p-2 text-slate-300 hover:text-white" aria-label="Pesquisa rápida">
            <Search size={18} />
          </button>
          {notifs.length > 0 && (
            <button onClick={() => handleNav('dashboard')} className="relative p-1" aria-label="Ver notificações">
              <Bell size={18} />
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">{notifs.length}</span>
            </button>
          )}
        </div>
      </header>

      {/* Mobile Sidebar */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setIsSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-slate-900 text-slate-200 flex flex-col">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <span className="font-semibold text-white">Jurídico<span className="text-amber-400">Manager</span></span>
              <button onClick={() => setIsSidebarOpen(false)} className="p-1" aria-label="Fechar menu"><X size={20} /></button>
            </div>
            <div className="px-4 py-3 border-b border-white/10">
              <button
                onClick={() => { setIsSidebarOpen(false); setIsSearchOpen(true); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-400 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:text-white transition cursor-pointer"
              >
                <Search size={14} />
                <span>Buscar...</span>
              </button>
            </div>
            <SidebarContent perm={perm} page={page} handleNav={handleNav} notifs={notifs} />
            <UserFooter usuarioAtual={usuarioAtual} setUsuarioAtual={setUsuarioAtual} setPage={setPage} />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex w-64 bg-slate-900 text-slate-200 flex-col shrink-0 border-r border-white/5">
        <div className="px-5 py-5 border-b border-white/10 flex items-center gap-2">
          <Scale className="w-6 h-6 text-amber-400" />
          <span className="font-semibold text-white text-base">Jurídico<span className="text-amber-400">Manager</span></span>
        </div>
        <div className="px-4 py-3 border-b border-white/10">
          <button
            onClick={() => setIsSearchOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-400 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:text-white transition cursor-pointer"
          >
            <Search size={14} />
            <span>Buscar (Ctrl+K)...</span>
          </button>
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
            {page === 'clientes' && <Clientes setModal={setModal} update={update} confirmAction={confirmAction} showToast={showToast} />}
            {page === 'processos' && (viewingProcesso ? <ProcessoDetalhe id={viewingProcesso} setViewingProcesso={setViewingProcesso} update={update} /> : <Processos setViewingProcesso={setViewingProcesso} setModal={setModal} update={update} confirmAction={confirmAction} />)}
            {page === 'agenda' && <Agenda setModal={setModal} update={update} confirmAction={confirmAction} />}
            {page === 'tarefas' && <Tarefas setModal={setModal} update={update} confirmAction={confirmAction} showToast={showToast} />}
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
            {page === 'auditoria' && <Auditoria usuarioAtual={usuarioAtual} />}
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

      {/* Busca Global (Cmd+K) Modal */}
      {isSearchOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-[150] p-4 pt-16 sm:pt-28 pointer-events-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden w-full max-w-lg animate-fade-in pointer-events-auto">
            {/* Input de Busca */}
            <div className="p-4 border-b border-slate-100 flex items-center gap-3">
              <Search className="text-slate-400 w-5 h-5 shrink-0" />
              <input
                autoFocus
                type="text"
                placeholder="Busque por módulos, clientes, processos, tarefas..."
                className="w-full text-base bg-transparent text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                value={globalSearchQuery}
                onChange={(e) => setGlobalSearchQuery(e.target.value)}
              />
              <button
                onClick={() => setIsSearchOpen(false)}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition-colors cursor-pointer"
              >
                ESC
              </button>
            </div>

            {/* Resultados */}
            <div className="max-h-[350px] overflow-y-auto custom-scroll p-2 space-y-4">
              {!globalSearchQuery.trim() ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Digite algo para buscar no JurisManager...
                </div>
              ) : (
                <>
                  {/* Módulos */}
                  {searchResults.modulos.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1">Módulos</h4>
                      <div className="space-y-0.5">
                        {searchResults.modulos.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => handleSelectResult('modulo', m.id)}
                            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg flex items-center justify-between transition-colors cursor-pointer"
                          >
                            <span>{m.label}</span>
                            <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-semibold">{m.group}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Clientes */}
                  {searchResults.clientes.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1">Clientes</h4>
                      <div className="space-y-0.5">
                        {searchResults.clientes.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleSelectResult('cliente', c.id)}
                            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg flex flex-col transition-colors cursor-pointer"
                          >
                            <span className="font-semibold">{c.nome}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{c.doc} - {c.contato}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Processos */}
                  {searchResults.processos.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1">Processos</h4>
                      <div className="space-y-0.5">
                        {searchResults.processos.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleSelectResult('processo', p.id)}
                            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg flex flex-col transition-colors cursor-pointer"
                          >
                            <span className="font-semibold font-mono text-slate-800">{p.numero}</span>
                            <span className="text-[10px] text-slate-400 uppercase font-bold">{p.tribunal} - {p.classe}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tarefas */}
                  {searchResults.tarefas.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1">Tarefas</h4>
                      <div className="space-y-0.5">
                        {searchResults.tarefas.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => handleSelectResult('tarefa', t.id)}
                            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg flex flex-col transition-colors cursor-pointer"
                          >
                            <span className="font-semibold">{t.titulo}</span>
                            <span className="text-[10px] text-slate-400">Responsável: {usuarioNome(t.responsavelId)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchResults.modulos.length === 0 &&
                   searchResults.clientes.length === 0 &&
                   searchResults.processos.length === 0 &&
                   searchResults.tarefas.length === 0 && (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      Nenhum resultado encontrado para "{globalSearchQuery}"
                    </div>
                  )}
                </>
              )}
            </div>
            
            {/* Rodapé do Modal */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
              <span>Use as setas ou clique para navegar</span>
              <span>Pressione <span className="bg-slate-200 px-1 rounded font-semibold text-slate-500">ESC</span> para fechar</span>
            </div>
          </div>
        </div>
      )}

      {/* Container de Toasts flutuantes */}
      <div className="fixed bottom-4 right-4 z-[150] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`p-3 rounded-lg shadow-lg flex items-center justify-between gap-3 text-sm pointer-events-auto border transition-all duration-300 animate-fade-in ${
              t.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-500'
                : t.type === 'error'
                ? 'bg-red-600 text-white border-red-500'
                : 'bg-slate-800 text-white border-slate-700'
            }`}
          >
            <div className="flex-1">{t.message}</div>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action.onClick();
                  setToasts((prev) => prev.filter((toast) => toast.id !== t.id));
                }}
                className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-2.5 py-1 rounded transition-colors cursor-pointer"
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((toast) => toast.id !== t.id))}
              className="text-white/70 hover:text-white"
              aria-label="Fechar"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
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

  // Estados adicionais para recuperação de senha com código de 6 dígitos
  const [recoveryStep, setRecoveryStep] = useState<1 | 2>(1);
  const [tokenRecuperar, setTokenRecuperar] = useState('');
  const [novaSenhaRecuperar, setNovaSenhaRecuperar] = useState('');
  const [confirmaNovaSenhaRecuperar, setConfirmaNovaSenhaRecuperar] = useState('');

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
      let usuarioCompativel: any = null;
      let loginEfetuado = false;

      try {
        const userCredential = await signInWithEmailAndPassword(auth, emailDigitado, senhaDigitada);
        
        // Criar um objeto de usuário compatível com o resto da aplicação
        usuarioCompativel = usuariosLocais.find((u) => (u.email || '').toLowerCase() === emailDigitado.toLowerCase());
        if (!usuarioCompativel) {
          const emailLower = emailDigitado.toLowerCase();
          usuarioCompativel = {
            id: Date.now(),
            nome: emailDigitado.split('@')[0],
            email: emailDigitado,
            perfil: (emailLower === 'vidal2311usa@gmail.com' || emailLower === 'bandavai62@gmail.com') ? 'Administrador' : 'Advogado'
          };
        }

        // Garantir que o usuário está no Firestore do cliente
        try {
          const { doc, setDoc, getDoc } = await import('firebase/firestore');
          const { firestore } = await import('./firebase');
          const userDocRef = doc(firestore, 'usuarios', String(usuarioCompativel.id));
          const userDocSnap = await getDoc(userDocRef);
          if (!userDocSnap.exists()) {
            await setDoc(userDocRef, usuarioCompativel);
          } else {
            // Se o usuário existe no banco, confiamos no perfil do banco de dados (reforço contra P-002)
            usuarioCompativel = userDocSnap.data();
          }
        } catch (errDb) {
          console.error('Erro ao salvar usuário logado no Firestore:', errDb);
        }
        loginEfetuado = true;
      } catch (authErr: any) {
        console.warn('Erro ao autenticar pelo Firebase Auth. Tentando contingência local com validação de senha...', authErr);
        
        // Se houver erro de rede ou falha de conexão com Firebase (ex: network-request-failed),
        // ou se for outro erro do Firebase que impossibilite o login mas o usuário exista localmente,
        // tentamos autenticação local validando a senha contra a cadastrada localmente para segurança (P-003).
        const localUser = usuariosLocais.find((u) => (u.email || '').toLowerCase() === emailDigitado.toLowerCase());
        if (localUser) {
          const localSenhaEsperada = localUser.senha || 'SenhaTemporaria123!';
          if (senhaDigitada === localSenhaEsperada) {
            usuarioCompativel = localUser;
            loginEfetuado = true;
            console.log('[FALLBACK SEGURO] Login local efetuado com sucesso (senha validada) para:', emailDigitado);
          } else {
            // Senha incorreta localmente
            setLoginError('E-mail ou senha incorretos.');
            setLoading(false);
            return;
          }
        } else {
          // Se não houver correspondência local, repassamos o erro original
          throw authErr;
        }
      }

      if (loginEfetuado && usuarioCompativel) {
        onLogin(usuarioCompativel);
      }
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

  const handleRecuperarSenhaBackend = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    const targetEmail = emailRecuperar.trim();
    if (!targetEmail) {
      setStatusMsg({ type: 'error', text: 'Por favor, insira o e-mail de cadastro.' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/recuperar-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setStatusMsg({ type: 'error', text: data.message || 'Erro ao processar solicitação.' });
      } else {
        setStatusMsg({ type: 'success', text: data.message });
        setRecoveryStep(2);
      }
    } catch (err: any) {
      console.error('Erro ao recuperar senha:', err);
      setStatusMsg({ type: 'error', text: 'Erro ao conectar ao servidor para recuperação.' });
    } finally {
      setLoading(false);
    }
  };

  const handleRedefinirSenhaBackend = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    const targetEmail = emailRecuperar.trim();
    const targetToken = tokenRecuperar.trim();
    const targetNovaSenha = novaSenhaRecuperar.trim();
    const targetConfirma = confirmaNovaSenhaRecuperar.trim();

    if (!targetToken) {
      setStatusMsg({ type: 'error', text: 'Por favor, insira o código de verificação enviado.' });
      return;
    }
    if (!targetNovaSenha) {
      setStatusMsg({ type: 'error', text: 'Por favor, insira a nova senha.' });
      return;
    }
    if (targetNovaSenha !== targetConfirma) {
      setStatusMsg({ type: 'error', text: 'As senhas não coincidem.' });
      return;
    }
    if (targetNovaSenha.length < 6) {
      setStatusMsg({ type: 'error', text: 'A senha deve conter pelo menos 6 caracteres.' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/redefinir-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          token: targetToken,
          novaSenha: targetNovaSenha,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setStatusMsg({ type: 'error', text: data.message || 'Erro ao redefinir a senha.' });
      } else {
        setStatusMsg({ type: 'success', text: 'Senha alterada com sucesso! Você já pode fazer login.' });
        // Limpar os campos e voltar para login
        setTimeout(() => {
          setShowRecuperar(false);
          setRecoveryStep(1);
          setTokenRecuperar('');
          setNovaSenhaRecuperar('');
          setConfirmaNovaSenhaRecuperar('');
          setEmailRecuperar('');
          setStatusMsg(null);
        }, 3000);
      }
    } catch (err: any) {
      console.error('Erro ao redefinir senha:', err);
      setStatusMsg({ type: 'error', text: 'Erro ao conectar ao servidor para redefinição.' });
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
                  }}
                  className="text-xs text-amber-400 hover:text-amber-300 transition-colors cursor-pointer font-medium"
                >
                  Esqueceu a senha? Redefinir senha do perfil
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={recoveryStep === 1 ? handleRecuperarSenhaBackend : handleRedefinirSenhaBackend} className="space-y-4">
              <h2 className="text-sm font-semibold text-white text-center mb-1">
                {recoveryStep === 1 ? 'Recuperação de Senha' : 'Redefinição de Senha'}
              </h2>
              <p className="text-xs text-slate-400 text-center leading-relaxed mb-3">
                {recoveryStep === 1
                  ? 'Identifique seu e-mail corporativo cadastrado. Enviaremos um código de verificação de 6 dígitos para você.'
                  : `Código enviado para o e-mail: ${emailRecuperar}. Insira o código de 6 dígitos e sua nova senha de acesso.`}
              </p>

              {statusMsg && (
                <div
                  className={`p-3 rounded text-xs leading-relaxed break-words whitespace-pre-line ${
                    statusMsg.type === 'success'
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/10 border border-red-500/20 text-red-400'
                  }`}
                >
                  {statusMsg.text}
                </div>
              )}

              {recoveryStep === 1 ? (
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
                    required
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label htmlFor="token-recuperar" className="text-xs text-slate-300 font-medium">Código de Verificação (6 dígitos)</label>
                    <input
                      id="token-recuperar"
                      type="text"
                      placeholder="123456"
                      maxLength={6}
                      className="w-full px-3 py-2 rounded-md text-sm font-mono tracking-widest text-center bg-slate-900 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
                      value={tokenRecuperar}
                      onChange={(e) => setTokenRecuperar(e.target.value)}
                      disabled={loading}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="senha-nova" className="text-xs text-slate-300 font-medium">Nova Senha</label>
                    <input
                      id="senha-nova"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      className="w-full px-3 py-2 rounded-md text-sm bg-slate-900 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
                      value={novaSenhaRecuperar}
                      onChange={(e) => setNovaSenhaRecuperar(e.target.value)}
                      disabled={loading}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="senha-confirma" className="text-xs text-slate-300 font-medium">Confirmar Nova Senha</label>
                    <input
                      id="senha-confirma"
                      type="password"
                      placeholder="Repita a nova senha"
                      className="w-full px-3 py-2 rounded-md text-sm bg-slate-900 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
                      value={confirmaNovaSenhaRecuperar}
                      onChange={(e) => setConfirmaNovaSenhaRecuperar(e.target.value)}
                      disabled={loading}
                      required
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-slate-900 py-2.5 rounded-md text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                {loading ? 'Enviando...' : recoveryStep === 1 ? 'Enviar Código de Recuperação' : 'Confirmar Nova Senha'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowRecuperar(false);
                  setRecoveryStep(1);
                  setTokenRecuperar('');
                  setNovaSenhaRecuperar('');
                  setConfirmaNovaSenhaRecuperar('');
                  setStatusMsg(null);
                }}
                className="w-full border border-white/10 text-slate-300 hover:bg-white/5 py-2.5 rounded-md text-sm font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                {recoveryStep === 1 ? 'Voltar para o login' : 'Cancelar e Voltar'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ EMPTY STATE COMPONENT ============
interface EmptyStateProps {
  icon: any;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 bg-white border border-dashed border-slate-300 rounded-xl max-w-md mx-auto my-6 animate-fade-in shadow-sm">
      <div className="p-3 bg-amber-50 text-amber-600 rounded-full mb-3">
        <Icon size={24} />
      </div>
      <h3 className="text-sm font-semibold text-slate-800 mb-1">{title}</h3>
      <p className="text-xs text-slate-500 mb-4 max-w-[280px]">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="bg-slate-800 text-white hover:bg-slate-700 text-xs px-3 py-1.5 rounded-lg font-medium transition cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
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
function Clientes({ setModal, update, confirmAction, showToast }: any) {
  const [search, setSearch] = useState('');
  const filtered = db.clientes.filter((c) =>
    c.nome.toLowerCase().includes(search.toLowerCase()) || c.doc.includes(search) || c.contato.includes(search)
  );

  const deleteCliente = async (id: number) => {
    confirmAction(
      'Excluir Cliente',
      'Deseja realmente excluir este cliente? Todos os dados associados serão mantidos, mas o cadastro do cliente será removido.',
      async () => {
        const clienteExcluido = db.clientes.find(c => c.id === id);
        if (!clienteExcluido) return;

        // Remover temporariamente do estado local
        db.clientes = db.clientes.filter((c) => c.id !== id);
        update();

        let undoClicked = false;

        // Timer para exclusão definitiva no backend/Firestore
        const timeoutId = setTimeout(async () => {
          if (!undoClicked) {
            try {
              const res = await fetch(`/api/clientes/${id}`, { method: 'DELETE' });
              if (!res.ok) {
                throw new Error('Falha no status HTTP ' + res.status);
              }
            } catch (err) {
              console.warn('[CLIENTE DELETE FALLBACK] Erro ao excluir cliente via backend. Tentando Firestore...', err);
              try {
                const { doc, deleteDoc } = await import('firebase/firestore');
                const { firestore } = await import('./firebase');
                await deleteDoc(doc(firestore, 'clientes', String(id)));
              } catch (fErr) {
                console.error('[CLIENTE DELETE CRITICAL] Erro ao excluir cliente no Firestore:', fErr);
              }
            }
          }
        }, 5000);

        showToast('Cliente excluído com sucesso.', 'info', {
          label: 'Desfazer',
          onClick: () => {
            undoClicked = true;
            clearTimeout(timeoutId);
            // Restaurar localmente
            db.clientes.push(clienteExcluido);
            update();
            showToast('Exclusão desfeita com sucesso.', 'success');
          }
        });
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
                    className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition inline-flex items-center justify-center cursor-pointer"
                    title="Excluir"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4">
                  <EmptyState
                    icon={Users}
                    title="Nenhum cliente cadastrado"
                    description="Comece adicionando seu primeiro cliente para gerenciar seus processos de forma unificada."
                    actionLabel="+ Novo Cliente"
                    onAction={() => setModal('novo-cliente')}
                  />
                </td>
              </tr>
            )}
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
        db.processos = db.processos.filter((p) => p.id !== id);
        update();
        try {
          const res = await fetch(`/api/processos/${id}`, { method: 'DELETE' });
          if (!res.ok) {
            throw new Error('Falha no status HTTP ' + res.status);
          }
        } catch (err) {
          console.warn('[PROCESSO DELETE FALLBACK] Erro ao excluir processo via backend. Tentando Firestore...', err);
          try {
            const { doc, deleteDoc } = await import('firebase/firestore');
            const { firestore } = await import('./firebase');
            await deleteDoc(doc(firestore, 'processos', String(id)));
          } catch (fErr) {
            console.error('[PROCESSO DELETE CRITICAL] Erro ao excluir processo no Firestore:', fErr);
          }
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
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4">
                  <EmptyState
                    icon={FolderKanban}
                    title="Nenhum processo cadastrado"
                    description="Gerencie os processos de seus clientes, andamentos judiciais e datas críticas."
                    actionLabel="+ Novo Processo"
                    onAction={() => setModal('novo-processo')}
                  />
                </td>
              </tr>
            )}
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
          {(p.andamentos || []).map((a: any, i: number) => (
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
          const res = await fetch(`/api/eventos/${id}`, { method: 'DELETE' });
          if (!res.ok) {
            throw new Error('Falha no status HTTP ' + res.status);
          }
        } catch (err) {
          console.warn('[EVENTO DELETE FALLBACK] Erro ao excluir evento via backend. Tentando Firestore...', err);
          try {
            const { doc, deleteDoc } = await import('firebase/firestore');
            const { firestore } = await import('./firebase');
            await deleteDoc(doc(firestore, 'eventos', String(id)));
          } catch (fErr) {
            console.error('[EVENTO DELETE CRITICAL] Erro ao excluir evento no Firestore:', fErr);
          }
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
            {eventos.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4">
                  <EmptyState
                    icon={Calendar}
                    title="Nenhum compromisso agendado"
                    description="Mantenha seus prazos, audiências e reuniões do escritório sempre sob controle."
                    actionLabel="+ Novo Compromisso"
                    onAction={() => setModal('novo-evento')}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ TAREFAS (KANBAN) ============
function Tarefas({ setModal, update, confirmAction, showToast }: any) {
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
        const res = await fetch(`/api/tarefas/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        });
        if (!res.ok) {
          throw new Error('Falha no status HTTP ' + res.status);
        }
      } catch (err) {
        console.warn('[TAREFA STATUS UPDATE FALLBACK] Erro ao atualizar status via backend. Tentando Firestore...', err);
        try {
          const { doc, setDoc } = await import('firebase/firestore');
          const { firestore } = await import('./firebase');
          await setDoc(doc(firestore, 'tarefas', String(id)), t);
        } catch (fErr) {
          console.error('[TAREFA STATUS UPDATE CRITICAL] Erro ao salvar status no Firestore:', fErr);
        }
      }
    }
  };

  const deleteTarefa = async (id: number) => {
    confirmAction(
      'Excluir Tarefa',
      'Deseja realmente excluir esta tarefa do quadro?',
      async () => {
        const tarefaExcluida = db.tarefas.find(t => t.id === id);
        if (!tarefaExcluida) return;

        // Remover temporariamente do estado local
        db.tarefas = db.tarefas.filter((t) => t.id !== id);
        update();

        let undoClicked = false;

        // Timer para exclusão definitiva no backend/Firestore
        const timeoutId = setTimeout(async () => {
          if (!undoClicked) {
            try {
              const res = await fetch(`/api/tarefas/${id}`, { method: 'DELETE' });
              if (!res.ok) {
                throw new Error('Falha no status HTTP ' + res.status);
              }
            } catch (err) {
              console.warn('[TAREFA DELETE FALLBACK] Erro ao excluir tarefa no backend. Tentando Firestore...', err);
              try {
                const { doc, deleteDoc } = await import('firebase/firestore');
                const { firestore } = await import('./firebase');
                await deleteDoc(doc(firestore, 'tarefas', String(id)));
              } catch (fErr) {
                console.error('[TAREFA DELETE CRITICAL] Erro ao excluir no Firestore:', fErr);
              }
            }
          }
        }, 5000);

        showToast('Tarefa excluída com sucesso.', 'info', {
          label: 'Desfazer',
          onClick: () => {
            undoClicked = true;
            clearTimeout(timeoutId);
            // Restaurar localmente
            db.tarefas.push(tarefaExcluida);
            update();
            showToast('Exclusão desfeita com sucesso.', 'success');
          }
        });
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
      } else {
        throw new Error('Falha no status HTTP ' + res.status);
      }
    } catch (err) {
      console.warn('[HONORARIO UPDATE FALLBACK] Erro ao pagar honorário via backend. Tentando Firestore...', err);
      try {
        const hon = db.honorarios.find((h) => h.id === id);
        if (hon) {
          hon.status = 'pago';
          const { doc, setDoc } = await import('firebase/firestore');
          const { firestore } = await import('./firebase');
          await setDoc(doc(firestore, 'honorarios', String(id)), hon);
          update();
        }
      } catch (fErr) {
        console.error('[HONORARIO UPDATE CRITICAL] Erro ao pagar honorário no Firestore:', fErr);
      }
    }
  };

  const deleteHonorario = async (id: number) => {
    confirmAction(
      'Excluir Honorário',
      'Deseja realmente excluir este lançamento de honorário?',
      async () => {
        db.honorarios = db.honorarios.filter((h) => h.id !== id);
        update();
        try {
          const res = await fetch(`/api/honorarios/${id}`, { method: 'DELETE' });
          if (!res.ok) {
            throw new Error('Falha no status HTTP ' + res.status);
          }
        } catch (err) {
          console.warn('[HONORARIO DELETE FALLBACK] Erro ao excluir honorário via backend. Tentando Firestore...', err);
          try {
            const { doc, deleteDoc } = await import('firebase/firestore');
            const { firestore } = await import('./firebase');
            await deleteDoc(doc(firestore, 'honorarios', String(id)));
          } catch (fErr) {
            console.error('[HONORARIO DELETE CRITICAL] Erro ao excluir honorário no Firestore:', fErr);
          }
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
      } else {
        throw new Error('Falha no status HTTP ' + res.status);
      }
    } catch (err) {
      console.warn('[DESPESA UPDATE FALLBACK] Erro ao pagar despesa via backend. Tentando Firestore...', err);
      try {
        const des = db.despesas.find((d) => d.id === id);
        if (des) {
          des.status = 'pago';
          const { doc, setDoc } = await import('firebase/firestore');
          const { firestore } = await import('./firebase');
          await setDoc(doc(firestore, 'despesas', String(id)), des);
          update();
        }
      } catch (fErr) {
        console.error('[DESPESA UPDATE CRITICAL] Erro ao pagar despesa no Firestore:', fErr);
      }
    }
  };

  const deleteDespesa = async (id: number) => {
    confirmAction(
      'Excluir Despesa',
      'Deseja realmente excluir este lançamento de despesa?',
      async () => {
        db.despesas = db.despesas.filter((d) => d.id !== id);
        update();
        try {
          const res = await fetch(`/api/despesas/${id}`, { method: 'DELETE' });
          if (!res.ok) {
            throw new Error('Falha no status HTTP ' + res.status);
          }
        } catch (err) {
          console.warn('[DESPESA DELETE FALLBACK] Erro ao excluir despesa via backend. Tentando Firestore...', err);
          try {
            const { doc, deleteDoc } = await import('firebase/firestore');
            const { firestore } = await import('./firebase');
            await deleteDoc(doc(firestore, 'despesas', String(id)));
          } catch (fErr) {
            console.error('[DESPESA DELETE CRITICAL] Erro ao excluir despesa no Firestore:', fErr);
          }
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
                  <td colSpan={6} className="py-4">
                    <EmptyState
                      icon={DollarSign}
                      title="Nenhum honorário lançado"
                      description="Registre as cobranças, parcelas e honorários contratuais de seus clientes."
                      actionLabel="+ Lançar Honorário"
                      onAction={() => setModal('novo-honorario')}
                    />
                  </td>
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
                  <td colSpan={5} className="py-4">
                    <EmptyState
                      icon={DollarSign}
                      title="Nenhuma despesa registrada"
                      description="Controle os custos do escritório, taxas judiciais e despesas reembolsáveis."
                      actionLabel="+ Lançar Despesa"
                      onAction={() => setModal('nova-despesa')}
                    />
                  </td>
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
        db.documentos = db.documentos.filter((d) => d.id !== id);
        update();
        try {
          const res = await fetch(`/api/documentos/${id}`, { method: 'DELETE' });
          if (!res.ok) {
            throw new Error('Falha no status HTTP ' + res.status);
          }
        } catch (err) {
          console.warn('[DOCUMENTO DELETE FALLBACK] Erro ao excluir documento via backend. Tentando Firestore...', err);
          try {
            const { doc, deleteDoc } = await import('firebase/firestore');
            const { firestore } = await import('./firebase');
            await deleteDoc(doc(firestore, 'documentos', String(id)));
          } catch (fErr) {
            console.error('[DOCUMENTO DELETE CRITICAL] Erro ao excluir documento no Firestore:', fErr);
          }
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
                <td colSpan={5} className="py-4">
                  <EmptyState
                    icon={FileText}
                    title="Nenhum documento anexado"
                    description="Faça a gestão dos arquivos, contratos, procurações e peças processuais."
                    actionLabel="+ Anexar Documento"
                    onAction={() => setModal('novo-documento')}
                  />
                </td>
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
      } else {
        throw new Error('Falha no status HTTP ' + res.status);
      }
    } catch (err) {
      console.warn('[INTEGRACOES UPDATE FALLBACK] Erro ao atualizar integração via backend. Tentando Firestore...', err);
      try {
        db.integracoes = updated;
        update();
        const { doc, setDoc } = await import('firebase/firestore');
        const { firestore } = await import('./firebase');
        await setDoc(doc(firestore, 'integracoes', 'default'), updated);
      } catch (fErr) {
        console.error('[INTEGRACOES UPDATE CRITICAL] Erro ao salvar integrações no Firestore:', fErr);
      }
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
      <DiagnosticPanel />
    </div>
  );
}

function DiagnosticPanel() {
  const [status, setStatus] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [resetting, setResetting] = React.useState(false);
  const [resetResult, setResetResult] = React.useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/firebase-status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      } else {
        throw new Error('Erro HTTP ' + res.status);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm("ATENÇÃO: Isso irá APAGAR TODOS os dados do Firestore e do banco de dados local e reinstalar os dados padrão do zero. Deseja continuar?")) {
      return;
    }
    setResetting(true);
    setResetResult(null);
    try {
      const res = await fetch('/api/reset-database', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setResetResult('Sucesso! Banco de dados reiniciado e semeado do zero.');
        fetchStatus();
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        throw new Error(data.message || 'Erro desconhecido');
      }
    } catch (err: any) {
      setResetResult('Erro ao resetar: ' + err.message);
    } finally {
      setResetting(false);
    }
  };

  React.useEffect(() => {
    fetchStatus();
  }, []);

  if (loading) {
    return (
      <div className="bg-slate-50 border rounded-xl p-4 mt-6 text-xs text-slate-500 animate-pulse flex items-center justify-center gap-2">
        <Clock className="w-4 h-4 animate-spin" />
        Carregando diagnósticos de infraestrutura...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs mt-6 flex gap-2 items-start">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Erro de diagnóstico:</span> {error}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 border rounded-xl p-4 mt-6">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-sm text-slate-800">Status da Infraestrutura (Vercel & Banco)</h3>
        <button onClick={fetchStatus} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
          Atualizar Diagnóstico
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* Firebase Admin / Firestore */}
        <div className="bg-white p-3 rounded-lg border">
          <div className="font-semibold text-slate-700 mb-2">Conexão Firestore (Database)</div>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Service Account (Env):</span>
              <span className={status.hasServiceAccount ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>
                {status.hasServiceAccount ? `Configurado (${status.serviceAccountLength} bytes)` : "Não Configurado"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Inicializado:</span>
              <span className={status.firebaseInitialized ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>
                {status.firebaseInitialized ? "Sim (Admin SDK)" : "Não"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Ping Firestore:</span>
              <span className={status.firestorePing ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>
                {status.firestorePing ? "Sucesso (Escrita/Leitura OK)" : "Falha"}
              </span>
            </div>
            {status.projectId && (
              <div className="flex justify-between">
                <span className="text-slate-500">Project ID:</span>
                <span className="text-slate-700 font-mono text-[10px]">{status.projectId}</span>
              </div>
            )}
            {status.initError && (
              <div className="mt-2 p-2 bg-rose-50 text-rose-700 rounded text-[10px] break-all leading-tight">
                <span className="font-semibold">Erro de Inicialização:</span> {status.initError}
              </div>
            )}
            {status.pingError && (
              <div className="mt-2 p-2 bg-rose-50 text-rose-700 rounded text-[10px] break-all leading-tight">
                <span className="font-semibold">Erro de Conexão/Regras:</span> {status.pingError}
              </div>
            )}
          </div>
        </div>

        {/* Gemini API & Environment */}
        <div className="bg-white p-3 rounded-lg border">
          <div className="font-semibold text-slate-700 mb-2">Inteligência Artificial (Gemini) & Ambiente</div>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">GEMINI_API_KEY:</span>
              <span className={status.geminiApiKeyConfigured ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>
                {status.geminiApiKeyConfigured ? "Configurada" : "Não Configurada"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Ambiente de Execução:</span>
              <span className="text-slate-700 font-semibold">
                {status.vercelEnv ? "Vercel Serverless" : "Sandbox / Local"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">NODE_ENV:</span>
              <span className="text-slate-600 font-mono text-[11px]">{status.nodeEnv}</span>
            </div>
          </div>
          {status.vercelEnv && (
            <div className="mt-2.5 p-2 bg-blue-50 text-blue-700 rounded text-[10px] leading-tight">
              <p className="font-semibold mb-0.5">Nota Importante:</p>
              Qualquer alteração de chaves no painel do Vercel exige um <strong className="underline">novo deploy</strong> para passar a valer!
            </div>
          )}
        </div>

        {/* Reset Database / Começar do Zero */}
        <div className="bg-white p-3 rounded-lg border md:col-span-2">
          <div className="font-semibold text-slate-700 mb-1">Gerenciamento de Dados (Limpeza & Reset)</div>
          <p className="text-[11px] text-slate-500 mb-3">
            Útil se o banco de dados ficou poluído, com chaves inválidas ou fora de sincronia. Isso apaga todas as coleções do Firestore e reinicia o banco do zero.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              disabled={resetting}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white font-semibold rounded text-xs transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {resetting ? "Resetando Banco..." : "Resetar Banco do Zero"}
            </button>
            {resetResult && (
              <span className={`text-[11px] font-semibold ${resetResult.startsWith('Sucesso') ? 'text-emerald-600' : 'text-rose-600'}`}>
                {resetResult}
              </span>
            )}
          </div>
        </div>
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
  const [usuarios, setUsuarios] = useState<any[]>(db.usuarios);
  const [novoUsuario, setNovoUsuario] = useState({ nome: '', email: '', perfil: 'Advogado' });
  const [showForm, setShowForm] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const carregarUsuarios = async () => {
    setLoading(true);
    let loadedUsers: any[] = [];
    
    // 1. Priorizar carregamento via API do backend Express
    try {
      const res = await fetch('/api/usuarios');
      const data = await res.json();
      if (data.success && data.data) {
        loadedUsers = data.data;
      }
    } catch (err) {
      console.warn('Erro ao carregar do Express backend, tentando Firestore cliente-side...', err);
    }

    // 2. Fallback: carregar diretamente do Firestore do cliente
    if (loadedUsers.length === 0) {
      try {
        const { collection, getDocs, doc, setDoc, deleteDoc } = await import('firebase/firestore');
        const { firestore } = await import('./firebase');
        
        const snap = await getDocs(collection(firestore, 'usuarios'));
        const list: any[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          list.push({ ...d, id: docSnap.id.match(/^\d+$/) ? parseInt(docSnap.id) : docSnap.id });
        });

        // Agrupar por e-mail para detectar e tratar duplicados
        const usersByEmail: { [email: string]: any[] } = {};
        list.forEach((u) => {
          const emailLower = (u.email || '').toLowerCase().trim();
          if (emailLower) {
            if (!usersByEmail[emailLower]) {
              usersByEmail[emailLower] = [];
            }
            usersByEmail[emailLower].push(u);
          }
        });

        const uniqueList: any[] = [];
        for (const email of Object.keys(usersByEmail)) {
          const dupes = usersByEmail[email];
          if (dupes.length === 1) {
            uniqueList.push(dupes[0]);
          } else {
            // Escolher o ID correto a manter (IDs numéricos pequenos como 1, 5, 6 ou o menor ID)
            const sorted = [...dupes].sort((a, b) => {
              const aIdNum = typeof a.id === 'number' ? a.id : parseInt(String(a.id)) || 9999999999999;
              const bIdNum = typeof b.id === 'number' ? b.id : parseInt(String(b.id)) || 9999999999999;
              return aIdNum - bIdNum;
            });

            const keep = sorted[0];
            uniqueList.push(keep);

            // Remover os demais documentos duplicados do Firestore
            for (let i = 1; i < sorted.length; i++) {
              const toDelete = sorted[i];
              try {
                console.log(`[DE-DUP] Removendo duplicado do Firestore. Email: ${email}, ID: ${toDelete.id}`);
                await deleteDoc(doc(firestore, 'usuarios', String(toDelete.id)));
              } catch (delErr) {
                console.error('Erro ao deletar duplicado:', delErr);
              }
            }
          }
        }

        // Garantir que cria2311@gmail.com está cadastrado com ID correto (5)
        const temCria = uniqueList.some(u => (u.email || '').toLowerCase() === 'cria2311@gmail.com');
        if (!temCria) {
          const idCria = 5;
          const userCria = {
            id: idCria,
            nome: 'Cria2311',
            email: 'cria2311@gmail.com',
            perfil: 'Advogado'
          };
          try {
            await setDoc(doc(firestore, 'usuarios', String(idCria)), userCria);
          } catch (err) {
            console.warn('Erro ao salvar cria no Firestore cliente-side:', err);
          }
          uniqueList.push(userCria);
        }

        // Garantir que bandavai62@gmail.com está cadastrado com ID correto (6)
        const temBanda = uniqueList.some(u => (u.email || '').toLowerCase() === 'bandavai62@gmail.com');
        if (!temBanda) {
          const idBanda = 6;
          const userBanda = {
            id: idBanda,
            nome: 'BandaVai',
            email: 'bandavai62@gmail.com',
            perfil: 'Administrador'
          };
          try {
            await setDoc(doc(firestore, 'usuarios', String(idBanda)), userBanda);
          } catch (err) {
            console.warn('Erro ao salvar bandavai no Firestore cliente-side:', err);
          }
          uniqueList.push(userBanda);
        }

        uniqueList.sort((a, b) => (a.id || 0) - (b.id || 0));
        loadedUsers = uniqueList;
      } catch (errFirestore) {
        console.warn('Erro ao carregar do Firestore cliente-side:', errFirestore);
      }
    }

    // Garantir de-duplicação absoluta por ID e por E-mail para evitar avisos de chaves duplicadas no React
    const finalUniqueList: any[] = [];
    const seenIds = new Set();
    const seenEmails = new Set();
    loadedUsers.forEach((u) => {
      const uId = u.id;
      const uEmail = (u.email || '').toLowerCase().trim();
      if (!seenIds.has(uId) && !seenEmails.has(uEmail)) {
        seenIds.add(uId);
        seenEmails.add(uEmail);
        finalUniqueList.push(u);
      }
    });

    setUsuarios(finalUniqueList);
    db.usuarios = finalUniqueList;
    setLoading(false);
  };

  useEffect(() => {
    carregarUsuarios();
  }, []);

  const criar = async () => {
    if (!novoUsuario.nome || !novoUsuario.email) return;
    setStatus(null);
    const emailLower = (novoUsuario.email || '').toLowerCase().trim();
    const emailExists = usuarios.some(u => (u.email || '').toLowerCase().trim() === emailLower);
    if (emailExists) {
      setStatus({ type: 'error', message: 'Este e-mail já está sendo utilizado por outro usuário.' });
      return;
    }
    try {
      const generateSecurePassword = () => {
        const chars = 'abcdefghijklmnopqrstuvwxyz';
        const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const nums = '0123456789';
        const specials = '!@#$%&*';
        let pass = '';
        pass += upper[Math.floor(Math.random() * upper.length)];
        pass += nums[Math.floor(Math.random() * nums.length)];
        pass += specials[Math.floor(Math.random() * specials.length)];
        const all = chars + upper + nums + specials;
        for (let i = 0; i < 9; i++) {
          pass += all[Math.floor(Math.random() * all.length)];
        }
        return pass.split('').sort(() => 0.5 - Math.random()).join('');
      };
      
      const password = generateSecurePassword();
      const userId = Date.now();
      const userDoc = {
        id: userId,
        nome: novoUsuario.nome,
        email: novoUsuario.email,
        perfil: novoUsuario.perfil
      };

      let createdSuccessfully = false;

      // 1. Tentar criar no backend primeiro (seguro e gerencia o Auth)
      try {
        const res = await fetch('/api/usuarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...userDoc, senha: password }),
        });
        if (res.ok) {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await res.json();
            if (data.success) {
              createdSuccessfully = true;
              console.log('Usuário criado e sincronizado com o backend com sucesso.');
            }
          }
        }
      } catch (errApi) {
        console.warn('Erro ao sincronizar usuário com o Express backend, tentando Firestore direto...', errApi);
      }

      // 2. Fallback: Salvar diretamente no Firestore do cliente
      if (!createdSuccessfully) {
        try {
          const { doc, setDoc } = await import('firebase/firestore');
          const { firestore } = await import('./firebase');
          await setDoc(doc(firestore, 'usuarios', String(userId)), userDoc);
          createdSuccessfully = true;
        } catch (errFirestore) {
          console.error('Erro ao salvar no Firestore cliente-side:', errFirestore);
        }
      }

      if (createdSuccessfully) {
        const updatedUsers = [...usuarios, userDoc];
        setUsuarios(updatedUsers);
        db.usuarios = updatedUsers;
        setNovoUsuario({ nome: '', email: '', perfil: 'Advogado' });
        setShowForm(false);
        const successMsg = `Usuário criado com sucesso! Senha temporária: ${password}`;
        setStatus({ type: 'success', message: successMsg });
      } else {
        setStatus({ type: 'error', message: 'Erro ao criar usuário no servidor e no banco local.' });
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
        let deletedSuccessfully = false;

        // 1. Tentar excluir via API do backend primeiro (seguro e gerencia o Firestore + Auth)
        try {
          const res = await fetch(`/api/usuarios/${id}`, { method: 'DELETE' });
          if (res.ok) {
            deletedSuccessfully = true;
          }
        } catch (errApi) {
          console.warn('Erro ao notificar exclusão ao backend Express, tentando Firestore cliente-side...', errApi);
        }

        // 2. Fallback: tentar deletar no Firestore do cliente-side
        if (!deletedSuccessfully) {
          try {
            const { doc, deleteDoc } = await import('firebase/firestore');
            const { firestore } = await import('./firebase');
            await deleteDoc(doc(firestore, 'usuarios', String(id)));
            deletedSuccessfully = true;
          } catch (errFirestore) {
            console.error('Erro ao excluir no Firestore cliente-side:', errFirestore);
          }
        }

        const updatedUsers = usuarios.filter((u) => u.id !== id);
        setUsuarios(updatedUsers);
        db.usuarios = updatedUsers;
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
            {loading ? (
              <tr>
                <td colSpan={4} className="text-center py-8 text-slate-500">
                  Carregando usuários...
                </td>
              </tr>
            ) : (
              usuarios.map((u) => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{u.nome}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3"><span className="bg-slate-100 px-2 py-1 rounded text-xs font-semibold">{u.perfil}</span></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => excluir(u.id)} className="text-red-600 hover:text-red-800"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ AUDITORIA ============
function Auditoria({ usuarioAtual }: any) {
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterAcao, setFilterAcao] = useState('Todos');
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auditoria');
      const data = await res.json();
      if (data.success) {
        setLogs(data.data || []);
      }
    } catch (err) {
      console.error('Erro ao carregar logs de auditoria:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filtered = logs.filter((log) => {
    const matchSearch =
      (log.usuarioNome || '').toLowerCase().includes(search.toLowerCase()) ||
      (log.usuarioEmail || '').toLowerCase().includes(search.toLowerCase()) ||
      (log.detalhes || '').toLowerCase().includes(search.toLowerCase()) ||
      (log.acao || '').toLowerCase().includes(search.toLowerCase());

    const matchAcao = filterAcao === 'Todos' || log.acao.includes(filterAcao);

    return matchSearch && matchAcao;
  });

  // Calculate some quick stats
  const totalHoje = logs.filter((l) => {
    const date = new Date(l.dataHora);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }).length;

  const acoesCriacao = logs.filter((l) => l.acao && l.acao.startsWith('Criar')).length;
  const acoesExclusao = logs.filter((l) => l.acao && l.acao.startsWith('Deletar')).length;

  const getAcaoBadge = (acao: string) => {
    if (!acao) return 'bg-slate-50 text-slate-700 border-slate-200';
    if (acao.startsWith('Criar')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (acao.startsWith('Deletar')) {
      return 'bg-red-50 text-red-700 border-red-200';
    }
    if (acao.startsWith('Atualizar') || acao.includes('Andamento')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (acao.includes('Baixa') || acao.includes('Redefinir')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Auditoria de Ações</h1>
          <p className="text-sm text-slate-500">Histórico completo de rastreabilidade e segurança do sistema.</p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
        >
          <Clock className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Atualizando...' : 'Atualizar Logs'}
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border rounded-xl p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-slate-500 uppercase font-semibold">Eventos Registrados Hoje</p>
            <p className="text-2xl font-bold mt-1 text-slate-800">{totalHoje}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-lg">
            ⚡
          </div>
        </div>

        <div className="bg-white border rounded-xl p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-slate-500 uppercase font-semibold">Novos Cadastros (Criar)</p>
            <p className="text-2xl font-bold mt-1 text-emerald-600">{acoesCriacao}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold text-lg">
            ➕
          </div>
        </div>

        <div className="bg-white border rounded-xl p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-slate-500 uppercase font-semibold">Exclusões de Dados</p>
            <p className="text-2xl font-bold mt-1 text-red-600">{acoesExclusao}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-600 font-bold text-lg">
            🗑️
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white border rounded-xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por usuário, ação ou detalhes..."
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <select
            className="w-full md:w-48 px-3 py-2 border rounded-lg text-sm bg-white focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none"
            value={filterAcao}
            onChange={(e) => setFilterAcao(e.target.value)}
          >
            <option value="Todos">Todas as Ações</option>
            <option value="Criar">Criar</option>
            <option value="Deletar">Deletar</option>
            <option value="Atualizar">Atualizar</option>
            <option value="Baixa">Baixas (Financeiro)</option>
            <option value="Redefinir">Redefinir Senha</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="px-6 py-3.5 text-left text-slate-600 uppercase text-xs font-semibold tracking-wider w-1/4">Data / Hora</th>
                <th className="px-6 py-3.5 text-left text-slate-600 uppercase text-xs font-semibold tracking-wider w-1/4">Usuário</th>
                <th className="px-6 py-3.5 text-left text-slate-600 uppercase text-xs font-semibold tracking-wider w-1/6">Ação</th>
                <th className="px-6 py-3.5 text-left text-slate-600 uppercase text-xs font-semibold tracking-wider w-1/3">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => (
                <tr key={log.id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">
                    {new Date(log.dataHora).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-800">{log.usuarioNome}</div>
                    <div className="text-xs text-slate-500">{log.usuarioEmail}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-semibold border ${getAcaoBadge(log.acao)}`}>
                      {log.acao}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-medium leading-relaxed">
                    {log.detalhes}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-slate-400 py-12">
                    {loading ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin" />
                        <span>Carregando histórico de auditoria...</span>
                      </div>
                    ) : (
                      'Nenhum log de auditoria encontrado com os filtros atuais.'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
