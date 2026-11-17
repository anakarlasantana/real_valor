# Indice dos reworks

> **Arquivo derivado.** Gerado a partir dos registros `RW-*.md` desta pasta -
> nao edite a mao. O gerador regenera e a CI confere (`--check`), como o
> `gen-content`. Contrato: [doc 20](../../20-testes-ponta-a-ponta.md) 20.6.

| id | data | jornada | severidade | estado | PR |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [RW-2026-001](RW-2026-001.md) | 2026-11-16 | cliente-compra | cosmetico | `descartado` (defeito do teste) | - |
| [RW-2026-002](RW-2026-002.md) | 2026-11-17 | cliente-compra | bloqueia-compra | `descartado` (fixture/regiao) | - |
| [RW-2026-003](RW-2026-003.md) | 2026-11-17 | cliente-compra | degrada | `relatado` | - |

## Estados possiveis

`relatado` -> `triado` -> `aplicado` -> `verificado` -> `fechado`

Fora do caminho feliz: `descartado` (a causa era ambiente ou dado, com o motivo
registrado) e `bloqueado` (tres tentativas sem sucesso - escala para humano).
