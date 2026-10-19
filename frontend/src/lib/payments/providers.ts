/**
 * Os meios que a loja oferece: sem o `pp_system_default`, que "paga" sem cobrar
 * e volta a cada boot. O adapter manual segue no registry para sessões antigas.
 * Ver docs/real-valor/15-arquitetura-modular.md §15.10.
 */
export const MEIO_MANUAL_DO_MEDUSA = "pp_system_default"

export function meiosDePagamentoVisiveis<T extends { id: string }>(
  providers: T[]
): T[] {
  return providers
    .filter((provider) => provider.id !== MEIO_MANUAL_DO_MEDUSA)
    .sort((a, b) => (a.id > b.id ? 1 : -1))
}
