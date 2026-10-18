/**
 * Página custom do admin: Envios.
 * -------------------------------------------------------------------------
 * É a outra ponta de `GET /store/orders/track`. A rota pública lê o que esta
 * tela grava — e antes do RV-043 **ninguém escrevia**: a rota existia, estava
 * bem feita, e a cliente consultava e via sempre "ainda não enviado".
 *
 * A tela é uma fila de trabalho, não um formulário solto: o lojista não tem o
 * número do pedido da cliente na mão, e a ordem da fila é a ordem em que os
 * pedidos precisam sair (mais antigo primeiro), decidida pela rota.
 *
 * Os campos são TEXTO LIVRE, e não uma lista de transportadoras. O provedor de
 * frete ainda não foi decidido, e modelar a tela para a transportadora de hoje
 * obrigaria a refatorar quando a de amanhã for escolhida. Os padrões de link
 * existem só como atalho para o link **não digitado**, no backend.
 *
 * A regra de validação mora no backend (`modules/shipping/tracking.ts`) e não
 * aqui: validação duplicada vira validação que diverge. Esta tela mostra a
 * mensagem que a rota devolveu, sem tentar adivinhar.
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { HandTruck } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Label,
  Text,
  toast,
} from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"

import { apiUrl, readJson } from "../../lib/api-url"
import {
  corpoDoEnvio,
  estadoDoResumo,
  rotuloDaFila,
  type EstadoEnvio,
} from "./envio-form"
import { acaoDoPedido, etiquetaDoPedido, reais } from "./etiqueta-fila"
import type { PedidoEnvio } from "./types"

/** Um pedido aberto para edição, e o rascunho do formulário dele. */
type Aberto = {
  pedido: PedidoEnvio
  salvo: EstadoEnvio
  rascunho: EstadoEnvio
}

function ShippingPage() {
  const [pedidos, setPedidos] = useState<PedidoEnvio[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [aberto, setAberto] = useState<Aberto | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [saldo, setSaldo] = useState<number | null>(null)
  const [saldoErro, setSaldoErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)

  const carregarSaldo = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/admin/shipping/saldo"), {
        credentials: "include",
      })
      const json = await readJson(res)

      if (!res.ok) {
        setSaldoErro(json.message ?? "Não foi possível ler a carteira SuperFrete.")
        setSaldo(null)
        return
      }

      setSaldo(Number(json.saldo) || 0)
      setSaldoErro(null)
    } catch {
      setSaldoErro("Não foi possível falar com o servidor.")
    }
  }, [])

  const carregar = useCallback(async () => {
    setCarregando(true)

    try {
      const res = await fetch(apiUrl("/admin/shipping"), {
        credentials: "include",
      })
      // `readJson`, e não `res.json()`: um corpo que não é JSON (o HTML de um
      // 404, o interstitial de um túnel) vira `{}` em vez de `SyntaxError`, e
      // quem decide a mensagem continua sendo o `res.ok` abaixo.
      const json = await readJson(res)

      if (!res.ok) {
        // A tela mostra a mensagem e para. Um erro silencioso aqui seria
        // lido como "não há pedidos esperando envio" — e o lojista acreditaria
        // que a fila está limpa quando na verdade o painel não conseguiu ler.
        setErro(json.message ?? "Falha ao carregar os pedidos.")
        return
      }

      setPedidos((json.pedidos ?? []) as PedidoEnvio[])
      setErro(null)
    } catch {
      setErro("Não foi possível falar com o servidor. Tente de novo.")
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
    void carregarSaldo()
  }, [carregar, carregarSaldo])

  const gerar = async (pedido: PedidoEnvio) => {
    setOcupado(pedido.id)

    try {
      const res = await fetch(apiUrl(`/admin/shipping/${pedido.id}/etiqueta`), {
        method: "POST",
        credentials: "include",
      })
      const json = await readJson(res)

      if (!res.ok) {
        toast.error(json.message ?? "Não foi possível gerar a etiqueta.")
        return
      }

      toast.success(`Etiqueta gerada (${reais(Number(json.preco) || 0)}).`)
      await Promise.all([carregar(), carregarSaldo()])
    } catch {
      toast.error("Não foi possível falar com o servidor.")
    } finally {
      setOcupado(null)
    }
  }

  const imprimir = async (pedido: PedidoEnvio) => {
    setOcupado(pedido.id)

    try {
      const res = await fetch(apiUrl(`/admin/shipping/${pedido.id}/etiqueta/pdf`), {
        credentials: "include",
      })
      const json = await readJson(res)

      if (!res.ok || !json.url) {
        toast.error(json.message ?? "Não foi possível gerar o PDF.")
        return
      }

      window.open(String(json.url), "_blank", "noopener")
    } catch {
      toast.error("Não foi possível falar com o servidor.")
    } finally {
      setOcupado(null)
    }
  }

  const cancelarEtiqueta = async (pedido: PedidoEnvio) => {
    if (!window.confirm("Cancelar a etiqueta? O valor volta para a carteira SuperFrete.")) {
      return
    }

    setOcupado(pedido.id)

    try {
      const res = await fetch(apiUrl(`/admin/shipping/${pedido.id}/etiqueta/cancelar`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: "Cancelado pelo lojista" }),
      })
      const json = await readJson(res)

      if (!res.ok) {
        toast.error(json.message ?? "Não foi possível cancelar a etiqueta.")
        return
      }

      toast.success(json.estorno ?? "Etiqueta cancelada.")
      await Promise.all([carregar(), carregarSaldo()])
    } catch {
      toast.error("Não foi possível falar com o servidor.")
    } finally {
      setOcupado(null)
    }
  }

  const pendentes = useMemo(
    () => pedidos.filter((p) => !p.envio.enviado),
    [pedidos]
  )
  const enviados = useMemo(
    () => pedidos.filter((p) => p.envio.enviado),
    [pedidos]
  )

  const abrir = (pedido: PedidoEnvio) => {
    const salvo = estadoDoResumo(pedido.envio)

    setAberto({ pedido, salvo, rascunho: { ...salvo } })
  }

  const mudar = (campo: keyof EstadoEnvio, valor: string) => {
    setAberto((atual) =>
      atual
        ? { ...atual, rascunho: { ...atual.rascunho, [campo]: valor } }
        : atual
    )
  }

  const salvar = async () => {
    if (!aberto) {
      return
    }

    const corpo = corpoDoEnvio(aberto.salvo, aberto.rascunho)

    if (Object.keys(corpo).length === 0) {
      toast.info("Nada mudou.")
      return
    }

    setSalvando(true)

    try {
      const res = await fetch(apiUrl(`/admin/shipping/${aberto.pedido.id}`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      })
      const json = await res.json()

      if (!res.ok) {
        // A mensagem de validação é do backend e é a que vale: aqui não há
        // segunda regra para divergir da primeira.
        toast.error(json.message ?? "Falha ao salvar o envio.")
        return
      }

      toast.success("Envio registrado. A cliente já vê o rastreio.")
      setAberto(null)
      await carregar()
    } catch {
      toast.error("Não foi possível falar com o servidor.")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Container>
      <Heading level="h1">Envios</Heading>
      <Text size="small" color="fg-subtle">
        O que a cliente vê em <code>/rastreio</code> é exatamente o que é
        gravado aqui.
      </Text>

      <div className="flex items-center gap-3 py-3">
        <Text size="small" weight="plus">
          Carteira SuperFrete: {saldo === null ? "—" : reais(saldo)}
        </Text>
        {saldoErro && (
          <Text size="small" color="fg-danger">
            {saldoErro}
          </Text>
        )}
        <Button variant="transparent" size="small" onClick={() => void carregarSaldo()}>
          Atualizar saldo
        </Button>
      </div>

      {erro && (
        <Text size="small" color="fg-danger">
          {erro}
        </Text>
      )}

      {carregando && <Text size="small">Carregando…</Text>}

      {!carregando && !erro && pedidos.length === 0 && (
        <Text size="small" color="fg-subtle">
          Nenhum pedido por enquanto.
        </Text>
      )}

      {pendentes.length > 0 && (
        <>
          <Heading level="h2">Aguardando envio</Heading>
          {pendentes.map((pedido) => (
            <Linha
              key={pedido.id}
              pedido={pedido}
              onAbrir={() => abrir(pedido)}
              onGerar={() => gerar(pedido)}
              onImprimir={() => imprimir(pedido)}
              onCancelar={() => cancelarEtiqueta(pedido)}
              ocupado={ocupado === pedido.id}
            />
          ))}
        </>
      )}

      {enviados.length > 0 && (
        <>
          <Heading level="h2">Já enviados</Heading>
          {enviados.map((pedido) => (
            <Linha
              key={pedido.id}
              pedido={pedido}
              onAbrir={() => abrir(pedido)}
              onGerar={() => gerar(pedido)}
              onImprimir={() => imprimir(pedido)}
              onCancelar={() => cancelarEtiqueta(pedido)}
              ocupado={ocupado === pedido.id}
            />
          ))}
        </>
      )}

      {aberto && (
        <Formulario
          aberto={aberto}
          onMudar={mudar}
          onSalvar={salvar}
          onFechar={() => setAberto(null)}
          salvando={salvando}
        />
      )}
    </Container>
  )
}
function Linha({
  pedido,
  onAbrir,
  onGerar,
  onImprimir,
  onCancelar,
  ocupado,
}: {
  pedido: PedidoEnvio
  onAbrir: () => void
  onGerar: () => void
  onImprimir: () => void
  onCancelar: () => void
  ocupado: boolean
}) {
  const { texto, cor } = rotuloDaFila(pedido.envio)
  const etiqueta = etiquetaDoPedido(pedido)
  const { acao, rotulo, motivo } = acaoDoPedido(pedido)

  return (
    <Container className="flex items-center justify-between gap-4 py-2">
      <div className="flex flex-col">
        <Text size="small" weight="plus">
          #{pedido.display_id} — {pedido.resumo || "Sem itens"}
        </Text>
        <Text size="small" color="fg-subtle">
          {etiqueta
            ? `SuperFrete ${etiqueta.id} · ${etiqueta.situacao}${
                etiqueta.preco ? ` · ${reais(etiqueta.preco)}` : ""
              }`
            : pedido.envio.enviado
              ? `${pedido.envio.carrier} · ${pedido.envio.trackingNumber}`
              : pedido.email}
        </Text>
        {motivo && (
          <Text size="small" color="fg-subtle">
            {motivo}
          </Text>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Badge color={cor}>{texto}</Badge>

        {acao === "gerar" && (
          <Button size="small" onClick={onGerar} isLoading={ocupado} disabled={ocupado}>
            {rotulo}
          </Button>
        )}

        {acao === "imprimir" && (
          <>
            <Button size="small" onClick={onImprimir} isLoading={ocupado} disabled={ocupado}>
              {rotulo}
            </Button>
            <Button size="small" variant="danger" onClick={onCancelar} disabled={ocupado}>
              Cancelar
            </Button>
          </>
        )}

        <Button variant="secondary" size="small" onClick={onAbrir}>
          {pedido.envio.enviado ? "Editar" : "Registrar envio"}
        </Button>
      </div>
    </Container>
  )
}

function Formulario({
  aberto,
  onMudar,
  onSalvar,
  onFechar,
  salvando,
}: {
  aberto: Aberto
  onMudar: (campo: keyof EstadoEnvio, valor: string) => void
  onSalvar: () => void
  onFechar: () => void
  salvando: boolean
}) {
  const { pedido, rascunho } = aberto

  return (
    <Container className="my-4 rounded-lg border p-4">
      <Heading level="h3">Envio do pedido #{pedido.display_id}</Heading>

      <Label size="small">Transportadora</Label>
      <Input
        value={rascunho.carrier}
        onChange={(e) => onMudar("carrier", e.target.value)}
        placeholder="Ex.: Correios"
      />

      <Label size="small" className="mt-3">
        Código de rastreio
      </Label>
      <Input
        value={rascunho.tracking_number}
        onChange={(e) => onMudar("tracking_number", e.target.value)}
        placeholder="Ex.: BR123456789BR"
      />

      <Label size="small" className="mt-3">
        Link de acompanhamento
      </Label>
      <Input
        value={rascunho.tracking_url}
        onChange={(e) => onMudar("tracking_url", e.target.value)}
        placeholder="Deixe vazio para gerar pelo formato do código"
      />

      <Label size="small" className="mt-3">
        Situação
      </Label>
      <Input
        value={rascunho.status_label}
        onChange={(e) => onMudar("status_label", e.target.value)}
        placeholder="Ex.: Entregue"
      />

      <div className="mt-4 flex gap-2">
        <Button
          size="small"
          onClick={onSalvar}
          disabled={salvando}
          isLoading={salvando}
        >
          Salvar
        </Button>
        <Button size="small" variant="secondary" onClick={onFechar}>
          Cancelar
        </Button>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Envios",
  icon: HandTruck,
})

export default ShippingPage
