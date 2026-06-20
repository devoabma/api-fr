export function generateRecoveryCode(length = 6): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

  let code = ''

  // Gera o código aleatório com base na quantidade desejada
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length)
    code += characters[randomIndex]
  }

  return code
}

export function formattedCodeMac(code: string) {
  return code
    .replace(/(\w{2})(\w{2})(\w{2})(\w{2})(\w{2})(\w{2})/, '$1-$2-$3-$4-$5-$6')
    .trim()
    .toUpperCase()
}
