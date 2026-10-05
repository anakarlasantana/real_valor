#!/usr/bin/env bash
#
# Falha quando o SHELL sobrescreve o `.env` com um valor VAZIO.
# =============================================================================
# O DOCKER COMPOSE DA PRECEDENCIA AO AMBIENTE DO SHELL SOBRE O ARQUIVO `.env`.
#
# Isso e' o comportamento documentado da interpolacao (`${VAR:-}`): o valor vale
# nesta ordem —
#
#   1. o ambiente do processo que roda `docker compose`
#   2. o arquivo `.env` do projeto
#
# — e a diferenca entre "a variavel nao existe" e "a variavel existe e esta
# VAZIA" e' invisivel aqui: `${VAR:-}` nao distingue as duas, e as duas resolvem
# para o default (que no nosso caso e' vazio, de proposito).
#
# O caso medido, nesta maquina:
#
#   $ env | grep MP_ACCESS_TOKEN      # o shell TINHA a variavel, exportada
#   MP_ACCESS_TOKEN=                  # ...e VAZIA
#   $ grep '^MP_ACCESS_TOKEN' .env    # o arquivo tinha o token certo
#   MP_ACCESS_TOKEN=APP_USR-...
#   $ docker compose config | grep MP_ACCESS_TOKEN
#   MP_ACCESS_TOKEN: ""               # <-- o .env foi SILENCIOSAMENTE ignorado
#
# O estrago nao e' um erro: e' um backend que sobe com o pagamento indisponivel
# e um webhook que responde 401, enquanto o `.env` mostra tudo preenchido. Quem
# depura olha o arquivo, ve o valor certo, e nao entende — porque a causa esta no
# shell, e nao no projeto.
#
# A origem mais comum: um `set -a; source .env; set +a` (ou `export $(cat .env)`)
# executado quando o `.env` ainda tinha a variavel vazia. O export fica no shell
# para o resto da sessao, sobrevive a edicao do arquivo, e sobrevive ao `make`.
#
# Este script NAO corrige o shell de quem chama (nao pode — e' outro processo).
# Ele transforma o erro silencioso em erro barulhento, com a linha de `unset` que
# resolve, o que e' a mesma escolha do `FAIL LOUD` do painel em
# `backend/medusa-config.ts`: uma configuracao ausente que passa despercebida
# custa mais do que um comando que nao roda.
#
# Uso: `make up` e `make recreate` o chamam antes de criar containers.
# =============================================================================
set -uo pipefail

raiz="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
arquivo="$raiz/.env"

# Sem `.env` nao ha sombra a detectar: o Compose usaria so o ambiente, e ai' o
# valor do shell e' a unica fonte — nao ha o que perder.
[ -f "$arquivo" ] || exit 0

sombras=()

while IFS= read -r linha || [ -n "$linha" ]; do
  # Comentario ou linha vazia.
  case "$linha" in
    "" | "#"*) continue ;;
  esac

  # `export NOME=valor` e' aceito e tratado igual a `NOME=valor`.
  linha="${linha#export }"

  # Precisa ter `=`.
  case "$linha" in
    *=*) ;;
    *) continue ;;
  esac

  nome="${linha%%=*}"
  valor="${linha#*=}"

  # So nomes de variavel legitimos.
  case "$nome" in
    "" | *[!A-Za-z0-9_]*) continue ;;
    [0-9]*) continue ;;
  esac

  # Se o `.env` nao tem valor, nao ha o que o shell esteja escondendo: um arquivo
  # vazio e' uma instrucao ("nao configurado"), e o `unset` nao mudaria nada.
  [ -n "$valor" ] || continue

  # ...o shell tem a MESMA variavel EXPORTADA (`+x`) e VAZIA (`-z`). E' esta a
  # combinacao que apaga o valor do arquivo.
  if [ -n "${!nome+x}" ] && [ -z "${!nome}" ]; then
    sombras+=("$nome")
  fi
done < "$arquivo"

if [ "${#sombras[@]}" -eq 0 ]; then
  exit 0
fi

printf '\n' >&2
printf 'ERRO: o shell esta sobrescrevendo o .env com valores VAZIOS.\n' >&2
printf '\n' >&2
printf 'O Docker Compose da precedencia ao ambiente do shell sobre o arquivo\n' >&2
printf '.env. Estas variaveis estao EXPORTADAS e VAZIAS no seu shell, entao o\n' >&2
printf 'valor que esta escrito no .env NAO vai chegar no container:\n' >&2
printf '\n' >&2

for nome in "${sombras[@]}"; do
  printf '  %s\n' "$nome" >&2
done

printf '\n' >&2
printf 'Sintoma se voce seguir: o container sobe, o .env parece certo, e o valor\n' >&2
printf 'nao chega. Nao ha mensagem de erro — so um servico mal configurado.\n' >&2
printf '\n' >&2
printf 'Resolva no shell de onde voce roda o make (uma vez por sessao):\n' >&2
printf '\n' >&2
printf '  unset %s\n' "${sombras[*]}" >&2
printf '\n' >&2
printf 'Ou abra um terminal novo. A causa mais comum e um `set -a; source .env`\n' >&2
printf 'executado quando o .env ainda tinha a variavel vazia.\n' >&2
printf '\n' >&2

exit 1
