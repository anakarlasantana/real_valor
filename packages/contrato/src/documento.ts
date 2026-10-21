/** Um veredito para checkout, pedido e etiqueta. */

/** O `type` do destinatário no SuperFrete. */
export type TipoDocumento = "CPF" | "CNPJ"

/** Sem máscara. */
export type Documento = {
  tipo: TipoDocumento
  numero: string
}

/** `valido: false` traz a `mensagem`. */
export type DocumentoLido =
  | { valido: true; documento: Documento }
  | { valido: false; mensagem: string }

/** Os dígitos de qualquer entrada. */
export function apenasDigitos(valor: unknown): string {
  return typeof valor === "string" || typeof valor === "number"
    ? String(valor).replace(/\D/g, "")
    : ""
}

/**
 * Módulo 11 de CPF/CNPJ. O `pesoInicial` vem de fora: o 1º e o 2º dígito usam
 * pesos diferentes (CPF: 10 e 11; CNPJ: 5 e 6), e a fórmula antiga (`tamanho - 7`)
 * acertava só o primeiro — por isso CPF válido era recusado no checkout.
 */
function digitoVerificador(digitos: string, pesoInicial: number): number {
  const tamanho = digitos.length
  let soma = 0
  let peso = pesoInicial

  for (let i = 0; i < tamanho; i++) {
    soma += Number(digitos[i]) * peso
    peso -= 1

    if (peso < 2) {
      peso = 9
    }
  }

  const resto = soma % 11

  return resto < 2 ? 0 : 11 - resto
}

/** Os dois dígitos: ver só o último aceita demais. O segundo é `corpo + primeiro`. */
function verificadorConfere(digitos: string): boolean {
  const corpo = digitos.slice(0, -2)
  const pesoInicial = digitos.length === 11 ? 10 : 5
  const primeiro = digitoVerificador(corpo, pesoInicial)

  if (Number(digitos[digitos.length - 2]) !== primeiro) {
    return false
  }

  return (
    Number(digitos[digitos.length - 1]) ===
    digitoVerificador(corpo + primeiro, pesoInicial + 1)
  )
}

/** Vazio tem mensagem própria. */
export function lerDocumento(valor: unknown): DocumentoLido {
  const digitos = apenasDigitos(valor)

  if (digitos.length === 0) {
    return { valido: false, mensagem: "Informe o CPF." }
  }

  if (/^(\d)\1+$/.test(digitos)) {
    return {
      valido: false,
      mensagem: "Este CPF não existe. Confira os números.",
    }
  }

  if (digitos.length === 11) {
    return verificadorConfere(digitos)
      ? { valido: true, documento: { tipo: "CPF", numero: digitos } }
      : { valido: false, mensagem: "CPF inválido. Confira os números." }
  }

  if (digitos.length === 14) {
    return verificadorConfere(digitos)
      ? { valido: true, documento: { tipo: "CNPJ", numero: digitos } }
      : { valido: false, mensagem: "CNPJ inválido. Confira os números." }
  }

  return {
    valido: false,
    mensagem: "O CPF tem 11 números e o CNPJ tem 14. Confira o que foi digitado.",
  }
}

/** Só o veredito. */
export function documentoValido(valor: unknown): boolean {
  return lerDocumento(valor).valido
}

/** Com máscara, para a tela. */
export function formatarDocumento(valor: unknown): string {
  const digitos = apenasDigitos(valor)

  if (digitos.length === 0) {
    return ""
  }

  if (digitos.length <= 11) {
    return digitos
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4")
  }

  return digitos
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5")
}

/** `null`: quem emite recusa. */
export function documentoDoDestinatario(
  valor: unknown
): { type: TipoDocumento; number: string } | null {
  const lido = lerDocumento(valor)

  return lido.valido
    ? { type: lido.documento.tipo, number: lido.documento.numero }
    : null
}

/** O CEP como se escreve: progressivo ("0131" fica "0131"; "01310-1" já tem traço). */
export function formatarCep(valor: unknown): string {
  const digitos = apenasDigitos(valor).slice(0, 8)

  return digitos.length > 5
    ? `${digitos.slice(0, 5)}-${digitos.slice(5)}`
    : digitos
}

/** `CEP_DIGITOS` do CEP brasileiro, sem contar o traço. */
export const CEP_DIGITOS = 8

/** O CEP completo, ou `null` enquanto ele não tiver os oito números. */
export function formatarCepCompleto(valor: unknown): string | null {
  return apenasDigitos(valor).length === CEP_DIGITOS
    ? formatarCep(valor)
    : null
}

/**
 * O telefone com DDD, progressivo: o nono dígito só entra quando existe, e com
 * menos de três números o campo só mostra os dígitos.
 */
export function formatarTelefone(valor: unknown): string {
  const digitos = apenasDigitos(valor).slice(0, 11)

  if (digitos.length <= 2) {
    return digitos
  }

  if (digitos.length <= 6) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`
  }

  if (digitos.length <= 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`
  }

  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`
}

