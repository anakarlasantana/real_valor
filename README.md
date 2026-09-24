# Real Valor — E-commerce de Moda Feminina (Medusa v2)

Este repositório contém a infraestrutura e o backend headless da **Real Valor**, construído sobre o **Medusa v2**, configurado para o mercado brasileiro e otimizado para **Guest Checkout (compra sem senha via CPF + E-mail + WhatsApp)**.

---

## 🚀 Como Subir o Projeto Localmente com 1 Comando

### Pré-requisitos:
- Docker e Docker Compose instalados.

### 1. Iniciar os Serviços
Na raiz do projeto (`real_valor`):

```bash
docker compose up -d
```
ou
```bash
make up
```

Isso inicializará:
- **PostgreSQL 16** (`real_valor_postgres`) na porta `5434`
- **Redis 7** (`real_valor_redis`) na porta `6381`
- **Backend Medusa v2** (`real_valor_backend`) na porta `9000`

### 2. Acessos
- **Medusa Admin (Painel Administrativo)**: [http://localhost:9000/app](http://localhost:9000/app)
  - **E-mail padrão**: `admin@realvalor.com.br`
  - **Senha padrão**: `admin123456`
- **Store API**: [http://localhost:9000/store](http://localhost:9000/store)
- **Endpoint Rastreamento de Pedido sem Login**: `GET http://localhost:9000/store/orders/track?display_id=1&cpf=00000000000`
- **Endpoint Info da Loja**: `GET http://localhost:9000/store/custom/checkout-info`

### 3. Popular o Catálogo de Roupas Femininas (Seed)
Para cadastrar as categorias (*Vestidos*, *Blusas*, *Calças*, *Conjuntos*), opções de cores e tamanhos (P, M, G, GG), estoques e métodos de frete (PAC e SEDEX):

```bash
docker compose exec backend yarn seed
# ou
make seed
```

---

## 🛠️ Arquitetura do Backend

- `backend/src/subscribers/order-customer-indexer.ts`: Indexa e cataloga clientes automaticamente a cada pedido concluído sem exigir cadastro prévio ou senha, usando **E-mail + CPF**.
- `backend/src/api/store/orders/track/route.ts`: Permite ao consumidor final rastrear status de entrega, transportadora e itens do pedido apenas com o Número do Pedido + CPF ou E-mail.
- `backend/src/api/store/custom/checkout-info/route.ts`: Retorna regras de parcelamento, desconto no PIX e dados cadastrais da loja.
- `backend/src/scripts/seed.ts`: Seed completo parametrizado para moeda BRL, frete nacional, fotos e metadados de roupas femininas (Guia de Medidas e Composição).
- `backend/medusa-config.ts`: Estrutura modular preparada para conectar plugins de pagamento e frete assim que definidos.
