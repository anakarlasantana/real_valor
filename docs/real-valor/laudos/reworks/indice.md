# Indice dos reworks

> **Arquivo derivado.** Nasce dos registros `RW-*.md` desta pasta. O gerador e o
> `--check` da CI entram com o RV-059; ate la, a atualizacao e' manual e o commit
> diz isso. Contrato: [doc 20](../../20-testes-ponta-a-ponta.md) 20.6.

| id | data | jornada | severidade | estado | PR |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [RW-2026-001](RW-2026-001.md) | 2026-11-16 | cliente-compra | cosmetico | `descartado` (defeito do teste) | - |
| [RW-2026-002](RW-2026-002.md) | 2026-11-17 | cliente-compra | bloqueia-compra | `descartado` (fixture/regiao) | - |
| [RW-2026-003](RW-2026-003.md) | 2026-11-17 | cliente-compra | bloqueia-compra | `verificado` (peca sem perfil de envio) | - |
| [RW-2026-004](RW-2026-004.md) | 2026-11-17 | cliente-compra | bloqueia-compra | `verificado` (dado de teste em centavos) | - |
| [RW-2026-005](RW-2026-005.md) | 2026-11-17 | cliente-compra | degrada | `verificado` (resumo lia status errado) | - |
| [RW-2026-006](RW-2026-006.md) | 2026-11-17 | cliente-compra | degrada | `verificado` (preparo pulado: `--skip-before`) | - |
| [RW-2026-008](RW-2026-008.md) | 2026-11-17 | cliente-compra | bloqueia-compra | `verificado` (submit do endereço sem retry) | - |
| [RW-2026-009](RW-2026-009.md) | 2026-11-23 | cliente-compra | degrada | `verificado` (rastreio não listava os itens) | - |
| [RW-2026-010](RW-2026-010.md) | 2026-11-23 | cliente-compra | degrada | `descartado` (dedupe existe no Medusa; CA-2 reescrito com prova e CA-6 criado) | - |
| [RW-2026-011](RW-2026-011.md) | 2026-11-23 | cliente-compra | degrada | `relatado` (flake: recompilação do dev server estoura o orçamento de 45s) | - |
| [RW-2026-012](RW-2026-012.md) | 2026-11-23 | cliente-compra | degrada | `verificado` (passo de pagamento assertava o rádio da entrega) | - |

## Estados possiveis

`relatado` -> `triado` -> `aplicado` -> `verificado` -> `fechado`

Fora do caminho feliz: `descartado` (a causa era ambiente ou dado, com o motivo
registrado) e `bloqueado` (tres tentativas sem sucesso - escala para humano).
