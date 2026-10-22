/**
 * O Medusa v2 guarda decimal (R$ 31,50 = `31.5`, como `price.amount = 249.9`);
 * o SuperFrete e a tabela calculam em centavos (3150). A conversão é aqui, na
 * fronteira do provider — sem ela o checkout mostra R$ 3.150,00.
 */
export function emReais(centavos: number): number {
  return Math.round(Number(centavos) || 0) / 100
}

/** O caminho de volta: decimal do Medusa (249.9) → centavos (24990). */
export function emCentavos(reais: number): number {
  return Math.round((Number(reais) || 0) * 100)
}
