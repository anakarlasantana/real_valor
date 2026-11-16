---
paths:
  - "backend/src/**"
  - "frontend/src/**"
  - "admin/src/**"
  - "packages/contrato/src/**"
  - "scripts/**"
---
# Orçamento de comentários (a catraca)

O `make check` compara a contagem de linhas de comentário **por árvore e por
arquivo** com `scripts/baselines/comments.json` e **reprova qualquer aumento**.
Isso é intencional: comentário que cresce sem limite vira parágrafo que ninguém
lê, e o código deixa de se explicar por si.

Antes de escrever um comentário novo:

1. Ele explica **por que**, e não **o que** o código já diz? Se for "o que", não
   escreva.
2. A narrativa cabe melhor em `docs/real-valor/15-arquitetura-modular.md`?
3. Se a linha é mesmo necessária, **remova outra** no mesmo arquivo.

`node scripts/check-comments.mjs --write` reancora o baseline. Só rode quando a
**forma** dos arquivos mudou de verdade (arquivo criado, bloco movido) e diga
isso no corpo do commit. Um arquivo novo de 40 comentários não é "forma".

Sinal de que a regra foi violada: `make check` com
`FAIL <árvore>: N linha(s) de comentário (baseline M)`.
