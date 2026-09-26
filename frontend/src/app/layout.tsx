import { getBaseURL } from "@lib/util/env"
import { getActiveTheme, themeToCSSVariables } from "@lib/theme"
import { Metadata } from "next"
import localFont from "next/font/local"
import "styles/globals.css"

/* Brand typography — per ./Downloads/identidade_realvalor
 * Playfair Display: titulos e destaques
 * Montserrat:       textos e interface
 * Allura:           assinaturas e frases
 *
 * As fontes sao SELF-HOSTED (src/app/fonts/) em vez de next/font/google:
 * o loader do Google baixa o CSS da API na hora do BUILD, e uma resposta
 * truncada/instavel quebra o build com
 * `TypeError: Cannot read properties of null (reading '1')`
 * (next-font-loader/index.js -> @next/font/google/loader.js:122, regex de
 * extensao sobre uma URL sem extensao). Os 3 .woff2 abaixo sao binariamente
 * identicos aos arquivos servidos pelo Google (ver src/app/fonts/README.md).
 * Sao fontes variaveis do subset `latin`, um arquivo por familia, cobrindo
 * a faixa de pesos abaixo. Licenca SIL OFL 1.1 — OFL.txt ao lado de cada.
 */
const playfair = localFont({
  src: "./fonts/playfair-display/playfair-display-latin.woff2",
  display: "swap",
  variable: "--font-playfair",
  weight: "400 700",
})

const montserrat = localFont({
  src: "./fonts/montserrat/montserrat-latin.woff2",
  display: "swap",
  variable: "--font-montserrat",
  weight: "300 700",
})

const allura = localFont({
  src: "./fonts/allura/allura-latin.woff2",
  display: "swap",
  variable: "--font-allura",
  weight: "400",
})

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
  title: {
    default: "Real Valor — Alfaiataria Feminina",
    template: "%s | Real Valor",
  },
  description:
    "A alfaiataria que valoriza você, não o seu status. Vista o seu valor.",
  applicationName: "Real Valor",
  openGraph: {
    type: "website",
    siteName: "Real Valor",
    title: "Real Valor — Alfaiataria Feminina",
    description:
      "A alfaiataria que valoriza você, não o seu status. Vista o seu valor.",
    locale: "pt_BR",
  },
  icons: {
    icon: "/favicon.ico",
  },
}

export default function RootLayout(props: { children: React.ReactNode }) {
  const theme = getActiveTheme()

  return (
    <html
      lang="pt-BR"
      data-mode="light"
      data-theme={theme.id}
      className={`${playfair.variable} ${montserrat.variable} ${allura.variable}`}
      style={themeToCSSVariables(theme) as React.CSSProperties}
    >
      <body>
        <main className="relative">{props.children}</main>
      </body>
    </html>
  )
}

