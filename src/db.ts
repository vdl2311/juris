// Banco de dados em memória (em produção, conectar ao Firebase Firestore)

export const db = {
  usuarios: [
    { id: 1, nome: 'Administrador', email: 'vidal2311usa@gmail.com', perfil: 'Administrador' }
  ],
  clientes: [
    { id: 1, tipo: 'PF' as const, nome: 'João Pedro Almeida', doc: '123.456.789-00', contato: '(31) 99888-1122', email: 'joao@email.com', endereco: 'Ipatinga - MG' },
    { id: 2, tipo: 'PJ' as const, nome: 'Metalúrgica Vale Ltda', doc: '12.345.678/0001-90', contato: '(31) 3333-4455', email: 'contato@vale.com.br', endereco: 'Coronel Fabriciano - MG' },
    { id: 3, tipo: 'PF' as const, nome: 'Marta Oliveira Costa', doc: '987.654.321-00', contato: '(31) 98877-6655', email: 'marta@email.com', endereco: 'Timóteo - MG' },
  ],
  processos: [
    { id: 1, numero: '0001234-56.2025.8.13.0313', tribunal: 'TJMG', vara: '2ª Vara Cível', classe: 'Ação de Cobrança', assunto: 'Inadimplência contratual', clienteId: 1, advogadoId: 2, status: 'ativo' as const, valorCausa: 18500, andamentos: [{ data: '2026-06-10', desc: 'Petição inicial protocolada' }, { data: '2026-06-25', desc: 'Citação da parte ré' }] },
    { id: 2, numero: '0007788-12.2024.8.13.0313', tribunal: 'TJMG', vara: '1ª Vara do Trabalho', classe: 'Reclamação Trabalhista', assunto: 'Horas extras', clienteId: 2, advogadoId: 2, status: 'ativo' as const, valorCausa: 42000, andamentos: [{ data: '2026-05-02', desc: 'Audiência realizada' }, { data: '2026-06-30', desc: 'Aguardando sentença' }] },
    { id: 3, numero: '0003321-77.2023.8.13.0313', tribunal: 'TJMG', vara: '3ª Vara Cível', classe: 'Divórcio', assunto: 'Divórcio consensual', clienteId: 3, advogadoId: 2, status: 'encerrado' as const, valorCausa: 0, andamentos: [{ data: '2026-01-15', desc: 'Sentença homologatória' }] },
  ],
  eventos: [
    { id: 1, tipo: 'Audiência' as const, processoId: 2, data: addDays(2), hora: '14:00', local: 'Fórum de Timóteo - Sala 3' },
    { id: 2, tipo: 'Prazo' as const, processoId: 1, data: addDays(1), hora: '23:59', local: 'Contestação' },
    { id: 3, tipo: 'Reunião' as const, processoId: 1, data: addDays(5), hora: '10:00', local: 'Escritório' },
  ],
  tarefas: [
    { id: 1, titulo: 'Elaborar contestação', responsavelId: 2, processoId: 1, prioridade: 'alta' as const, status: 'pendente' as const, prazo: addDays(1) },
    { id: 2, titulo: 'Levantar jurisprudência TST', responsavelId: 3, processoId: 2, prioridade: 'media' as const, status: 'andamento' as const, prazo: addDays(4) },
    { id: 3, titulo: 'Organizar documentos', responsavelId: 4, processoId: null, prioridade: 'baixa' as const, status: 'pendente' as const, prazo: addDays(7) },
  ],
  honorarios: [
    { id: 1, processoId: 1, clienteId: 1, valor: 3500, tipo: 'fixo' as const, status: 'pendente' as const, vencimento: addDays(6) },
    { id: 2, processoId: 2, clienteId: 2, valor: 8000, tipo: 'exito' as const, status: 'pago' as const, vencimento: addDays(-10) },
    { id: 3, processoId: 3, clienteId: 3, valor: 1200, tipo: 'fixo' as const, status: 'atrasado' as const, vencimento: addDays(-15) },
  ],
  despesas: [
    { id: 1, descricao: 'Aluguel do escritório', valor: 2800, vencimento: addDays(3), status: 'pendente' as const },
    { id: 2, descricao: 'Custas processuais', valor: 340, vencimento: addDays(-2), status: 'pago' as const },
  ],
  documentos: [
    { id: 1, nome: 'Contrato de honorários - João Pedro.pdf', clienteId: 1, processoId: 1, data: addDays(-20), assinatura: 'assinado', origem: 'upload' },
    { id: 2, nome: 'Procuração - Metalúrgica Vale.pdf', clienteId: 2, processoId: 2, data: addDays(-40), assinatura: 'pendente', origem: 'upload' },
  ],
  integracoes: {
    whatsapp: true, email: true, tribunal: true, ocr: true, assinatura: true,
    ultimoBackup: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    ultimaSincroniaTribunal: new Date(Date.now() - 20 * 3600 * 1000).toISOString(),
  },
  nextId: { cliente: 4, processo: 4, evento: 4, tarefa: 4, honorario: 4, documento: 3, usuario: 5, despesa: 3 },
};

export function addDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function fmtMoney(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function clienteNome(id: number): string {
  const c = db.clientes.find((c) => c.id === id);
  return c ? c.nome : '—';
}

export function usuarioNome(id: number): string {
  const u = db.usuarios.find((u) => u.id === id);
  return u ? u.nome : '—';
}

export function processoLabel(id: number | null): string {
  const p = db.processos.find((p) => p.id === id);
  return p ? p.numero : '—';
}

export function diasRestantes(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000);
}

export async function loadAllDataFromBackend() {
  try {
    const fetchCollection = async (path: string) => {
      const res = await fetch(path);
      const json = await res.json();
      return json.success ? json.data : [];
    };

    const [clientes, processos, eventos, tarefas, honorarios, despesas, documentos, usuarios, integracoesRes] = await Promise.all([
      fetchCollection('/api/clientes'),
      fetchCollection('/api/processos'),
      fetchCollection('/api/eventos'),
      fetchCollection('/api/tarefas'),
      fetchCollection('/api/honorarios'),
      fetchCollection('/api/despesas'),
      fetchCollection('/api/documentos'),
      fetchCollection('/api/usuarios'),
      fetch('/api/integracoes').then(res => res.json()).catch(() => null),
    ]);

    db.clientes = clientes;
    db.processos = processos;
    db.eventos = eventos;
    db.tarefas = tarefas;
    db.honorarios = honorarios;
    db.despesas = despesas;
    db.documentos = documentos;
    db.usuarios = usuarios;
    if (integracoesRes && integracoesRes.success && integracoesRes.data) {
      db.integracoes = integracoesRes.data;
    }
  } catch (err) {
    console.error('Erro ao carregar dados do backend:', err);
  }
}
