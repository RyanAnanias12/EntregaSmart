# 🚚 Smart Entregas v3 — SaaS

Sistema SaaS completo para motoristas de logística.

**Stack:** Node.js · Express · PostgreSQL · JWT · Resend · Stripe · React · Vite

---

## ✨ Funcionalidades

- **Multi-tenant** — cada equipe tem dados completamente isolados
- **Auth JWT** — login com email/senha, token 7 dias
- **Multi-veículo** — cadastre carros/motos com consumos diferentes
- **Multi-plataforma** — Mercado Livre, Shopee, Amazon Logistics
- **Rateio automático** — piloto 60% · copiloto 40% do lucro
- **Emails automáticos** — nova rota, rota concluída, resumo semanal (Resend)
- **Stripe** — plano Pro R$ 14,90/mês com portal de gerenciamento
- **Dashboard** — gráficos de faturamento, plataformas, ganho por pessoa
- **Filtros avançados** — data, piloto, plataforma, status, ponto de coleta
- **Responsivo** — funciona perfeitamente no celular

---

## ⚙️ Variáveis de ambiente (backend)

```env
DATABASE_URL=postgresql://...
JWT_SECRET=chave_longa_aqui
NODE_ENV=production

# Resend (emails)
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@seudominio.com

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_1TNB5EJQUbxEDxUNHKlrWBiB

# URLs
FRONTEND_URL=https://seu-frontend.vercel.app
```

**Frontend (Vercel):**
```env
VITE_API_URL=https://seu-backend.railway.app/api
```

---

## ▶️ Rodar localmente

```bash
# Backend
cd backend && npm install
cp .env.example .env  # preenche as variáveis
npm run dev           # porta 3001

# Frontend (outro terminal)
cd frontend && npm install
npm run dev           # porta 5173
```

---

## 🚀 Deploy

**Backend → Railway**
- Root Directory: vazio (usa railway.toml)
- Adiciona as variáveis de ambiente
- Porta: automática (não definir PORT)
- Gera domínio público em Settings → Networking

**Frontend → Vercel**
- Root Directory: `frontend`
- Build: `npm run build`
- Output: `dist`
- Adiciona `VITE_API_URL`

**Stripe Webhook**
No Stripe Dashboard → Developers → Webhooks → Add endpoint:
```
https://seu-backend.railway.app/api/billing/webhook
```
Eventos: `checkout.session.completed`, `customer.subscription.deleted`, `invoice.payment_failed`

---

## 📧 Resend (emails)

1. Crie conta em resend.com
2. Adicione e verifique seu domínio
3. Crie uma API Key
4. Configure `RESEND_API_KEY` e `EMAIL_FROM`

Emails enviados automaticamente:
- Boas-vindas ao cadastrar
- Notificação quando rota é criada
- Notificação com rateio quando rota é concluída
- Resumo semanal toda segunda às 08h BRT

---

## 💳 Stripe

price_id configurado: `price_1TNB5EJQUbxEDxUNHKlrWBiB` (R$ 14,90/mês)

Fluxo: usuário clica "Assinar Pro" → redireciona para Stripe Checkout → após pagamento Stripe chama webhook → plano atualizado para `pro` no banco.

---

## 👨‍💻 Desenvolvido por Ryan
