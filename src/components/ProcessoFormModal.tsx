import React, { useState } from 'react';
import { X } from 'lucide-react';
import { maskProcesso, validateProcesso } from '../utils/validation';
import { Processo } from '../types';

interface ProcessoFormModalProps {
  clientes: any[];
  advogados: any[];
  onClose: () => void;
  onSuccess: (newProcess: Processo) => void;
}

export default function ProcessoFormModal({ clientes, advogados, onClose, onSuccess }: ProcessoFormModalProps) {
  const [form, setForm] = useState({
    numero: '',
    tribunal: 'TJMG',
    vara: '',
    classe: '',
    assunto: '',
    clienteId: '',
    advogadoId: '',
    valorCausa: '',
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.numero || !form.clienteId || !form.advogadoId) {
      setError('Preencha os campos obrigatórios.');
      return;
    }

    const procCheck = validateProcesso(form.numero);
    if (!procCheck.isValid) {
      setError(procCheck.message);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/processos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || 'Erro');
      } else {
        onSuccess(data.data);
      }
    } catch (err: any) {
      console.warn('[PROCESSO FALLBACK] Erro de conexão com o backend. Salvando diretamente no Firestore...', err);
      try {
        const { doc: fireDoc, setDoc } = await import('firebase/firestore');
        const { firestore } = await import('../firebase');

        const newProcess: Processo = {
          id: Date.now(),
          numero: form.numero,
          tribunal: form.tribunal,
          vara: form.vara,
          classe: form.classe,
          assunto: form.assunto,
          clienteId: parseInt(form.clienteId, 10),
          advogadoId: parseInt(form.advogadoId, 10),
          valorCausa: parseFloat(form.valorCausa) || 0,
          status: 'ativo',
          andamentos: []
        };

        const procDocRef = fireDoc(firestore, 'processos', String(newProcess.id));
        await setDoc(procDocRef, newProcess);

        // Registrar auditoria
        try {
          const auditId = Date.now() + 1;
          const auditDocRef = fireDoc(firestore, 'auditoria', String(auditId));
          await setDoc(auditDocRef, {
            id: auditId,
            usuario: 'Sistema (Contingência)',
            acao: 'Criar Processo',
            detalhes: `Criou o processo ${newProcess.numero} (ID: ${newProcess.id}) via conexão direta com o Firestore.`,
            data_hora: new Date().toISOString()
          });
        } catch (auditErr) {}

        onSuccess(newProcess);
      } catch (firestoreErr: any) {
        console.error('[PROCESSO FALLBACK CRÍTICO] Erro ao salvar diretamente no Firestore:', firestoreErr);
        setError('Erro de conexão ao salvar.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 bg-gray-50 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Cadastrar Novo Processo</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{error}</div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 uppercase mb-1">Número CNJ *</label>
            <input
              type="text"
              required
              value={form.numero}
              onChange={(e) => setForm({ ...form, numero: maskProcesso(e.target.value) })}
              placeholder="0000000-00.0000.0.00.0000"
              className={inputClass + ' font-mono'}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 uppercase mb-1">Tribunal</label>
              <input value={form.tribunal} onChange={(e) => setForm({ ...form, tribunal: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 uppercase mb-1">Vara</label>
              <input value={form.vara} onChange={(e) => setForm({ ...form, vara: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 uppercase mb-1">Classe</label>
              <input value={form.classe} onChange={(e) => setForm({ ...form, classe: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 uppercase mb-1">Assunto</label>
              <input value={form.assunto} onChange={(e) => setForm({ ...form, assunto: e.target.value })} className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 uppercase mb-1">Cliente *</label>
            <select value={form.clienteId} onChange={(e) => setForm({ ...form, clienteId: e.target.value })} className={inputClass}>
              <option value="">Selecione...</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 uppercase mb-1">Advogado *</label>
            <select value={form.advogadoId} onChange={(e) => setForm({ ...form, advogadoId: e.target.value })} className={inputClass}>
              <option value="">Selecione...</option>
              {advogados.map((a) => <option key={a.id} value={a.id}>{a.nome} ({a.perfil})</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 uppercase mb-1">Valor da Causa (R$)</label>
            <input type="number" step="0.01" value={form.valorCausa} onChange={(e) => setForm({ ...form, valorCausa: e.target.value })} className={inputClass} />
          </div>
        </form>

        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-50"
          >
            {isSubmitting ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
