# CLAUDE.md

O canônico é o [AGENTS.md](AGENTS.md) — leia antes de codar. Resumo do que não se
negocia:

- **Código em inglês** (arquivo, tipo, função, variável, flag). Comentário,
  mensagem de UI/CLI e documentação em **pt-BR**.
- Nome de arquivo diz o que ele é ou faz: `gen-requirements.mjs`,
  `check-boundaries.mjs` — não `utils`, não `gen-requisitos`.
- `make ready` tem de imprimir `VEREDITO: PRONTO` antes de qualquer commit.
  Nunca `git commit --no-verify`.
- Código começa por spec aprovada (`ai spec approve` → `ai build code --spec`).

Regras por caminho (Cline) ficam em `.clinerules/`; contrato de testes em
`docs/real-valor/20-testes-ponta-a-ponta.md`.
