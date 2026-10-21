"use client"

import { addToCart } from "@lib/data/cart"
import { useIntersection } from "@lib/hooks/use-in-view"
import {
  escolhaInicial,
  opcoesDaVariante,
  variantIsAvailable,
  type VarianteEscolhivel,
} from "@lib/catalog/product-availability"
import { coresDoProduto } from "@lib/catalog/product-enrichment"
import { HttpTypes } from "@medusajs/types"
import OptionSelect from "@modules/products/components/product-actions/option-select"
import { isEqual } from "lodash"
import { useParams, usePathname, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import ProductPrice from "../product-price"
import ProductStatusChip from "../product-status-chip"
import ShippingQuote from "../shipping-quote"
import MobileActions from "./mobile-actions"
import { useRouter } from "next/navigation"

type ProductActionsProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  disabled?: boolean
}

export default function ProductActions({
  product,
  disabled,
}: ProductActionsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  /** O estado nasce da escolha inicial, não de `{}` (RV-030). */
  const inicial = useMemo(
    () =>
      escolhaInicial(
        product.variants as VarianteEscolhivel[] | null | undefined,
        searchParams.get("v_id")
      ),
    // Só a montagem interessa: depois quem manda é o clique da cliente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [product.variants]
  )

  const [options, setOptions] = useState<Record<string, string | undefined>>(
    inicial?.options ?? {}
  )
  const [isAdding, setIsAdding] = useState(false)
  const countryCode = useParams().countryCode as string

  // `?v_id=` que chega depois da montagem (o Next reaproveita o componente).
  const vIdDaUrl = searchParams.get("v_id")

  useEffect(() => {
    if (!vIdDaUrl) {
      return
    }

    const daUrl = (product.variants ?? []).find((v) => v.id === vIdDaUrl)

    if (!daUrl) {
      return
    }

    setOptions((atual) => {
      const novo = opcoesDaVariante(daUrl.options)
      return isEqual(atual, novo) ? atual : novo
    })
  }, [vIdDaUrl, product.variants])

  const selectedVariant = useMemo(() => {
    if (!product.variants || product.variants.length === 0) {
      return
    }

    return product.variants.find((v) => {
      const variantOptions = opcoesDaVariante(v.options)
      return isEqual(variantOptions, options)
    })
  }, [product.variants, options])

  // update the options when a variant is selected
  const setOptionValue = (optionId: string, value: string) => {
    setOptions((prev) => ({
      ...prev,
      [optionId]: value,
    }))
  }

  //check if the selected options produce a valid variant
  const isValidVariant = useMemo(() => {
    return product.variants?.some((v) => {
      const variantOptions = opcoesDaVariante(v.options)
      return isEqual(variantOptions, options)
    })
  }, [product.variants, options])

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    const value = isValidVariant ? selectedVariant?.id : null

    if (params.get("v_id") === value) {
      return
    }

    if (value) {
      params.set("v_id", value)
    } else {
      params.delete("v_id")
    }

    router.replace(pathname + "?" + params.toString())
  }, [selectedVariant, isValidVariant])

  // check if the selected variant is in stock
  //
  // A regra é a do `product-availability` — não uma cópia dela. Ela é a mesma
  // que decide o chip do card ("Pronta entrega", "Esgotado"), e ter as duas
  // contas em arquivos diferentes era o caminho curto para o card prometer o
  // que este botão recusa.
  const inStock = useMemo(
    () => variantIsAvailable(selectedVariant),
    [selectedVariant]
  )

  const actionsRef = useRef<HTMLDivElement>(null)

  const inView = useIntersection(actionsRef, "0px")

  // As cores da peça para o seletor — a MESMA função do card (`coresDoProduto`,
  // que junta a opção com o `metadata.hex` da variante). Calculada uma vez e
  // entregue a todas as opções: quem decide se desenha bolinha ou botão de texto
  // é o `OptionSelect`, com a mesma `ehTituloDeCor` que o card usa.
  const cores = coresDoProduto(product)

  const textoDoBotao = (): string => {
    if (isAdding) {
      return "Adicionando…"
    }

    if (!isValidVariant) {
      return "Selecione o tamanho"
    }

    return inStock && selectedVariant ? "Comprar" : "Esgotado"
  }

  // add the selected variant to the cart
  const handleAddToCart = async () => {
    if (!selectedVariant?.id) return null

    setIsAdding(true)

    await addToCart({
      variantId: selectedVariant.id,
      quantity: 1,
      countryCode,
    })

    setIsAdding(false)
  }

  return (
    <div className="flex flex-col" ref={actionsRef}>
      {/* O preço abre o resumo, logo abaixo do título: é a primeira pergunta
          depois de "que peça é essa". */}
      <ProductPrice product={product} variant={selectedVariant} />

      {/* O chip logo abaixo do preço: o estado da peça é a última informação
          antes da decisão, e é aqui que ele responde "e se eu clicar?". Ele é do
          produto (não do variant selecionado) — é o que o lojista escreveu no
          catálogo, ou o que o estoque do produto diz. */}
      <div className="mb-2 flex items-center">
        <ProductStatusChip product={product} />
      </div>

      {/* Os seletores só aparecem quando há escolha a fazer: peça de variante
          única já vem resolvida pela `escolhaInicial`, e uma fileira de um botão
          só é ruído entre o preço e o botão de comprar. */}
      {(product.variants?.length ?? 0) > 1 && (
        <div className="flex flex-col">
          {(product.options || []).map((option) => (
            <OptionSelect
              key={option.id}
              option={option}
              current={options[option.id]}
              updateOption={setOptionValue}
              title={option.title ?? ""}
              cores={cores}
              data-testid="product-options"
              disabled={!!disabled || isAdding}
            />
          ))}
        </div>
      )}

      {isValidVariant && selectedVariant && !inStock && (
        <p className="mb-2 text-sm text-rv-rose" data-testid="aviso-esgotado">
          Esta combinação está esgotada — escolha outra cor ou tamanho.
        </p>
      )}

      <button
        type="button"
        onClick={handleAddToCart}
        disabled={
          !inStock || !selectedVariant || !!disabled || isAdding || !isValidVariant
        }
        className="rv-btn rv-btn-primary rv-add-button"
        data-testid="add-product-button"
      >
        {textoDoBotao()}
      </button>

      {/*
        O frete abaixo do botão ("chega até mim?"). O contrato é o invertido: só
        aparece com opção de entrega real calculada para o CEP (`shipping-quote`),
        e sem ela devolve `null` — a promessa fixa da referência não foi portada.
      */}
      <ShippingQuote />

      <MobileActions
        product={product}
        variant={selectedVariant}
        options={options}
        updateOptions={setOptionValue}
        inStock={inStock}
        handleAddToCart={handleAddToCart}
        isAdding={isAdding}
        show={!inView}
        optionsDisabled={!!disabled || isAdding}
      />
    </div>
  )
}
