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

import {
  corpoDoEnvio,
  estadoDoResumo,
  rotuloDaFila,
  type EstadoEnvio,
} from "./envio-form"
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

  const carregar = useCallback(async () => {
    setCarregando(true)

    try {
      const res = await fetch("/admin/shipping", { credentials: "include" })
      const json = await res.json()

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
  }, [carregar])

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
      const res = await fetch(`/admin/shipping/${aberto.pedido.id}`, {
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
}: {
  pedido: PedidoEnvio
  onAbrir: () => void
}) {
  const { texto, cor } = rotuloDaFila(pedido.envio)

  return (
    <Container className="flex items-center justify-between gap-4 py-2">
      <div className="flex flex-col">
        <Text size="small" weight="plus">
          #{pedido.display_id} — {pedido.resumo || "Sem itens"}
        </Text>
        <Text size="small" color="fg-subtle">
          {pedido.envio.enviado
            ? `${pedido.envio.carrier} · ${pedido.envio.trackingNumber}`
            : pedido.email}
        </Text>
      </div>

      <div className="flex items-center gap-2">
        <Badge color={cor}>{texto}</Badge>
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
