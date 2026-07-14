import React, { useState } from 'react';
import { X } from 'lucide-react';

interface DocumentoFormModalProps {
  clientes: any[];
  processos: any[];
  onClose: () => void;
  onSuccess: (documento: any) => void;
}

export default function DocumentoFormModal({ clientes, processos, onClose, onSuccess }: DocumentoFormModalProps) {
  const [nome, setNome] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [processoId, setProcessoId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !clienteId) {
      setError('Nome e Cliente são obrigatórios.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/documentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          clienteId: parseInt(clienteId),
          processoId: processoId ? parseInt(processoId) : null,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        onSuccess(json.data);
      } else {
        setError(json.message || 'Erro ao carregar documento.');
      }
    } catch (err: any) {
      console.warn('[DOCUMENTO FALLBACK] Erro de conexão com o backend. Salvando diretamente no Firestore...', err);
      try {
        const { doc: fireDoc, setDoc } = await import('firebase/firestore');
        const { firestore } = await import('../firebase');

        const newDoc = {
          id: Date.now(),
          nome,
          clienteId: parseInt(clienteId),
          processoId: processoId ? parseInt(processoId) : null,
          data: new Date().toISOString().slice(0, 10),
          assinatura: 'pendente',
          origem: 'upload'
        };

        const docRef = fireDoc(firestore, 'documentos', String(newDoc.id));
        await setDoc(docRef, newDoc);

        onSuccess(newDoc);
      } catch (firestoreErr: any) {
        console.error('[DOCUMENTO FALLBACK CRÍTICO] Erro ao salvar diretamente no Firestore:', firestoreErr);
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
          <h2 className="font-semibold text-slate-800">Novo Documento (Upload Manual)</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <p className="text-red-600 text-xs font-semibold">{error}</p>}

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Nome do Arquivo / Documento</label>
            <input
              type="text"
              required
              placeholder="Ex: Procuração Assinada - José.pdf"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Cliente Vinculado</label>
            <select
              required
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="w-full border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800"
            >
              <option value="">Selecione o cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
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
              {loading ? 'Adicionando...' : 'Adicionar Documento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
