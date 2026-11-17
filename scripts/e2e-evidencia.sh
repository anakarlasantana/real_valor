#!/usr/bin/env bash
# =============================================================================
# e2e-evidencia.sh — transforma a captura bruta no `resumo.md` (<= 60 linhas).
# =============================================================================
# Entrada: o diretorio da execucao (`evidence/<timestamp>/`), que o Playwright
# ja' preencheu com `resultado.json`, `captura/*.ndjson` e `playwright/`.
# Saida:   `resumo.md` no MESMO diretorio.
#
# Por que existe: o modelo (e a pessoa com pressa) nao le 5 MB de trace. O
# resumo e' o contrato do doc 20 §20.3 — jornada, resultado, a primeira causa,
# os 5xx e os erros de console, com o caminho dos artefatos para quem quiser
# cavar.
#
# Sem `node -e` de parsing pesado: os `.ndjson` sao linha-a-linha (`grep` serve),
# e o `resultado.json` e' lido pelo proprio Node, que ja' e' ferramenta do repo.
# =============================================================================
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

DIR="${1:-}"
if [ -z "$DIR" ] || [ ! -d "$DIR" ]; then
  echo "uso: scripts/e2e-evidencia.sh evidence/<timestamp>" >&2
  exit 2
fi

RESUMO="$DIR/resumo.md"
CAPTURA="$DIR/captura"

cincoxx="$(grep -h '"status":5' "$CAPTURA"/*.network.ndjson 2>/dev/null || true)"
errosconsole="$(grep -h '"nivel":"error"' "$CAPTURA"/*.console.ndjson 2>/dev/null || true)"

# O `resultado.json` do reporter: status, duracao e a mensagem do primeiro erro.
resumo_json="$(DIR="$DIR" node -e '
  const fs = require("fs");
  const p = process.env.DIR + "/resultado.json";
  if (!fs.existsSync(p)) { console.log("SEM_RESULTADO"); process.exit(0); }
  const r = JSON.parse(fs.readFileSync(p, "utf8"));
  const specs = [];
  const anda = (s) => { for (const sp of s.specs ?? []) specs.push(sp); for (const f of s.suites ?? []) anda(f); };
  for (const s of r.suites ?? []) anda(s);
  const linhas = specs.map((sp) => {
    const t = (sp.tests ?? [])[0] ?? {};
    const ultimo = (t.results ?? [])[(t.results ?? []).length - 1] ?? {};
    const erro = (ultimo.error?.message ?? "").split("\n").filter(Boolean).slice(0, 4).join(" | ");
    return [sp.title, t.status ?? ultimo.status ?? "?", Math.round((ultimo.duration ?? 0) / 100) / 10, erro].join("\t");
  });
  console.log(linhas.join("\n") || "SEM_SPECS");
  process.exit(0);
' 2>/dev/null || echo "SEM_RESULTADO")"

falhou=0
# `status` no reporter JSON e' `passed` / `unexpected` / `skipped` — nao existe
# `failed`. Conta como falha: qualquer spec que nao passou, ou a ausencia do
# proprio relatorio (runner que morreu antes de escrever).
printf '%s\n' "$resumo_json" | grep -qE 'SEM_RESULTADO|SEM_SPECS' && falhou=1
printf '%s\n' "$resumo_json" | grep -q . && printf '%s\n' "$resumo_json" | grep -qv $'\tpassed\t' && falhou=1
[ -n "$cincoxx" ] && falhou=1
[ -n "$errosconsole" ] && falhou=1

{
  echo "# resumo — $(basename "$DIR")"
  echo
  echo "alvo: real-valor"
  if [ "$falhou" = "1" ]; then echo "resultado: FALHOU"; else echo "resultado: PASSOU"; fi
  echo

  echo "## jornadas"
  echo
  printf '%s\n' "$resumo_json" | while IFS=$'\t' read -r titulo status duracao erro; do
    [ -z "${titulo:-}" ] && continue
    echo "- \`$titulo\` — $status (${duracao}s)"
    [ -n "${erro:-}" ] && echo "  - $erro"
  done
  echo

  echo "## fatos"
  echo
  echo "- 5xx: $(printf '%s' "$cincoxx" | grep -c . ) ocorrencia(s)"
  printf '%s\n' "$cincoxx" | grep . | head -5 | sed -E 's/.*"metodo":"([^"]+)".*"url":"([^"]+)".*"status":([0-9]+).*/  - \1 \2 → \3/'
  echo "- console.error/pageerror: $(printf '%s' "$errosconsole" | grep -c . ) ocorrencia(s)"
  printf '%s\n' "$errosconsole" | grep . | head -5 | sed -E 's/.*"texto":"([^"]{0,120}).*/  - \1/'
  echo

  echo "## artefatos"
  echo
  echo "- rede/console: \`$CAPTURA\`"
  echo "- trace/video: \`$DIR/playwright\` (retain-on-failure)"
  [ -f "$DIR/runner.log" ] && echo "- saida do runner: \`$DIR/runner.log\`"
} > "$RESUMO"

echo "resumo escrito: $RESUMO"

if [ "$falhou" = "1" ]; then
  exit 1
fi
