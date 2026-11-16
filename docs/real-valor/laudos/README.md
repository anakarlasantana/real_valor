# Laudos e registros de rework

**Para que serve.** Guardar o que é **durável** de uma execução de teste
ponta-a-ponta: o laudo (o que passou, o que falhou, com números) e o registro do
rework (o que será corrigido, por quem e até quando). O que é **descartável** —
trace, console, rede, log de container — fica em `evidence/`, fora do git.

Contrato completo: [doc 20](../20-testes-ponta-a-ponta.md). Dívidas:
`RV-028` (a suíte) e `RV-059` (o fluxo de rework), no
[doc 19](../19-debito-tecnico.md) §7.

---

## O que fica aqui

| Arquivo | O que é | Quem escreve |
| :--- | :--- | :--- |
| `<AAAA-MM-DD>-<alvo>-<jornada>.md` | **laudo** de uma execução | harness (gerado) |
| `reworks/RW-<AAAA>-<NNN>.md` | **registro** de um rework | harness abre; agente avança o estado |
| `reworks/indice.md` | índice derivado dos registros | harness (regenerado) |

## O que **não** fica aqui

`trace.zip`, `network.ndjson`, `console.ndjson`, `server.log`, screenshots e o
`resumo.md` do momento. Isso é diagnóstico efêmero: vive em `evidence/<timestamp>/`
e é ignorado pelo git. **O que precisa sobreviver fica inline no registro** — é o
princípio 1 do doc 20 §20.5: se a evidência for apagada, o rework continua
resolvível.

## Nome dos arquivos (autoexplicativo, ordenável)

```
2026-11-17-real-valor-cliente.md     ← laudo: data · alvo · jornada
RW-2026-001.md                       ← rework: prefixo + ano + sequência
```

O `id` do rework é o que amarra tudo: ele aparece na branch (`fix/RW-2026-001-…`),
no commit e no corpo do PR.

## Regra que não se negocia

**Nenhum rework é fechado sem veredito.** Fechar sem os números dos gates
(`make ready`, a jornada re-executada) é a forma mais barata de um teste mentir.
