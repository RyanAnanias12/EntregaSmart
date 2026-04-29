const router   = require('express').Router()
const stripe   = require('stripe')(process.env.STRIPE_SECRET_KEY || '')
const { pool } = require('../db')
const { auth } = require('../middleware')

// Planos Stripe (mensal — recorrente)
const STRIPE_PRICES = {
  solo: process.env.STRIPE_PRICE_SOLO,
  pro:  process.env.STRIPE_PRICE_PRO,
}

// Planos anuais via Mercado Pago (pagamento único + PIX)
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago')
const mp = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN || '' })

const MP_PRICES = {
  solo: { valor: 89.00,  label: 'Smart Entregas Solo — Plano Anual',  plano: 'solo' },
  pro:  { valor: 134.00, label: 'Smart Entregas Pro — Plano Anual',   plano: 'pro'  },
}

// POST /api/billing/checkout
router.post('/checkout', auth, async (req, res) => {
  const { plano = 'pro', periodo = 'mensal' } = req.body

  const { rows: [tenant] } = await pool.query(`SELECT * FROM tenants WHERE id=$1`, [req.user.tenant_id])

  // ── ANUAL → Mercado Pago com PIX ──────────────────────────────────────────
  if (periodo === 'anual') {
    const config = MP_PRICES[plano]
    if (!config) return res.status(400).json({ error: 'Plano inválido' })
    try {
      const pref   = new Preference(mp)
      const result = await pref.create({
        body: {
          items: [{
            id:          `${plano}_anual`,
            title:       config.label,
            quantity:    1,
            unit_price:  config.valor,
            currency_id: 'BRL',
          }],
          payer: { email: req.user.email },
          payment_methods: { installments: 1 },
          back_urls: {
            success: `${process.env.FRONTEND_URL}/dashboard?upgrade=ok`,
            failure: `${process.env.FRONTEND_URL}/precos?erro=pagamento`,
            pending: `${process.env.FRONTEND_URL}/precos?pendente=1`,
          },
          auto_return:        'approved',
          external_reference: JSON.stringify({ tenant_id: req.user.tenant_id, plano, anual: true }),
          statement_descriptor: 'SMART ENTREGAS',
        }
      })
      return res.json({ url: result.init_point, metodo: 'mp' })
    } catch(e) { return res.status(500).json({ error: e.message }) }
  }

  // ── MENSAL → Stripe (cartão + boleto, recorrente) ─────────────────────────
  const priceId = STRIPE_PRICES[plano]
  if (!priceId) return res.status(500).json({ error: `Price ID do plano ${plano} não configurado` })
  if (tenant.plano === plano) return res.status(400).json({ error: `Já está no plano ${plano}` })

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card', 'boleto'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/dashboard?upgrade=ok`,
      cancel_url:  `${process.env.FRONTEND_URL}/precos`,
      customer_email: req.user.email,
      metadata: { tenant_id: String(req.user.tenant_id), plano },
      locale: 'pt-BR',
    })
    return res.json({ url: session.url, metodo: 'stripe' })
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

// POST /api/billing/webhook — Stripe
router.post('/webhook/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature']
  let event
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch(e) { return res.status(400).send(`Webhook Error: ${e.message}`) }

  try {
    if (event.type === 'checkout.session.completed') {
      const s = event.data.object
      const tenant_id = s.metadata?.tenant_id
      const plano     = s.metadata?.plano || 'pro'
      if (tenant_id) {
        const expira = new Date(Date.now() + 30*24*60*60*1000)
        await pool.query(
          `UPDATE tenants SET plano=$1, stripe_customer=$2, stripe_sub=$3, plano_expira_em=$4 WHERE id=$5`,
          [plano, s.customer, s.subscription, expira, tenant_id]
        )
        console.log(`[Stripe] Upgrade ${plano}: tenant ${tenant_id}`)
      }
    }
    if (event.type === 'customer.subscription.deleted') {
      await pool.query(
        `UPDATE tenants SET plano='free', stripe_sub=null WHERE stripe_sub=$1`,
        [event.data.object.id]
      )
    }
    if (event.type === 'invoice.payment_failed') {
      console.log(`[Stripe] Pagamento falhou: ${event.data.object.customer}`)
    }
  } catch(e) { console.error('[Stripe]', e.message) }

  res.json({ received: true })
})

// POST /api/billing/webhook/mp — Mercado Pago (anual)
router.post('/webhook/mp', async (req, res) => {
  try {
    const { type, data } = req.body
    if (type === 'payment') {
      const payment = new Payment(mp)
      const p = await payment.get({ id: data.id })
      if (p.status === 'approved' && p.external_reference) {
        const ref    = JSON.parse(p.external_reference)
        const expira = new Date(Date.now() + 365*24*60*60*1000)
        await pool.query(
          `UPDATE tenants SET plano=$1, mp_payment_id=$2, plano_expira_em=$3 WHERE id=$4`,
          [ref.plano, String(p.id), expira, ref.tenant_id]
        )
        console.log(`[MP] Anual aprovado: ${ref.plano} tenant ${ref.tenant_id}`)
      }
    }
    res.json({ ok: true })
  } catch(e) { console.error('[MP]', e.message); res.status(500).json({ error: e.message }) }
})

// GET /api/billing/status
router.get('/status', auth, async (req, res) => {
  try {
    const { rows: [t] } = await pool.query(`SELECT plano, plano_expira_em FROM tenants WHERE id=$1`, [req.user.tenant_id])
    res.json({ plano: t.plano, ativo: ['pro','solo'].includes(t.plano), expira_em: t.plano_expira_em })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// GET /api/billing/portal — gerenciar assinatura Stripe
router.get('/portal', auth, async (req, res) => {
  try {
    const { rows: [t] } = await pool.query(`SELECT stripe_customer FROM tenants WHERE id=$1`, [req.user.tenant_id])
    if (!t?.stripe_customer) return res.json({ url: `${process.env.FRONTEND_URL}/precos` })
    const session = await stripe.billingPortal.sessions.create({
      customer:   t.stripe_customer,
      return_url: `${process.env.FRONTEND_URL}/dashboard`,
    })
    res.json({ url: session.url })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
