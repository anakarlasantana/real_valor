"use client"

import { addToCart } from "@lib/data/cart"
import { useIntersection } from "@lib/hooks/use-in-view"
import { variantIsAvailable } from "@lib/util/product-availability"
import { coresDoProduto } from "@lib/util/product-enrichment"
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

const optionsAsKeymap = (
  variantOptions: HttpTypes.StoreProductVariant["options"]
) => {
  return variantOptions?.reduce((acc: Record<string, string>, varopt: any) => {
    acc[varopt.option_id] = varopt.value
    return acc
  }, {})
}

export default function ProductActions({
  product,
  disabled,
}: ProductActionsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [options, setOptions] = useState<Record<string, string | undefined>>({})
  const [isAdding, setIsAdding] = useState(false)
  const countryCode = useParams().countryCode as string

  // If there is only 1 variant, preselect the options
  useEffect(() => {
    if (product.variants?.length === 1) {
      const variantOptions = optionsAsKeymap(product.variants[0].options)
      setOptions(variantOptions ?? {})
    }
  }, [product.variants])

  const selectedVariant = useMemo(() => {
    if (!product.variants || product.variants.length === 0) {
      return
    }

    return product.variants.find((v) => {
      const variantOptions = optionsAsKeymap(v.options)
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
      const variantOptions = optionsAsKeymap(v.options)
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
          única já vem resolvida (o `useEffect` acima), e uma fileira de um botão
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

      <button
        type="button"
        onClick={handleAddToCart}
        disabled={
          !inStock || !selectedVariant || !!disabled || isAdding || !isValidVariant
        }
        className="rv-btn rv-btn-primary rv-add-button"
        data-testid="add-product-button"
      >
        {isAdding
          ? "Adicionando…"
          : !selectedVariant && !options
            ? "Selecione o tamanho"
            : !inStock || !isValidVariant
              ? "Esgotado"
              : "Comprar"}
      </button>

      {/*
        O frete e o prazo, **abaixo do botão** — a última pergunta de quem decide
        ("chega até mim?"), e a que não precisa de resposta para a compra
        acontecer.

        A referência desenha aqui um campo de CEP que responde "3 a 5 dias úteis,
        grátis" para qualquer CEP digitado: não é cálculo, é promessa por escrito,
        e é por isso que este bloco nunca foi portado. Ele agora está montado com o
        contrato invertido — só aparece com **opção de entrega real** calculada
        para o CEP (ver `shipping-quote`), e sem ela devolve `null`. O dado vem das
        opções de frete da região, e o adapter que as calcula para o CEP é o
        próximo lote; hoje o bloco nasce desligado, e o que a página diz sobre
        entrega continua sendo o acordeão "Entrega e trocas", em pt-BR e sem pedir
        dado nenhum à cliente.
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
