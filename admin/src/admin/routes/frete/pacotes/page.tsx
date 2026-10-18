import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Tag } from "@medusajs/icons"
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
  RASCUNHO_VAZIO,
  corpoDoPacote,
  paraRascunho,
  pesoExibido,
  podeDesativar,
  problemasDoRascunho,
  type PacoteDaTela,
  type RascunhoPacote,
} from "./lib/pacote-form"

/** As caixas de envio — o que a cotação do checkout usa para pesar o pedido. */
function PacotesPage() {
  const [pacotes, setPacotes] = useState<PacoteDaTela[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [rascunho, setRascunho] = useState<RascunhoPacote>(RASCUNHO_VAZIO)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true)

    try {
      const res = await fetch(apiUrl("/admin/pacotes"), { credentials: "include" })
      const json = await readJson(res)

      if (!res.ok) {
        setErro(json.message ?? "Falha ao carregar as caixas.")
        return
      }

      setPacotes((json.pacotes ?? []) as PacoteDaTela[])
      setErro(null)
    } catch {
      setErro("Não foi possível falar com a API.")
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const abrir = (pacote?: PacoteDaTela) => {
    setEditando(pacote?.id ?? "novo")
    setRascunho(pacote ? paraRascunho(pacote) : RASCUNHO_VAZIO)
  }

  const fechar = () => {
    setEditando(null)
    setRascunho(RASCUNHO_VAZIO)
  }

  const salvar = async () => {
    const problemas = problemasDoRascunho(rascunho)

    if (problemas.length > 0) {
      toast.error(problemas[0])
      return
    }

    setSalvando(true)

    try {
      const novo = editando === "novo"
      const res = await fetch(
        apiUrl(novo ? "/admin/pacotes" : `/admin/pacotes/${editando}`),
        {
          method: novo ? "POST" : "PUT",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(corpoDoPacote(rascunho)),
        }
      )
      const json = await readJson(res)

      if (!res.ok) {
        toast.error(json.message ?? "Não foi possível salvar.")
        return
      }

      toast.success("Caixa salva.")
      fechar()
      await carregar()
    } catch {
      toast.error("Não foi possível falar com a API.")
    } finally {
      setSalvando(false)
    }
  }

  const desativar = async (pacote: PacoteDaTela) => {
    const res = await fetch(apiUrl(`/admin/pacotes/${pacote.id}`), {
      method: "DELETE",
      credentials: "include",
    })
    const json = await readJson(res)

    if (!res.ok) {
      toast.error(json.message ?? "Não foi possível desativar.")
      return
    }

    toast.success("Caixa desativada.")
    await carregar()
  }

  const restaurar = async () => {
    const res = await fetch(apiUrl("/admin/pacotes/restaurar"), {
      method: "POST",
      credentials: "include",
    })
    const json = await readJson(res)

    if (!res.ok) {
      toast.error(json.message ?? "Não foi possível restaurar.")
      return
    }

    toast.success(
      json.criados > 0
        ? `${json.criados} caixa(s) restaurada(s).`
        : "Todas as caixas de fábrica já existem."
    )
    await carregar()
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading>Caixas de envio</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Cada peça sai numa caixa. O frete usa o maior peso entre a caixa e a
            cubagem (volume ÷ 6000).
          </Text>
        </div>
        <div className="flex gap-2">
          <Button size="small" variant="secondary" onClick={restaurar}>
            Restaurar padrões
          </Button>
          <Button size="small" onClick={() => abrir()}>
            Nova caixa
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
        ) : pacotes.length === 0 ? (
          <LinhaVazia>
            Nenhuma caixa cadastrada — o checkout não consegue cotar o frete. Use
            “Restaurar padrões”.
          </LinhaVazia>
        ) : (
          pacotes.map((pacote) =>
            editando === pacote.id ? (
              <FormularioPacote
                key={pacote.id}
                rascunho={rascunho}
                salvando={salvando}
                onMudar={setRascunho}
                onSalvar={salvar}
                onFechar={fechar}
              />
            ) : (
              <LinhaPacote
                key={pacote.id}
                pacote={pacote}
                onEditar={() => abrir(pacote)}
                onDesativar={() => desativar(pacote)}
              />
            )
          )
        )}

        {editando === "novo" && (
          <FormularioPacote
            rascunho={rascunho}
            salvando={salvando}
            onMudar={setRascunho}
            onSalvar={salvar}
            onFechar={fechar}
          />
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

function LinhaPacote({
  pacote,
  onEditar,
  onDesativar,
}: {
  pacote: PacoteDaTela
  onEditar: () => void
  onDesativar: () => void
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <div>
        <div className="flex items-center gap-2">
          <Text weight="plus">{pacote.nome}</Text>
          {pacote.padrao && <Badge size="2xsmall">★ Padrão</Badge>}
          {!pacote.ativo && (
            <Badge size="2xsmall" color="orange">
              Desativada
            </Badge>
          )}
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          {pacote.altura_cm} × {pacote.largura_cm} × {pacote.comprimento_cm} cm ·{" "}
          {pesoExibido(pacote)}
        </Text>
      </div>
      <div className="flex gap-2">
        <Button size="small" variant="secondary" onClick={onEditar}>
          Editar
        </Button>
        {pacote.ativo && (
          <Button
            size="small"
            variant="transparent"
            onClick={onDesativar}
            disabled={!podeDesativar(pacote)}
            title={
              podeDesativar(pacote)
                ? undefined
                : "Marque outra como padrão antes de desativar esta."
            }
          >
            Desativar
          </Button>
        )}
      </div>
    </div>
  )
}

function FormularioPacote({
  rascunho,
  salvando,
  onMudar,
  onSalvar,
  onFechar,
}: {
  rascunho: RascunhoPacote
  salvando: boolean
  onMudar: (rascunho: RascunhoPacote) => void
  onSalvar: () => void
  onFechar: () => void
}) {
  const campo = (chave: keyof RascunhoPacote, rotulo: string) => (
    <div className="flex flex-col gap-1">
      <Label size="small">{rotulo}</Label>
      <Input
        type="number"
        value={String(rascunho[chave] ?? "")}
        onChange={(e) => onMudar({ ...rascunho, [chave]: e.target.value })}
      />
    </div>
  )

  return (
    <div className="px-6 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 flex flex-col gap-1">
          <Label size="small">Nome</Label>
          <Input
            value={rascunho.nome}
            onChange={(e) => onMudar({ ...rascunho, nome: e.target.value })}
            placeholder="Caixa padrão"
          />
        </div>
        {campo("peso_gramas", "Peso da embalagem (g)")}
        {campo("altura_cm", "Altura (cm)")}
        {campo("largura_cm", "Largura (cm)")}
        {campo("comprimento_cm", "Comprimento (cm)")}

        <div className="col-span-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch
              checked={rascunho.padrao}
              onCheckedChange={(padrao) => onMudar({ ...rascunho, padrao })}
            />
            <Label size="small">Caixa padrão (usada sem peso de variante)</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={rascunho.ativo}
              onCheckedChange={(ativo) => onMudar({ ...rascunho, ativo })}
            />
            <Label size="small">Ativa</Label>
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button size="small" onClick={onSalvar} isLoading={salvando}>
          Salvar
        </Button>
        <Button size="small" variant="secondary" onClick={onFechar}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Pacotes",
  icon: Tag,
})

export default PacotesPage
