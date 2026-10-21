import { formatarCep, formatarTelefone } from "@rv/contrato"

/** As máscaras do endereço, em `onChange`: entrega e cobrança formatam igual. */
export function mascararCampoDeEndereco(
  nomeDoCampo: string,
  valor: string
): string | undefined {
  switch (nomeDoCampo) {
    case "shipping_address.postal_code":
    case "billing_address.postal_code":
      return formatarCep(valor)
    case "shipping_address.phone":
    case "billing_address.phone":
      return formatarTelefone(valor)
    default:
      return undefined
  }
}
