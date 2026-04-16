require('dotenv').config()
const express = require('express')
const cors    = require('cors')
const { initDB } = require('./db')
const { initCron } = require('./cron')

const app  = express()
const PORT = process.env.PORT || 3001

app.use(cors())

// Webhook Stripe precisa do body cru ANTES do json parser
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }))
app.use(express.json())

app.use('/api/auth',     require('./routes/auth'))
app.use('/api/rotas',    require('./routes/rotas'))
app.use('/api/veiculos', require('./routes/veiculos'))
app.use('/api/usuarios', require('./routes/usuarios'))
app.use('/api/gastos',   require('./routes/gastos'))
app.use('/api/billing',  require('./routes/billing'))

app.get('/api/health', (_, res) => res.json({ ok: true, ts: new Date() }))

async function start() {
  try {
    await initDB()
    initCron()
    app.listen(PORT, () => console.log(`[API] http://localhost:${PORT}`))
  } catch (e) {
    console.error('[FATAL]', e)
    process.exit(1)
  }
}

start()
