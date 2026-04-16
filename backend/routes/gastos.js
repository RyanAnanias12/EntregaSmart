const router   = require('express').Router()
const { pool } = require('../db')
const { auth } = require('../middleware')

// GET /api/gastos/:rotaId — lista gastos de uma rota
router.get('/:rotaId', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT g.* FROM gastos_rota g
       JOIN rotas r ON r.id = g.rota_id
       WHERE g.rota_id = $1 AND r.tenant_id = $2
       ORDER BY g.criado_em ASC`,
      [req.params.rotaId, req.user.tenant_id]
    )
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/gastos/:rotaId — adiciona gasto
router.post('/:rotaId', auth, async (req, res) => {
  const { categoria, descricao, valor } = req.body
  if (!categoria || !valor) return res.status(400).json({ error: 'Categoria e valor obrigatórios' })
  if (parseFloat(valor) <= 0) return res.status(400).json({ error: 'Valor deve ser positivo' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Verifica que a rota pertence ao tenant
    const { rows: [rota] } = await client.query(
      `SELECT id FROM rotas WHERE id = $1 AND tenant_id = $2`,
      [req.params.rotaId, req.user.tenant_id]
    )
    if (!rota) return res.status(404).json({ error: 'Rota não encontrada' })

    const { rows: [gasto] } = await client.query(
      `INSERT INTO gastos_rota (rota_id, tenant_id, categoria, descricao, valor)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.rotaId, req.user.tenant_id, categoria, descricao || null, valor]
    )

    // Recalcula lucro_liquido da rota
    await recalcularLucro(client, req.params.rotaId)

    await client.query('COMMIT')
    res.status(201).json(gasto)
  } catch (e) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: e.message })
  } finally { client.release() }
})

// PUT /api/gastos/item/:id — edita gasto
router.put('/item/:id', auth, async (req, res) => {
  const { categoria, descricao, valor } = req.body
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows: [g] } = await client.query(
      `UPDATE gastos_rota SET categoria=$1, descricao=$2, valor=$3
       WHERE id=$4 AND tenant_id=$5 RETURNING *`,
      [categoria, descricao || null, valor, req.params.id, req.user.tenant_id]
    )
    if (!g) return res.status(404).json({ error: 'Gasto não encontrado' })

    await recalcularLucro(client, g.rota_id)
    await client.query('COMMIT')
    res.json(g)
  } catch (e) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: e.message })
  } finally { client.release() }
})

// DELETE /api/gastos/item/:id — remove gasto
router.delete('/item/:id', auth, async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows: [g] } = await client.query(
      `DELETE FROM gastos_rota WHERE id=$1 AND tenant_id=$2 RETURNING *`,
      [req.params.id, req.user.tenant_id]
    )
    if (!g) return res.status(404).json({ error: 'Gasto não encontrado' })

    await recalcularLucro(client, g.rota_id)
    await client.query('COMMIT')
    res.json({ ok: true })
  } catch (e) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: e.message })
  } finally { client.release() }
})

// Recalcula lucro_liquido somando todos os gastos extras
async function recalcularLucro(client, rotaId) {
  const { rows: [r] } = await client.query(
    `SELECT valor_total, custo_combustivel FROM rotas WHERE id=$1`, [rotaId]
  )
  const { rows: [agg] } = await client.query(
    `SELECT COALESCE(SUM(valor),0) as total FROM gastos_rota WHERE rota_id=$1`, [rotaId]
  )
  const liq = parseFloat((
    parseFloat(r.valor_total) - parseFloat(r.custo_combustivel) - parseFloat(agg.total)
  ).toFixed(2))

  await client.query(
    `UPDATE rotas SET lucro_liquido=$1 WHERE id=$2`, [liq, rotaId]
  )
  return liq
}

module.exports = router
