---
paths:
  - "frontend/src/**"
---
# Camadas do storefront (R-A…R-E)

O `scripts/check-boundaries.mjs` roda no `make check` e reprova import de
**valor** que atravesse camada. As regras, na direção permitida (`app → modules
→ lib`):

| Regra | O que ela impede |
| :--- | :--- |
| **R-A** | `lib` importar `modules` — o tipo caminha com o dono; valor não |
| **R-B** | `lib` e `modules` importarem `app` |
| **R-C** | fora de `lib/data`, `lib` importar `lib/data` (dado só pela porta) |
| **R-D** | o checkout conhecer pagamento fora da fachada `@lib/payments` |
| **R-E** | ciclo no grafo de imports de valor |

Duas coisas que confundem:

- `import type` é permitido entre camadas — ele não sobrevive ao bundle.
- A **lista de exceções** (`scripts/check-boundaries.mjs`) só encolhe. Precisa
  de uma nova? Pare e proponha a mudança; não acrescente sozinho.

Sinal de violação: `make check` com `FAIL R-X — …`.
