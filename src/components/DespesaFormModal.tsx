import React, { useState } from 'react';
import { X } from 'lucide-react';

interface DespesaFormModalProps {
  onClose: () => void;
  onSuccess: (despesa: any) => void;
}

export default function DespesaFormModal({ onClose, onSuccess }: DespesaFormModalProps) {
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao || !valor || !vencimento) {
      setError('Descrição, Valor e Vencimento são obrigatórios.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/despesas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descricao,
          valor: parseFloat(valor),
          vencimento,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        onSuccess(json.data);
      } else {
        setError(json.message || 'Erro ao criar despesa.');
      }
    } catch (err) {
      setError('Erro de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex justify-between items-center px-5 py-4 border-b">
          <h2 className="font-semibold text-slate-800">Novo Lançamento de Despesa</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <p className="text-red-600 text-xs font-semibold">{error}</p>}

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Descrição / Finalidade</label>
            <input
              type="text"
              required
              placeholder="Ex: Custas Judiciais da 3ª Vara Cível"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="Ex: 245.50"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="w-full border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Data de Vencimento</label>
              <input
                type="date"
                required
                value={vencimento}
                onChange={(e) => setVencimento(e.target.value)}
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
              {loading ? 'Salvando...' : 'Lançar Despesa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
