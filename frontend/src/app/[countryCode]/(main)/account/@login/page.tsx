import { Metadata } from "next"

import LoginTemplate from "@modules/account/templates/login-template"

export const metadata: Metadata = {
  title: "Entrar",
  description: "Entre na sua conta Real Valor.",
}

export default function Login() {
  return <LoginTemplate />
}
