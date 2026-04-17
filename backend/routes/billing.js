const router  = require('express').Router()
const stripe  = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { pool } = require('../db')
const { auth } = require('../middleware')

// POST /api/billing/checkout — cria sessão Stripe
router.post('/checkout', auth, async (req, res) => {
  try {
    const { rows: [tenant] } = await pool.query(`SELECT * FROM tenants WHERE id=$1`, [req.user.tenant_id])
    if (tenant.plano === 'pro') return res.status(400).json({ error: 'Já está no plano Pro' })

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: process.env.STRIPE_PRICE_PRO, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/dashboard?upgrade=ok`,
      cancel_url:  `${process.env.FRONTEND_URL}/precos`,
      customer_email: req.user.email,
      metadata: { tenant_id: String(req.user.tenant_id) },
      locale: 'pt-BR',
    })

    res.json({ url: session.url })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/billing/portal — portal de gerenciamento Stripe
router.get('/portal', auth, async (req, res) => {
  try {
    const { rows: [tenant] } = await pool.query(`SELECT stripe_customer FROM tenants WHERE id=$1`, [req.user.tenant_id])
    if (!tenant?.stripe_customer) return res.status(400).json({ error: 'Sem assinatura ativa' })

    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripe_customer,
      return_url: `${process.env.FRONTEND_URL}/dashboard`,
    })
    res.json({ url: session.url })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/billing/status
router.get('/status', auth, async (req, res) => {
  try {
    const { rows: [t] } = await pool.query(`SELECT plano, stripe_sub FROM tenants WHERE id=$1`, [req.user.tenant_id])
    res.json({ plano: t.plano, ativo: t.plano === 'pro' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/billing/webhook — Stripe envia eventos aqui
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature']
  let event

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (e) {
    console.error('[STRIPE] Webhook inválido:', e.message)
    return res.status(400).send(`Webhook Error: ${e.message}`)
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session   = event.data.object
      const tenant_id = session.metadata?.tenant_id
      if (tenant_id) {
        await pool.query(
          `UPDATE tenants SET plano='pro', stripe_customer=$1, stripe_sub=$2 WHERE id=$3`,
          [session.customer, session.subscription, tenant_id]
        )
        console.log(`[STRIPE] Upgrade pro: tenant ${tenant_id}`)
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object
      await pool.query(
        `UPDATE tenants SET plano='free', stripe_sub=null WHERE stripe_sub=$1`,
        [sub.id]
      )
      console.log(`[STRIPE] Downgrade free: sub ${sub.id}`)
    }

    if (event.type === 'invoice.payment_failed') {
      console.log(`[STRIPE] Pagamento falhou: ${event.data.object.customer}`)
    }
  } catch (e) {
    console.error('[STRIPE] Erro ao processar evento:', e.message)
  }

  res.json({ received: true })
})

module.exports = router
