---
paths:
  - "admin/src/**"
---
# CRM (painel em `admin/`)

O CRM é um pacote irmão **sem `package.json` e sem `node_modules`**: quem compila
é o Vite do backend. Por isso as dependências vêm por `paths`/`typeRoots` do
`admin/tsconfig.json`, e o React é o 18 do backend.

**Do backend, só `import type`.** É o que `scripts/check-boundaries.mjs` confere:
valor importado do backend no painel reprova o `make check`.

**Toda chamada à API passa por `apiUrl()`** (`admin/src/admin/lib/api-url.ts`) e
toda resposta é lida com `readJson()`. Um `fetch` relativo resolve contra a
origem da página; fora do backend isso vira 404 HTML e o `res.json()` estoura.

**O painel não decide regra.** Contrato, rótulos, estados, destinos e listas
chegam **como dado** da API. Se a tela precisa de uma regra nova, ela vem do
contrato (`packages/contrato`) — não de uma constante no componente.

Campos novos de formulário: o teste de fiação
(`admin/src/**/__tests__/panel-wiring.unit.spec.ts`) é o que prova que os três
arquivos que citam o contrato estão ligados de verdade.
