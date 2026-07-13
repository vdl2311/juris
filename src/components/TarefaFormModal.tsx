import React, { useState } from 'react';
import { X } from 'lucide-react';

interface TarefaFormModalProps {
  advogados: any[];
  processos: any[];
  onClose: () => void;
  onSuccess: (tarefa: any) => void;
}

export default function TarefaFormModal({ advogados, processos, onClose, onSuccess }: TarefaFormModalProps) {
  const [titulo, setTitulo] = useState('');
  const [responsavelId, setResponsavelId] = useState('');
  const [processoId, setProcessoId] = useState('');
  const [prioridade, setPrioridade] = useState('media');
  const [prazo, setPrazo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo || !responsavelId) {
      setError('Título e Responsável são obrigatórios.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/tarefas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo,
          responsavelId: parseInt(responsavelId),
          processoId: processoId ? parseInt(processoId) : null,
          prioridade,
          prazo,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        onSuccess(json.data);
      } else {
        setError(json.message || 'Erro ao criar tarefa.');
      }
    } catch (err: any) {
      console.warn('[TAREFA FALLBACK] Erro de conexão com o backend. Salvando diretamente no Firestore...', err);
      try {
        const { doc: fireDoc, setDoc } = await import('firebase/firestore');
        const { firestore } = await import('../firebase');

        const newDoc = {
          id: Date.now(),
          titulo,
          responsavelId: parseInt(responsavelId),
          processoId: processoId ? parseInt(processoId) : null,
          prioridade,
          prazo,
          status: 'pendente'
        };

        const docRef = fireDoc(firestore, 'tarefas', String(newDoc.id));
        await setDoc(docRef, newDoc);

        onSuccess(newDoc);
      } catch (firestoreErr: any) {
        console.error('[TAREFA FALLBACK CRÍTICO] Erro ao salvar diretamente no Firestore:', firestoreErr);
        setError('Erro de conexão ao salvar.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex justify-between items-center px-5 py-4 border-b">
          <h2 className="font-semibold text-slate-800">Nova Tarefa (Quadro Kanban)</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <p className="text-red-600 text-xs font-semibold">{error}</p>}

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Título da Tarefa</label>
            <input
              type="text"
              required
              placeholder="Ex: Elaborar réplica de petição inicial"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Responsável</label>
            <select
              required
              value={responsavelId}
              onChange={(e) => setResponsavelId(e.target.value)}
              className="w-full border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800"
            >
              <option value="">Selecione o advogado/responsável</option>
              {advogados.map((a) => (
                <option key={a.id} value={a.id}>{a.nome} · {a.perfil}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Processo Vinculado (Opcional)</label>
            <select
              value={processoId}
              onChange={(e) => setProcessoId(e.target.value)}
              className="w-full border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800"
            >
              <option value="">Nenhum processo</option>
              {processos.map((p) => (
                <option key={p.id} value={p.id}>{p.numero} · {p.classe}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Prioridade</label>
              <select
                value={prioridade}
                onChange={(e) => setPrioridade(e.target.value)}
                className="w-full border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800"
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Prazo / Limite</label>
              <input
                type="date"
                required
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
                className="w-full border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition"
            >
              {loading ? 'Criando...' : 'Criar Tarefa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
