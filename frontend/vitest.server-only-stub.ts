/**
 * O stub de `server-only` para os testes.
 * -------------------------------------------------------------------------
 * O pacote `server-only` lança por desenho quando é importado de um módulo
 * CLIENT — é assim que o Next impede que uma Server Component vaze para o
 * navegador. No teste unitário não existe essa separação: o registry éCLIENT e
 * importa o adapter do Stripe, que chama `placeOrder` (que usa `server-only`
 * por baixo). Sem o stub, a suíte morre antes do primeiro `it`.
 *
 * Aqui ele é substituído por um módulo vazio: o teste exercita a lógica do
 * registry, que não depende de nada disso.
 */
export {}
