---
paths:
  - "backend/src/**"
  - "frontend/src/**"
  - "admin/src/**"
  - "packages/contrato/src/**"
  - "e2e/**"
  - "scripts/**"
---
# Idioma e nomenclatura

## Idioma

- **Código em inglês**: arquivo, tipo, função, variável, flag, chave, coluna.
- **pt-BR** para: comentários, mensagens de CLI/UI, documentação, e nomes de
  domínio do produto (`loja`, `conteudo`, `requirements.json`).
- Certo: `gen-requirements.mjs`, `e2e-evidence.sh`, `prontidao` só em comentário.
- Errado: `gen-requisitos.mjs`, `e2e-evidencia.sh`, `avaliarFulfillment`.

## Nomenclatura de arquivo

| Regra | Certo | Errado |
| :--- | :--- | :--- |
| diz o que é/faz | `check-readiness.sh`, `gen-traceability.mjs` | `utils.mjs`, `helper.sh` |
| verbo + objeto em script | `check-boundaries.mjs` | `valida.mjs` |
| kebab-case em script | `e2e-stack.sh` | `e2eStack.sh` |
| sufixo do tipo | `*.unit.spec.ts`, `*.spec.ts` | `test-x.ts` |

Nome novo em português no código é **erro de revisão** — a lista de exceções
existentes (`seed/loja.ts`, `seed/conteudo.ts`) é dívida, não licença.
