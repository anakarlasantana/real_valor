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

/** Módulo 11 de CPF/CNPJ. */
function digitoVerificador(digitos: string): number {
  const tamanho = digitos.length
  let soma = 0
  let peso = tamanho - 7

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

/** Os dois: ver só o último aceita demais. */
function verificadorConfere(digitos: string): boolean {
  const corpo = digitos.slice(0, -2)
  const primeiro = digitoVerificador(corpo)

  if (Number(digitos[digitos.length - 2]) !== primeiro) {
    return false
  }

  return (
    Number(digitos[digitos.length - 1]) === digitoVerificador(corpo + primeiro)
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

