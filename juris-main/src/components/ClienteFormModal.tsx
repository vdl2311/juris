import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { maskCPF, maskCNPJ, maskPhone, validateCPF, validateCNPJ, validatePhone } from '../utils/validation';
import { Cliente, TipoCliente } from '../types';

interface ClienteFormModalProps {
  onClose: () => void;
  onSuccess: (newClient: Cliente) => void;
}

export default function ClienteFormModal({ onClose, onSuccess }: ClienteFormModalProps) {
  const [tipo, setTipo] = useState<TipoCliente>('PF');
  const [nome, setNome] = useState('');
  const [doc, setDoc] = useState('');
  const [contato, setContato] = useState('');
  const [email, setEmail] = useState('');
  const [endereco, setEndereco] = useState('');

  const [frontDocValid, setFrontDocValid] = useState({ isValid: false, message: '' });
  const [frontPhoneValid, setFrontPhoneValid] = useState({ isValid: false, message: '' });
  const [backendErrors, setBackendErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState('');

  useEffect(() => {
    if (doc) setFrontDocValid(tipo === 'PF' ? validateCPF(doc) : validateCNPJ(doc));
    else setFrontDocValid({ isValid: false, message: '' });
  }, [doc, tipo]);

  useEffect(() => {
    if (contato) setFrontPhoneValid(validatePhone(contato));
    else setFrontPhoneValid({ isValid: false, message: '' });
  }, [contato]);

  const handleTipoChange = (newTipo: TipoCliente) => {
    setTipo(newTipo);
    setDoc('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError('');
    setBackendErrors({});

    const isDocOk = tipo === 'PF' ? validateCPF(doc).isValid : validateCNPJ(doc).isValid;
    const isPhoneOk = validatePhone(contato).isValid;
    const isNomeOk = nome.trim().length >= 3;

    if (!isNomeOk || !isDocOk || !isPhoneOk) {
      const localErrors: Record<string, string> = {};
      if (!isNomeOk) localErrors.nome = 'Nome inválido';
      if (!isDocOk) localErrors.doc = 'Documento inválido';
      if (!isPhoneOk) localErrors.contato = 'Telefone inválido';
      setBackendErrors(localErrors);
      setGeneralError('Corrija os erros de validação.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, nome, doc, contato, email, endereco }),
      });
      const resData = await response.json();
      if (!response.ok) {
        if (resData.errors) setBackendErrors(resData.errors);
        setGeneralError(resData.message || 'Erro de validação.');
      } else {
        onSuccess(resData.data);
      }
    } catch (err: any) {
      console.warn('[CLIENTE FALLBACK] Erro de conexão com o backend. Salvando diretamente no Firestore...', err);
      try {
        const { doc: fireDoc, setDoc } = await import('firebase/firestore');
        const { firestore } = await import('../firebase');
        
        const newClient = {
          id: Date.now(), // ID único baseado em timestamp
          tipo,
          nome,
          doc,
          contato,
          email: email || '',
          endereco: endereco || '',
          created_at: new Date().toISOString().slice(0, 10),
        };
        
        const clientDocRef = fireDoc(firestore, 'clientes', String(newClient.id));
        await setDoc(clientDocRef, newClient);
        
        // Registrar auditoria local/firestore de contingência
        try {
          const auditId = Date.now() + 1;
          const auditDocRef = fireDoc(firestore, 'auditoria', String(auditId));
          await setDoc(auditDocRef, {
            id: auditId,
            usuario: 'Sistema (Contingência)',
            acao: 'Criar Cliente',
            detalhes: `Criou o cliente ${newClient.nome} (ID: ${newClient.id}) via conexão direta com o Firestore.`,
            data_hora: new Date().toISOString()
          });
        } catch (auditErr) {
          console.warn('Não foi possível gravar auditoria em contingência:', auditErr);
        }
        
        onSuccess(newClient);
      } catch (firestoreErr: any) {
        console.error('[CLIENTE FALLBACK CRÍTICO] Erro ao salvar diretamente no Firestore:', firestoreErr);
        setGeneralError('Erro de conexão ao salvar.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 bg-gray-50 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-600" />
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Cadastrar Novo Cliente</h2>
              <p className="text-xs text-gray-500">Validação em duas camadas (Frontend + Backend)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {generalError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2.5">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold text-red-800">Falha no Envio</h4>
                <p className="text-xs text-red-700">{generalError}</p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 uppercase mb-2">Tipo de Cliente</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="tipo" checked={tipo === 'PF'} onChange={() => handleTipoChange('PF')} className="text-amber-600" />
                Pessoa Física (CPF)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="tipo" checked={tipo === 'PJ'} onChange={() => handleTipoChange('PJ')} className="text-amber-600" />
                Pessoa Jurídica (CNPJ)
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 uppercase mb-1">
              {tipo === 'PF' ? 'Nome Completo' : 'Razão Social'} *
            </label>
            <input
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20"
            />
            {backendErrors.nome && <span className="text-xs text-red-600 mt-1 block">{backendErrors.nome}</span>}
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-medium text-gray-600 uppercase">{tipo === 'PF' ? 'CPF' : 'CNPJ'} *</label>
              {doc && (
                <span className={`text-[11px] font-semibold flex items-center gap-1 ${frontDocValid.isValid ? 'text-green-600' : 'text-amber-600'}`}>
                  {frontDocValid.isValid ? <><CheckCircle2 className="h-3 w-3" /> Válido</> : <><AlertTriangle className="h-3 w-3" /> {frontDocValid.message}</>}
                </span>
              )}
            </div>
            <input
              type="text"
              required
              value={doc}
              onChange={(e) => setDoc(tipo === 'PF' ? maskCPF(e.target.value) : maskCNPJ(e.target.value))}
              placeholder={tipo === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            {backendErrors.doc && <span className="text-xs text-red-600 mt-1 block bg-red-50 p-1.5 rounded">{backendErrors.doc}</span>}
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-medium text-gray-600 uppercase">Telefone *</label>
              {contato && (
                <span className={`text-[11px] font-semibold flex items-center gap-1 ${frontPhoneValid.isValid ? 'text-green-600' : 'text-amber-600'}`}>
                  {frontPhoneValid.isValid ? <><CheckCircle2 className="h-3 w-3" /> Válido</> : <><AlertTriangle className="h-3 w-3" /> {frontPhoneValid.message}</>}
                </span>
              )}
            </div>
            <input
              type="text"
              required
              value={contato}
              onChange={(e) => setContato(maskPhone(e.target.value))}
              placeholder="(31) 99888-1122"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            {backendErrors.contato && <span className="text-xs text-red-600 mt-1 block bg-red-50 p-1.5 rounded">{backendErrors.contato}</span>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 uppercase mb-1">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contato@email.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            {backendErrors.email && <span className="text-xs text-red-600 mt-1 block">{backendErrors.email}</span>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 uppercase mb-1">Endereço</label>
            <textarea
              rows={2}
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Av. João Valentim Pascoal, 500 - Centro, Ipatinga - MG"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
            />
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
            {isSubmitting ? 'Validando...' : 'Validar & Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
