<div align="center">
  <img src="https://smartentregas.online/logo.png" alt="Smart Entregas" width="120"/>

  # Smart Entregas

  **Gestão financeira e operacional para motoristas de Mercado Livre, Shopee e Amazon**

  [![Deploy](https://img.shields.io/badge/deploy-vercel-black?logo=vercel)](https://smartentregas.online)
  [![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

  [smartentregas.online](https://smartentregas.online)
</div>

---

## Sobre

O Smart Entregas nasceu de uma dor real. Motoristas de entrega terminam o dia sem saber quanto realmente lucraram — depois de descontar combustível, divisão de equipe e despesas.

A plataforma resolve isso: o motorista registra a rota em menos de 30 segundos e vê o lucro real na hora. Sem planilha, sem chute, sem surpresa no fim do mês.

Hoje em produção com usuários ativos e crescimento por indicação.

---

## Funcionalidades

- Cálculo automático de lucro líquido por rota descontando combustível
- Rateio automático entre piloto e copiloto
- Dashboard financeiro com metas, comparativo semanal e gráficos
- Comparativo inteligente entre plataformas — qual paga mais por pacote
- Ranking de dias da semana com maior rendimento
- Controle de frota com alerta automático de revisão por KM
- Relatórios e resumos enviados automaticamente por email
- Sistema de indicação com desconto
- PWA instalável no celular
- Trial Pro de 7 dias gratuito sem cartão

---

## Stack

**Frontend:** React · Vite · PWA

**Backend:** Node.js · Express · PostgreSQL

**Infra:** Vercel · Supabase · Resend

---

## Como rodar localmente

```bash
# Backend
cd backend
npm install
cp .env.example .env
npm run dev

# Frontend
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Preencha as variáveis necessárias nos arquivos `.env`. Veja `.env.example` em cada pasta.

---

## Licença

MIT © [Ryan Afonso Ananias de Sena](https://github.com/RyanAnanias12)
