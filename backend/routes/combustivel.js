const router   = require('express').Router()
const { pool } = require('../db')
const { auth } = require('../middleware')

// GET /api/combustivel/historico
router.get('/historico', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM historico_combustivel WHERE tenant_id=$1 ORDER BY data DESC LIMIT 30`,
      [req.user.tenant_id]
    )
    res.json(rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// GET /api/combustivel/impacto?preco_novo=6.50
router.get('/impacto', auth, async (req, res) => {
  const { preco_novo } = req.query
  if (!preco_novo) return res.status(400).json({ error: 'preco_novo obrigatório' })
  try {
    // Busca rotas do mês atual
    const hoje = new Date()
    const ini  = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0,10)
    const fim  = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0).toISOString().slice(0,10)
    const { rows } = await pool.query(`
      SELECT r.kms, r.preco_combustivel, r.custo_combustivel, r.lucro_liquido,
             COALESCE(v.consumo_kml, 6.5) as consumo
      FROM rotas r
      LEFT JOIN veiculos v ON v.id = r.veiculo_id
      WHERE r.tenant_id=$1 AND r.data_rota BETWEEN $2 AND $3 AND r.status='concluida'
    `, [req.user.tenant_id, ini, fim])

    const pNovo = parseFloat(preco_novo)
    let custoAtual = 0, custoNovo = 0
    rows.forEach(r => {
      const km = parseFloat(r.kms)||0
      const consumo = parseFloat(r.consumo)||6.5
      custoAtual += parseFloat(r.custo_combustivel)||0
      custoNovo  += (km/consumo)*pNovo
    })

    const diff = custoNovo - custoAtual
    const precoMedio = rows.length > 0
      ? rows.reduce((a,r)=>a+(parseFloat(r.preco_combustivel)||0),0) / rows.length
      : 0

    res.json({
      rotas:       rows.length,
      custo_atual: custoAtual,
      custo_novo:  custoNovo,
      diferenca:   diff,
      preco_atual_medio: precoMedio,
      preco_novo:  pNovo,
      impacto_pct: custoAtual > 0 ? Math.round((diff/custoAtual)*100) : 0,
    })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// POST /api/combustivel/preco — registra novo preço e recalcula rotas do dia
router.post('/preco', auth, async (req, res) => {
  const { preco, combustivel = 'gasolina', recalcular = false } = req.body
  if (!preco) return res.status(400).json({ error: 'Preço obrigatório' })
  const p = parseFloat(preco)
  try {
    // Salva no histórico
    await pool.query(
      `INSERT INTO historico_combustivel (tenant_id, preco, combustivel) VALUES ($1,$2,$3)`,
      [req.user.tenant_id, p, combustivel]
    )

    // Salva como padrão no tenant
    await pool.query(
      `UPDATE tenants SET preco_combustivel_padrao=$1 WHERE id=$2`,
      [p, req.user.tenant_id]
    )

    let rotasAtualizadas = 0
    if (recalcular) {
      // Recalcula custo e lucro de todas as rotas do mês
      const hoje = new Date()
      const ini  = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0,10)
      const fim  = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0).toISOString().slice(0,10)
      const { rows } = await pool.query(`
        SELECT r.id, r.kms, r.valor_total, r.bonificacao, COALESCE(v.consumo_kml,6.5) as consumo
        FROM rotas r LEFT JOIN veiculos v ON v.id=r.veiculo_id
        WHERE r.tenant_id=$1 AND r.data_rota BETWEEN $2 AND $3 AND r.status='concluida'
      `, [req.user.tenant_id, ini, fim])

      for (const r of rows) {
        const comb  = (parseFloat(r.kms)||0) / parseFloat(r.consumo) * p
        const liq   = (parseFloat(r.valor_total)||0) + (parseFloat(r.bonificacao)||0) - comb
        await pool.query(
          `UPDATE rotas SET preco_combustivel=$1, custo_combustivel=$2, lucro_liquido=$3 WHERE id=$4`,
          [p, comb.toFixed(2), liq.toFixed(2), r.id]
        )
        rotasAtualizadas++
      }
    }

    res.json({ ok: true, preco: p, rotas_atualizadas: rotasAtualizadas })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
