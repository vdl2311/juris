export type PerfilUsuario = 'Administrador' | 'Advogado' | 'Estagiário' | 'Secretária';

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
}

export type TipoCliente = 'PF' | 'PJ';

export interface Cliente {
  id: number;
  tipo: TipoCliente;
  nome: string;
  doc: string;
  contato: string;
  email: string;
  endereco: string;
  created_at?: string;
}

export type StatusProcesso = 'ativo' | 'suspenso' | 'encerrado';

export interface Andamento {
  data: string;
  desc: string;
}

export interface Processo {
  id: number;
  numero: string;
  tribunal: string;
  vara: string;
  classe: string;
  assunto: string;
  clienteId: number;
  advogadoId: number;
  status: StatusProcesso;
  valorCausa: number;
  andamentos: Andamento[];
}

export type TipoEvento = 'Audiência' | 'Prazo' | 'Reunião' | 'Lembrete';

export interface Evento {
  id: number;
  tipo: TipoEvento;
  processoId: number | null;
  data: string;
  hora: string;
  local: string;
}

export type PrioridadeTarefa = 'baixa' | 'media' | 'alta';
export type StatusTarefa = 'pendente' | 'andamento' | 'concluida';

export interface Tarefa {
  id: number;
  titulo: string;
  responsavelId: number;
  processoId: number | null;
  prioridade: PrioridadeTarefa;
  status: StatusTarefa;
  prazo: string;
}

export type TipoHonorario = 'fixo' | 'exito' | 'mensal';
export type StatusHonorario = 'pendente' | 'pago' | 'atrasado';

export interface Honorario {
  id: number;
  processoId: number | null;
  clienteId: number;
  valor: number;
  tipo: TipoHonorario;
  status: StatusHonorario;
  vencimento: string;
}

export interface Despesa {
  id: number;
  descricao: string;
  valor: number;
  vencimento: string;
  status: 'pendente' | 'pago';
}

export interface Documento {
  id: number;
  nome: string;
  clienteId: number;
  processoId: number | null;
  data: string;
  assinatura?: string;
  origem?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string>;
}
