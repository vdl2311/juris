/**
 * Validação e máscaras brasileiras - CPF, CNPJ, Telefone, Processo CNJ, Hora
 */

const VALID_DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

export function cleanNonDigits(val: string): string {
  return val.replace(/\D/g, '');
}

export interface ValidationResult {
  isValid: boolean;
  message: string;
}

export function validateCPF(cpf: string): ValidationResult {
  const clean = cleanNonDigits(cpf);
  if (!clean) return { isValid: false, message: 'O CPF não pode estar vazio.' };
  if (clean.length !== 11) return { isValid: false, message: `CPF deve conter 11 dígitos.` };
  if (/^(\d)\1{10}$/.test(clean)) return { isValid: false, message: 'CPF inválido (todos os dígitos são iguais).' };

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(clean.charAt(i)) * (10 - i);
  let rev = (sum * 10) % 11;
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9))) return { isValid: false, message: 'CPF inválido.' };

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(clean.charAt(i)) * (11 - i);
  rev = (sum * 10) % 11;
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(10))) return { isValid: false, message: 'CPF inválido.' };

  return { isValid: true, message: 'CPF válido.' };
}

export function validateCNPJ(cnpj: string): ValidationResult {
  const clean = cleanNonDigits(cnpj);
  if (!clean) return { isValid: false, message: 'O CNPJ não pode estar vazio.' };
  if (clean.length !== 14) return { isValid: false, message: `CNPJ deve conter 14 dígitos.` };
  if (/^(\d)\1{13}$/.test(clean)) return { isValid: false, message: 'CNPJ inválido.' };

  let size = clean.length - 2;
  let numbers = clean.substring(0, size);
  const digits = clean.substring(size);
  let sum = 0, pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return { isValid: false, message: 'CNPJ inválido.' };

  size += 1;
  numbers = clean.substring(0, size);
  sum = 0; pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return { isValid: false, message: 'CNPJ inválido.' };

  return { isValid: true, message: 'CNPJ válido.' };
}

export function validatePhone(phone: string): ValidationResult {
  const clean = cleanNonDigits(phone);
  if (!clean) return { isValid: false, message: 'O telefone não pode estar vazio.' };
  if (clean.length !== 10 && clean.length !== 11) return { isValid: false, message: `Telefone deve ter 10 ou 11 dígitos.` };
  const ddd = parseInt(clean.substring(0, 2));
  if (!VALID_DDDS.has(ddd)) return { isValid: false, message: `DDD (${ddd}) inválido.` };
  if (clean.length === 11 && clean.charAt(2) !== '9') return { isValid: false, message: 'Celular deve começar com 9.' };
  if (/^(\d)\1{9,10}$/.test(clean)) return { isValid: false, message: 'Telefone inválido.' };
  return { isValid: true, message: 'Telefone válido.' };
}

export function validateProcesso(numero: string): ValidationResult {
  const clean = cleanNonDigits(numero);
  if (!clean) return { isValid: false, message: 'Número do processo vazio.' };
  if (clean.length !== 20) return { isValid: false, message: `CNJ deve ter 20 dígitos.` };
  return { isValid: true, message: 'Número válido.' };
}

export function validateTime(time: string): ValidationResult {
  if (!time) return { isValid: false, message: 'Horário vazio.' };
  if (!/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) return { isValid: false, message: 'Use HH:MM.' };
  return { isValid: true, message: 'Horário válido.' };
}

export function maskCPF(value: string): string {
  const c = cleanNonDigits(value).slice(0, 11);
  if (c.length <= 3) return c;
  if (c.length <= 6) return `${c.slice(0, 3)}.${c.slice(3)}`;
  if (c.length <= 9) return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6)}`;
  return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
}

export function maskCNPJ(value: string): string {
  const c = cleanNonDigits(value).slice(0, 14);
  if (c.length <= 2) return c;
  if (c.length <= 5) return `${c.slice(0, 2)}.${c.slice(2)}`;
  if (c.length <= 8) return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5)}`;
  if (c.length <= 12) return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8)}`;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

export function maskPhone(value: string): string {
  const c = cleanNonDigits(value).slice(0, 11);
  if (c.length === 0) return '';
  if (c.length <= 2) return `(${c}`;
  if (c.length <= 6) return `(${c.slice(0, 2)}) ${c.slice(2)}`;
  if (c.length <= 10) return `(${c.slice(0, 2)}) ${c.slice(2, 6)}-${c.slice(6)}`;
  return `(${c.slice(0, 2)}) ${c.slice(2, 7)}-${c.slice(7)}`;
}

export function maskProcesso(value: string): string {
  const c = cleanNonDigits(value).slice(0, 20);
  if (c.length === 0) return '';
  if (c.length <= 7) return c;
  if (c.length <= 9) return `${c.slice(0, 7)}-${c.slice(7)}`;
  if (c.length <= 13) return `${c.slice(0, 7)}-${c.slice(7, 9)}.${c.slice(9)}`;
  if (c.length <= 14) return `${c.slice(0, 7)}-${c.slice(7, 9)}.${c.slice(9, 13)}.${c.slice(13)}`;
  if (c.length <= 16) return `${c.slice(0, 7)}-${c.slice(7, 9)}.${c.slice(9, 13)}.${c.slice(13, 14)}.${c.slice(14)}`;
  return `${c.slice(0, 7)}-${c.slice(7, 9)}.${c.slice(9, 13)}.${c.slice(13, 14)}.${c.slice(14, 16)}.${c.slice(16)}`;
}

export function maskTime(value: string): string {
  const c = cleanNonDigits(value).slice(0, 4);
  if (c.length === 0) return '';
  if (c.length <= 2) return c;
  return `${c.slice(0, 2)}:${c.slice(2)}`;
}
