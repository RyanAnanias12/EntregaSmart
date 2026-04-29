const router   = require('express').Router()
const { pool } = require('../db')
const { auth } = require('../middleware')

// GET /api/streak — retorna streak atual + mapa de calor
router.get('/', auth, async (req, res) => {
  try {
    const tid = req.user.tenant_id

    // Streak atual
    const { rows: [t] } = await pool.query(
      `SELECT streak_dias, streak_ultima_data FROM tenants WHERE id=$1`, [tid]
    )

    // Mapa de calor — últimos 84 dias (12 semanas)
    const { rows: calor } = await pool.query(`
      SELECT (data_rota AT TIME ZONE 'America/Sao_Paulo')::date::text as data,
             COUNT(*) as rotas,
             COALESCE(SUM(lucro_liquido),0) as lucro
      FROM rotas
      WHERE tenant_id=$1
        AND status='concluida'
        AND data_rota >= CURRENT_DATE - INTERVAL '84 days'
      GROUP BY (data_rota AT TIME ZONE 'America/Sao_Paulo')::date
      ORDER BY 1 ASC
    `, [tid])

    // Recalcular streak real — aceita hoje ou ontem como ponto de partida
    const { rows: dias } = await pool.query(`
      SELECT DISTINCT data_rota::text as data
      FROM rotas
      WHERE tenant_id=$1 AND status='concluida'
      ORDER BY data_rota DESC
      LIMIT 365
    `, [tid])

    let streak = 0
    if (dias.length > 0) {
      // Pega data do banco em timezone local do servidor (UTC-3)
      const agoraBR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
      const hojeBR  = agoraBR.toISOString().slice(0,10)
      const ontemBR = new Date(agoraBR.setDate(agoraBR.getDate()-1)).toISOString().slice(0,10)

      // Permite começar do hoje ou do ontem (motorista que ainda não rodou hoje)
      const primeiroData = dias[0].data
      let offset = 0
      if (primeiroData === hojeBR)  offset = 0
      else if (primeiroData === ontemBR) offset = 1
      else { streak = 0; offset = null }

      if (offset !== null) {
        const base = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
        for (let i = 0; i < dias.length; i++) {
          const esperado = new Date(base)
          esperado.setDate(base.getDate() - (i + offset))
          const esperadoStr = esperado.toISOString().slice(0,10)
          if (dias[i].data === esperadoStr) streak++
          else break
        }
      }
    }

    // Atualiza streak no banco
    await pool.query(
      `UPDATE tenants SET streak_dias=$1, streak_ultima_data=CURRENT_DATE WHERE id=$2`,
      [streak, tid]
    )

    res.json({ streak, mapa: calor })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// GET /api/streak/comparativo — semana atual vs anterior
router.get('/comparativo', auth, async (req, res) => {
  try {
    const tid = req.user.tenant_id
    const hoje = new Date()
    const diaSemana = hoje.getDay() // 0=dom
    const inicioSemanaAtual = new Date(hoje)
    inicioSemanaAtual.setDate(hoje.getDate() - diaSemana)

    const inicioSemanaAnterior = new Date(inicioSemanaAtual)
    inicioSemanaAnterior.setDate(inicioSemanaAtual.getDate() - 7)
    const fimSemanaAnterior = new Date(inicioSemanaAtual)
    fimSemanaAnterior.setDate(inicioSemanaAtual.getDate() - 1)

    const q = async (ini, fim) => {
      const { rows: [r] } = await pool.query(`
        SELECT
          COALESCE(SUM(lucro_liquido),0) as lucro,
          COALESCE(SUM(valor_total),0)   as bruto,
          COUNT(*) as rotas,
          COALESCE(SUM(pacotes_entregues),0) as pacotes
        FROM rotas
        WHERE tenant_id=$1 AND status='concluida'
          AND data_rota BETWEEN $2 AND $3
      `, [tid, ini.toISOString().slice(0,10), fim.toISOString().slice(0,10)])
      return r
    }

    const atual    = await q(inicioSemanaAtual, hoje)
    const anterior = await q(inicioSemanaAnterior, fimSemanaAnterior)

    const diff  = parseFloat(atual.lucro) - parseFloat(anterior.lucro)
    const pct   = parseFloat(anterior.lucro) > 0
      ? Math.round((diff / parseFloat(anterior.lucro)) * 100)
      : null

    res.json({ atual, anterior, diff, pct })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
