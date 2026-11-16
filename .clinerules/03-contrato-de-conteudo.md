---
paths:
  - "packages/contrato/**"
---
# Contrato de conteúdo (fonte única)

`packages/contrato` é o **único** lugar onde tipos de seção, campos, rótulos,
paleta e listas de superfície existem. Backend, CRM e storefront importam daqui
(`@rv/contrato`). Mudar um campo é mudar o formulário do CRM e a validação da
API ao mesmo tempo — é o que impede as duas pontas de divergirem.

Ao mudar o contrato:

1. `make gen` — regenera o que **deriva** dele: um `theme.json` por tema
   (`frontend/themes/`) e `frontend/src/styles/tokens.generated.css`. Os dois são
   **versionados**; o diff entra no commit.
2. Suba `SCHEMA_VERSION` (`packages/contrato/src/schema.ts`) — o registro no
   Postgres é carimbado com ela.
3. `make seed -- --contrato` (ou `make seed`) grava o registro; o
   `make check-schema` da CI compara e reprova se ficou velho.

Proibido: editar o artefato gerado à mão, ou duplicar um campo de contrato em
outro arquivo "porque era mais rápido". O `make check` compara a paridade.
