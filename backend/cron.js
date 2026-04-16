const cron = require('node-cron')
const { pool } = require('./db')
const { enviarResumoSemanal } = require('./email')

function calcRateio(lucro, piloto, copiloto) {
  const liq = parseFloat(lucro) || 0
  return [
    { nome: piloto,   valor: parseFloat((liq * 0.60).toFixed(2)) },
    { nome: copiloto, valor: parseFloat((liq * 0.40).toFixed(2)) },
  ]
}

async function rodarResumoSemanal() {
  console.log('[CRON] Iniciando resumo semanal...')
  try {
    const hoje   = new Date()
    const dom    = new Date(hoje); dom.setDate(hoje.getDate() - hoje.getDay() - 7)
    const sab    = new Date(dom);  sab.setDate(dom.getDate() + 6)
    const ini    = dom.toISOString().slice(0, 10)
    const fim    = sab.toISOString().slice(0, 10)
    const periodo = `${ini.split('-').reverse().join('/')} a ${fim.split('-').reverse().join('/')}`

    const { rows: tenants } = await pool.query(`SELECT id, nome FROM tenants WHERE ativo=true`)

    for (const tenant of tenants) {
      const { rows: [stats] } = await pool.query(`
        SELECT COUNT(*) as total_rotas,
               COALESCE(SUM(valor_total),0)      as total_bruto,
               COALESCE(SUM(lucro_liquido),0)     as total_liquido,
               COALESCE(SUM(kms),0)               as total_kms,
               COALESCE(SUM(pacotes_entregues),0) as total_entregues
        FROM rotas WHERE tenant_id=$1 AND data_rota BETWEEN $2 AND $3
      `, [tenant.id, ini, fim])

      if (parseInt(stats.total_rotas) === 0) continue

      const { rows: rotasSem } = await pool.query(
        `SELECT piloto, copiloto, lucro_liquido FROM rotas WHERE tenant_id=$1 AND data_rota BETWEEN $2 AND $3`,
        [tenant.id, ini, fim]
      )
      const acc = {}
      rotasSem.forEach(r => {
        calcRateio(r.lucro_liquido, r.piloto, r.copiloto).forEach(p => {
          acc[p.nome] = (acc[p.nome] || 0) + p.valor
        })
      })
      const rateio = Object.entries(acc).sort((a, b) => b[1] - a[1]).map(([nome, valor]) => ({ nome, valor: parseFloat(valor.toFixed(2)) }))

      const { rows: usuarios } = await pool.query(`SELECT email FROM usuarios WHERE tenant_id=$1 AND ativo=true`, [tenant.id])
      const emails = usuarios.map(u => u.email)

      await enviarResumoSemanal(stats, rateio, emails, tenant.nome, periodo)
      console.log(`[CRON] Resumo enviado: ${tenant.nome} (${emails.length} emails)`)
    }
  } catch (e) {
    console.error('[CRON] Erro:', e.message)
  }
}

function initCron() {
  if (!process.env.RESEND_API_KEY) {
    console.log('[CRON] RESEND_API_KEY não configurado — emails desativados')
    return
  }
  // Toda segunda às 08h BRT
  cron.schedule('0 8 * * 1', rodarResumoSemanal, { timezone: 'America/Sao_Paulo' })
  console.log('[CRON] Resumo semanal agendado (seg 08h BRT)')
}

module.exports = { initCron }