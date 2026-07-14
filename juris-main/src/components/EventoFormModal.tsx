import React, { useState } from 'react';
import { X } from 'lucide-react';

interface EventoFormModalProps {
  processos: any[];
  onClose: () => void;
  onSuccess: (evento: any) => void;
}

export default function EventoFormModal({ processos, onClose, onSuccess }: EventoFormModalProps) {
  const [tipo, setTipo] = useState('Audiência');
  const [processoId, setProcessoId] = useState('');
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [local, setLocal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !hora) {
      setError('Por favor, preencha data e hora.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          processoId: processoId ? parseInt(processoId) : null,
          data,
          hora,
          local,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        onSuccess(json.data);
      } else {
        setError(json.message || 'Erro ao salvar evento.');
      }
    } catch (err: any) {
      console.warn('[EVENTO FALLBACK] Erro de conexão com o backend. Salvando diretamente no Firestore...', err);
      try {
        const { doc: fireDoc, setDoc } = await import('firebase/firestore');
        const { firestore } = await import('../firebase');

        const newEvent = {
          id: Date.now(),
          tipo,
          processoId: processoId ? parseInt(processoId) : null,
          data,
          hora,
          local,
        };

        const eventDocRef = fireDoc(firestore, 'eventos', String(newEvent.id));
        await setDoc(eventDocRef, newEvent);

        onSuccess(newEvent);
      } catch (firestoreErr: any) {
        console.error('[EVENTO FALLBACK CRÍTICO] Erro ao salvar diretamente no Firestore:', firestoreErr);
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
          <h2 className="font-semibold text-slate-800">Novo Compromisso / Evento</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <p className="text-red-600 text-xs font-semibold">{error}</p>}
          
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800"
            >
              <option value="Audiência">Audiência</option>
              <option value="Prazo">Prazo</option>
              <option value="Reunião">Reunião</option>
              <option value="Outro">Outro</option>
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
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Data</label>
              <input
                type="date"
                required
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Hora</label>
              <input
                type="time"
                required
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="w-full border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Local / Link</label>
            <input
              type="text"
              placeholder="Ex: Sala 402 ou Zoom link"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              className="w-full border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800"
            />
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
              {loading ? 'Salvando...' : 'Salvar Compromisso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
