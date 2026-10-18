import { defineRouteConfig } from "@medusajs/admin-sdk"
import { TruckFast } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Label,
  Switch,
  Text,
  toast,
} from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"

import { apiUrl, readJson } from "../../../lib/api-url"
import {
  corpoDosServicos,
  escolhasDosServicos,
  motivoDaAusencia,
  nadaAtivo,
  prazoDaCotacao,
  problemaDaCotacao,
  reaisDaCotacao,
  rotuloDaCotacao,
  servicosDoTeste,
  testaveis,
  type CotacaoDaTela,
  type ServicoDaTela,
} from "./lib/servicos-form"

/**
 * O que o checkout oferece de frete — e o teste que mostra o preço de hoje.
 *
 * A tela lista as opções de envio do Medusa, não um catálogo do SuperFrete: o
 * SuperFrete não tem rota que liste serviços, então só aparece aqui o que o
 * seed criou ou alguém cadastrou.
 */
function ServicosPage() {
  const [servicos, setServicos] = useState<ServicoDaTela[]>([])
  const [escolhas, setEscolhas] = useState<Record<string, boolean>>({})
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [saldo, setSaldo] = useState<number | null>(null)
  const [cep, setCep] = useState("")
  const [cotacoes, setCotacoes] = useState<CotacaoDaTela[] | null>(null)
  const [semCotacao, setSemCotacao] = useState<string[]>([])
  const [testando, setTestando] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true)

    try {
      const res = await fetch(apiUrl("/admin/shipping/servicos"), {
        credentials: "include",
      })
      const json = await readJson(res)

      if (!res.ok) {
        setErro(json.message ?? "Falha ao carregar os serviços.")
        return
      }

      const lidos = (json.servicos ?? []) as ServicoDaTela[]
      setServicos(lidos)
      setEscolhas(escolhasDosServicos(lidos))
      setErro(null)
    } catch {
      setErro("Não foi possível falar com a API.")
    } finally {
      setCarregando(false)
    }
  }, [])

  const carregarSaldo = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/admin/shipping/saldo"), {
        credentials: "include",
      })
      const json = await readJson(res)

      setSaldo(res.ok ? Number(json.saldo) || 0 : null)
    } catch {
      setSaldo(null)
    }
  }, [])

  useEffect(() => {
    carregar()
    carregarSaldo()
  }, [carregar, carregarSaldo])

  const salvar = async () => {
    if (nadaAtivo(escolhas)) {
      toast.error(
        "Deixe ao menos um serviço ativo: sem nenhum, o checkout fica sem entrega.",
      )
      return
    }

    setSalvando(true)

    try {
      const res = await fetch(apiUrl("/admin/shipping/servicos"), {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpoDosServicos(escolhas)),
      })
      const json = await readJson(res)

      if (!res.ok) {
        toast.error(json.message ?? "Não foi possível salvar os serviços.")
        return
      }

      const lidos = (json.servicos ?? []) as ServicoDaTela[]
      setServicos(lidos)
      setEscolhas(escolhasDosServicos(lidos))
      toast.success(
        json.alterados > 0
          ? `Serviços atualizados (${json.alterados}).`
          : "Nada mudou.",
      )
    } catch {
      toast.error("Não foi possível falar com a API.")
    } finally {
      setSalvando(false)
    }
  }

  const testar = async () => {
    const problema = problemaDaCotacao(cep, testaveis(servicos))

    if (problema) {
      toast.error(problema)
      return
    }

    setTestando(true)

    try {
      const res = await fetch(apiUrl("/admin/shipping/testar"), {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        // `todos`: cota também o que está desligado, para saber se funcionaria.
        body: JSON.stringify({ cep, todos: true }),
      })
      const json = await readJson(res)

      if (!res.ok) {
        setCotacoes(null)
        setSemCotacao([])
        toast.error(json.message ?? "A cotação de teste falhou.")
        return
      }

      const lidas = (json.cotacoes ?? []) as CotacaoDaTela[]
      const cotaram = new Set(lidas.map((cotacao) => cotacao.servico))
      const pedidos = (json.testados ?? servicosDoTeste(servicos)) as string[]

      setCotacoes(lidas)
      setSemCotacao(pedidos.filter((servico) => !cotaram.has(servico)))
    } catch {
      toast.error("Não foi possível falar com a API.")
    } finally {
      setTestando(false)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading>Serviços de frete</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            O que o checkout oferece como entrega. O preço vem do SuperFrete na
            hora da compra — desligar aqui tira a opção da loja, sem apagar o
            histórico.
          </Text>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <Text size="xsmall" className="text-ui-fg-subtle">
              Carteira SuperFrete
            </Text>
            <Text weight="plus">
              {saldo === null ? "—" : reaisDaCotacao(saldo)}
            </Text>
          </div>
          <Button
            size="small"
            onClick={salvar}
            isLoading={salvando}
            disabled={carregando}
          >
            Salvar
          </Button>
        </div>
      </div>

      {erro && (
        <div className="px-6 py-4">
          <Text className="text-ui-fg-error">{erro}</Text>
        </div>
      )}

      <div className="divide-y">
        {carregando ? (
          <LinhaVazia>Carregando…</LinhaVazia>
        ) : servicos.length === 0 ? (
          <LinhaVazia>
            Nenhuma opção do SuperFrete encontrada. Rode o seed do frete para
            criá-las.
          </LinhaVazia>
        ) : (
          servicos.map((servico) => (
            <LinhaServico
              key={servico.id}
              servico={servico}
              ativo={Boolean(escolhas[servico.id])}
              onMudar={(ativo) =>
                setEscolhas({ ...escolhas, [servico.id]: ativo })
              }
            />
          ))
        )}
      </div>

      <div className="px-6 py-4">
        <Heading level="h2" className="mb-1">
          Testar cotação
        </Heading>
        <Text size="small" className="text-ui-fg-subtle mb-3">
          Cota todos os serviços da lista — inclusive os desligados — da caixa
          padrão do centro de distribuição para o CEP abaixo. É assim que se
          sabe se vale ligar. Não gera etiqueta nem desconta da carteira.
        </Text>

        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label size="small" htmlFor="cep-teste">
              CEP de destino
            </Label>
            <Input
              id="cep-teste"
              value={cep}
              placeholder="20040-020"
              maxLength={9}
              onChange={(e) => setCep(e.target.value)}
            />
          </div>
          <Button
            size="small"
            variant="secondary"
            onClick={testar}
            isLoading={testando}
          >
            Testar cotação
          </Button>
        </div>

        {cotacoes && (
          <div className="mt-4 flex flex-col gap-2">
            {cotacoes.length === 0 && semCotacao.length === 0 && (
              <Text size="small" className="text-ui-fg-subtle">
                Nenhum serviço cotou para este CEP.
              </Text>
            )}

            {cotacoes.map((cotacao) => (
              <div
                key={cotacao.servico}
                className="flex items-center justify-between border-ui-border-base rounded-md border px-4 py-2"
              >
                <Text size="small">{rotuloDaCotacao(cotacao)}</Text>
                <Text size="small" className="text-ui-fg-subtle">
                  {prazoDaCotacao(cotacao.prazo)} ·{" "}
                  {reaisDaCotacao(cotacao.preco)}
                </Text>
              </div>
            ))}

            {semCotacao.map((servico) => (
              <div
                key={`sem-${servico}`}
                className="border-ui-border-base flex items-center justify-between rounded-md border border-dashed px-4 py-2"
              >
                <Text size="small">{servico}</Text>
                <Text size="small" className="text-ui-fg-subtle">
                  {motivoDaAusencia(servico, servicos)}
                </Text>
              </div>
            ))}
          </div>
        )}
      </div>
    </Container>
  )
}

function LinhaVazia({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 py-6">
      <Text size="small" className="text-ui-fg-subtle">
        {children}
      </Text>
    </div>
  )
}

function LinhaServico({
  servico,
  ativo,
  onMudar,
}: {
  servico: ServicoDaTela
  ativo: boolean
  onMudar: (ativo: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <div>
        <div className="flex items-center gap-2">
          <Text weight="plus">{servico.nome}</Text>
          {!servico.ativa && !ativo && (
            <Badge size="2xsmall" color="orange">
              Fora da loja
            </Badge>
          )}
          {servico.precoFixo && (
            <Badge size="2xsmall" color="grey">
              Preço fixo
            </Badge>
          )}
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          {servico.servico
            ? `${servico.transportadora ?? "Transportadora"} · código ${servico.servico} · cotação ao vivo`
            : "Sem código de serviço — não cota"}
        </Text>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          checked={ativo}
          onCheckedChange={onMudar}
          disabled={!servico.servico}
          title={
            servico.servico
              ? undefined
              : "A opção não diz qual serviço de entrega é."
          }
        />
        <Label size="small">{ativo ? "Ativo" : "Desligado"}</Label>
      </div>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Serviços de frete",
  icon: TruckFast,
})

export default ServicosPage
