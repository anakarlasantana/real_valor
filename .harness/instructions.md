# Instruções do app (Real Valor)

As regras canônicas deste repositório estão em **`AGENTS.md`** (raiz) — camadas
universal e do repositório — e as regras **por caminho** estão em
**`.clinerules/`**. Leia os dois antes de qualquer mudança.

Este arquivo existe só para apontar para eles: o `ai-harness` anexa o conteúdo ao
system prompt de todas as etapas, e a fonte continua sendo **uma só** (nada de
regra duplicada aqui). O contrato que o harness lê fica em
`.harness/context.json`; o `testCommand` dele é `make ready`.
