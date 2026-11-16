#!/usr/bin/env bash
# =============================================================================
# check-readiness.sh — o "definition of done" do repositorio em UM veredito.
# =============================================================================
# Roda os gates do repo (check, types, test e, com --full, test:api) e imprime
# UMA linha por gate, a primeira causa da falha e o veredito final. O log
# completo de cada gate fica em `.run/ready/<gate>.log` (gitignored).
#
# POR QUE UM SCRIPT E NAO UM ALVO `make` PURO:
#   1. o ambiente do shell pode carregar o `.env` exportado, e ai' o jest le
#      variaveis que o teste espera do default (medido: EMAIL_ATENDIMENTO fazia
#      o spec de notificacao falhar sem nenhum defeito de codigo);
#   2. o agente precisa de um veredito CURTO (<= 12 linhas) em vez de 400 linhas
#      de jest;
#   3. exit code agregado correto, com todos os gates rodando (nao para no 1o).
#
# Uso: scripts/check-readiness.sh [--full]
# =============================================================================
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

LOG_DIR=".run/ready"
mkdir -p "$LOG_DIR"

COMPLETO=0
[ "${1:-}" = "--full" ] && COMPLETO=1

# O `.env` exportado no shell tem precedencia sobre o arquivo em qualquer
# ferramenta que leia process.env. Aqui ele e' neutralizado: o gate testa o
# codigo, nao o terminal de quem rodou.
for chave in $(grep -oE '^[A-Z0-9_]+=' .env 2>/dev/null | tr -d '='); do
  unset "$chave" 2>/dev/null || true
done

# Uma linha que diga o que o gate conferiu (ou os numeros, quando ha').
resumo_do_gate() {
  local nome="$1" log="$2"

  case "$nome" in
    check) echo "contrato · camadas · catraca · specs" ;;
    types) echo "backend · CRM · storefront" ;;
    test)
      # jest imprime "Tests:  N passed" (backend e CRM, nesta ordem no alvo);
      # vitest imprime "Tests  N passed (N)" — e com codigo ANSI no meio, por
      # isso a limpeza antes do grep.
      local limpo jest vitest
      limpo="$(sed -E 's/\x1b\[[0-9;]*m//g' "$log" 2>/dev/null)"
      jest="$(printf '%s\n' "$limpo" | grep -oE '^Tests: +[0-9]+ passed' | grep -oE '[0-9]+' | paste -sd'/' -)"
      vitest="$(printf '%s\n' "$limpo" | grep -oE 'Tests +[0-9]+ passed' | grep -oE '[0-9]+' | tail -1)"
      if [ -n "$jest" ]; then
        echo "${jest%/*} · ${jest#*/} · ${vitest:-?} testes"
      else
        echo "testes verdes"
      fi
      ;;
    api) echo "personas de API" ;;
    *)   echo "ok" ;;
  esac
}

# A primeira linha que explica a falha — sem stack trace.
primeira_causa() {
  local log="$1"

  grep -aE '(^|[[:space:]])(FAIL|FAILED|Error:|error TS[0-9]+|✗|✖|●)' "$log" 2>/dev/null \
    | head -1 \
    | sed -E 's/[[:space:]]+/ /g; s/^ //; s/ $//' \
    | cut -c1-110
}

GATES=("check:make check" "types:make types" "test:make test")
if [ "$COMPLETO" = "1" ] && grep -q '^test:api:' Makefile; then
  GATES+=("api:make test:api")
fi

TOTAL=${#GATES[@]}
OK=0
FALHAS=()
INICIO=$(date +%s)

printf '\n── prontidao ──────────────────────────────────────────────────────────\n'

for entrada in "${GATES[@]}"; do
  nome="${entrada%%:*}"
  comando="${entrada#*:}"
  log="$LOG_DIR/$nome.log"
  t0=$(date +%s)

  if timeout 600 bash -c "$comando" > "$log" 2>&1; then
    OK=$((OK + 1))
    detalhe="$(resumo_do_gate "$nome" "$log")"
    printf '  %-7s OK      %-46s %ss\n' "$nome" "$detalhe" "$(( $(date +%s) - t0 ))"
  else
    causa="$(primeira_causa "$log")"
    FALHAS+=("$nome")
    printf '  %-7s FALHA   %s\n' "$nome" "${causa:-veja o log}"
    printf '          → log: %s\n' "$log"
  fi
done

printf '───────────────────────────────────────────────────────────────────────\n'

DURACAO=$(( $(date +%s) - INICIO ))

if [ "$OK" = "$TOTAL" ]; then
  printf '  VEREDITO: PRONTO — %d/%d em %ds\n\n' "$OK" "$TOTAL" "$DURACAO"
  exit 0
fi

printf '  VEREDITO: NAO PRONTO — %d/%d (falhou: %s)\n\n' \
  "$OK" "$TOTAL" "$(IFS=', '; echo "${FALHAS[*]}")"
exit 1
