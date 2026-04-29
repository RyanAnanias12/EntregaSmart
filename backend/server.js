require('dotenv').config()
const express = require('express')
const cors    = require('cors')
const { initDB } = require('./db')

const app  = express()
const PORT = process.env.PORT || 3001

app.use(cors())
// Webhooks precisam do body raw
app.use('/api/billing/webhook/stripe', express.raw({ type: '*/*' }))
app.use('/api/billing/webhook/mp',     express.raw({ type: '*/*' }))
app.use(express.json())

app.use('/api/auth',          require('./routes/auth'))
app.use('/api/rotas',         require('./routes/rotas'))
app.use('/api/veiculos',      require('./routes/veiculos'))
app.use('/api/gastos',        require('./routes/gastos'))
app.use('/api/usuarios',      require('./routes/usuarios'))
app.use('/api/billing',       require('./routes/billing'))
app.use('/api/despesas',      require('./routes/despesas'))
app.use('/api/abastecimentos',require('./routes/abastecimentos'))
app.use('/api/bonificacoes',  require('./routes/bonificacoes'))
app.use('/api/streak',        require('./routes/streak'))
app.use('/api/onboarding',    require('./routes/onboarding'))
app.use('/api/combustivel',   require('./routes/combustivel'))
app.get('/api/health', (_, res) => res.json({ ok: true, ts: new Date() }))

async function start() {
  try {
    await initDB()
    if (process.env.NODE_ENV !== 'test') require('./cron')
    app.listen(PORT, () => console.log(`[API] :${PORT}`))
  } catch(e) { console.error('[FATAL]', e); process.exit(1) }
}
start()
