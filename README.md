# Real Valor — E-commerce de Moda Feminina (Medusa v2 + Next.js 15)

Este projeto implementa a loja virtual de moda feminina **Real Valor**, baseada no ecossistema **Medusa v2** (backend headless) com storefront em **Next.js 15 (App Router)** e banco de dados PostgreSQL containerizado.

---

## 🚀 Como Iniciar Tudo com 1 Comando

Para subir o banco de dados PostgreSQL, o cache Redis, o backend Medusa v2 e a loja em Next.js:

```bash
./start.sh
```

Para encerrar todos os serviços:
```bash
./stop.sh
```

---

## 🌐 Endereços de Acesso

| Serviço | URL | Credenciais / Notas |
| :--- | :--- | :--- |
| **Loja Storefront (Next.js)** | [http://localhost:8000](http://localhost:8000) | Vitrine e catálogo nacional (BRL) |
| **Catálogo de Roupas** | [http://localhost:8000/br/store](http://localhost:8000/br/store) | Vestidos, Camisas e Alfaiataria |
| **Painel Admin Medusa v2** | [http://localhost:9000/app](http://localhost:9000/app) | **E-mail**: `admin@realvalor.com.br`<br>**Senha**: `admin123456` |
| **Store API** | [http://localhost:9000/store](http://localhost:9000/store) | API REST consumida pelo frontend |

---

## 👗 Funcionalidades Ativas

1. **Catálogo Real Valor (Moda Feminina)**:
   - Produtos cadastrados com fotos em alta definição, tabela de medidas (Guia de tamanhos P, M, G, GG), etiqueta "Pronta Entrega" e composição do tecido.
   - Categorias cadastradas: *Vestidos*, *Blusas & Camisas*, *Calças & Alfaiataria*, *Conjuntos*.
2. **Moeda e Região**:
   - Moeda padrão: **BRL (R$)**.
   - Frete configurado para todo o Brasil (Econômico - PAC e Expresso - SEDEX).
3. **Guest Checkout (Sem Fricção de Login)**:
   - Subscriber de catalogação automática do cliente (`src/subscribers/order-customer-indexer.ts`) utilizando E-mail + CPF.
   - Endpoint de rastreamento de compras sem necessidade de senha: `GET /store/orders/track?display_id=X&cpf=...`.
4. **Arquitetura Modular**:
   - `backend/medusa-config.ts` estruturado de forma desacoplada para conexão de plugins de pagamento (ex: Mercado Pago) e frete assim que definidos.
