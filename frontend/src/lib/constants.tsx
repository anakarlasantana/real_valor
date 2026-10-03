/**
 * Constantes que não são de pagamento.
 * -------------------------------------------------------------------------
 * **O registro de meios de pagamento saiu deste arquivo (RV-001).**
 *
 * `paymentInfoMap`, `isStripeLike`, `isPaypal` e `isManual` viviam aqui e eram
 * consultados por `switch` dentro do checkout. Trocar isso por um registry é o
 * que este arquivo deixou de fazer: quem responde por um `provider_id` agora é
 * `resolvePayment()` (`lib/payments/registry.ts`), e quem rotula um meio no
 * server component é `paymentLabel()` (`lib/payments/labels.ts`).
 *
 * Sobrou aqui só o que não tem relação com pagamento: as moedas que não são
 * divididas por 100.
 */

/** Moedas que o valor não é dividido por 100 ao formatar. */
export const noDivisionCurrencies = [
  "krw",
  "jpy",
  "vnd",
  "clp",
  "pyg",
  "afn",
  "bif",
  "djf",
  "gnf",
  "kmf",
  "mga",
  "mro",
  "mur",
  "mvr",
  "rwf",
  "xaf",
  "xof",
  "xpf",
  "htg",
  "vuv",
  "xag",
  "xdr",
  "xcd",
  "xcu",
  "xdr",
  "xof",
  "xpf",
  "xau",
]
