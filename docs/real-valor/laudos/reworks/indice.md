# Índice dos reworks

> **Arquivo derivado.** Gerado a partir dos registros `RW-*.md` desta pasta —
> não edite à mão. O gerador regenera e a CI confere (`--check`), como o
> `gen-content`. Contrato: [doc 20](../../20-testes-ponta-a-ponta.md) §20.6.

| id | data | jornada | severidade | estado | PR |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [RW-2026-001](RW-2026-001.md) | 2026-11-16 | cliente-compra | bloqueia-compra | `relatado` | — |

## Estados possíveis

`relatado` → `triado` → `aplicado` → `verificado` → `fechado`

Fora do caminho feliz: `descartado` (a causa era ambiente ou dado, com o motivo
registrado) e `bloqueado` (três tentativas sem sucesso — escala para humano).
