import { z } from 'zod'

export const cpfSchema = z
  .string()
  .trim()
  .transform(cpf => cpf.replace(/[^\d]+/g, '')) // normaliza: mantém só dígitos
  .refine(cpf => {
    if (cpf.length !== 11 || /(\d)\1{10}/.test(cpf)) return false

    const digits = cpf.split('').map(Number)
    const rest = (count: number) =>
      ((digits.slice(0, count - 12).reduce((acc, el, index) => acc + el * (count - index), 0) * 10) % 11) % 10

    return rest(10) === digits[9] && rest(11) === digits[10]
  }, 'CPF inválido.')
