const router   = require('express').Router()
const { pool } = require('../db')
const { auth, paidOnly } = require('../middleware')

// GET /api/abastecimentos
router.get('/', auth, paidOnly, async (req, res) => {
  try {
    const { data_inicio, data_fim, veiculo_id } = req.query
    const conds = ['a.tenant_id=$1'], params = [req.user.tenant_id]
    let i = 2
    if (data_inicio) { conds.push(`a.data >= $${i++}`); params.push(data_inicio) }
    if (data_fim)    { conds.push(`a.data <= $${i++}`); params.push(data_fim) }
    if (veiculo_id)  { conds.push(`a.veiculo_id = $${i++}`); params.push(veiculo_id) }
    const { rows } = await pool.query(
      `SELECT a.*, v.nome as veiculo_nome
       FROM abastecimentos a
       LEFT JOIN veiculos v ON v.id = a.veiculo_id
       WHERE ${conds.join(' AND ')}
       ORDER BY a.data DESC, a.criado_em DESC`,
      params
    )
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/abastecimentos/stats — resumo do mês
router.get('/stats', auth, paidOnly, async (req, res) => {
  try {
    const { data_inicio, data_fim } = req.query
    const ini = data_inicio || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10)
    const fim = data_fim    || new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).toISOString().slice(0,10)
    const { rows: [stats] } = await pool.query(
      `SELECT
        COUNT(*)                       as total_abast,
        COALESCE(SUM(litros),0)        as total_litros,
        COALESCE(SUM(valor_total),0)   as total_gasto,
        COALESCE(AVG(valor_total/NULLIF(litros,0)),0) as preco_medio_litro
       FROM abastecimentos
       WHERE tenant_id=$1 AND data BETWEEN $2 AND $3`,
      [req.user.tenant_id, ini, fim]
    )
    // Custo real vs estimado no mesmo período
    const { rows: [rotas] } = await pool.query(
      `SELECT COALESCE(SUM(custo_combustivel),0) as estimado
       FROM rotas
       WHERE tenant_id=$1 AND data_rota BETWEEN $2 AND $3`,
      [req.user.tenant_id, ini, fim]
    )
    res.json({
      ...stats,
      total_litros:      parseFloat(stats.total_litros),
      total_gasto:       parseFloat(stats.total_gasto),
      preco_medio_litro: parseFloat(parseFloat(stats.preco_medio_litro).toFixed(3)),
      custo_estimado:    parseFloat(rotas.estimado),
      diferenca:         parseFloat((stats.total_gasto - rotas.estimado).toFixed(2)),
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/abastecimentos
router.post('/', auth, paidOnly, async (req, res) => {
  const { veiculo_id, data, litros, valor_total, km_momento, combustivel, posto, observacoes } = req.body
  if (!litros || !valor_total) return res.status(400).json({ error: 'Litros e valor são obrigatórios' })
  try {
    const { rows: [r] } = await pool.query(
      `INSERT INTO abastecimentos (tenant_id, veiculo_id, data, litros, valor_total, km_momento, combustivel, posto, observacoes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user.tenant_id, veiculo_id||null, data||new Date().toISOString().slice(0,10),
       litros, valor_total, km_momento||0, combustivel||'gasolina', posto||null, observacoes||null]
    )
    // Atualiza KM do veículo se informado
    if (veiculo_id && km_momento > 0) {
      await pool.query(
        `UPDATE veiculos SET km_atual = GREATEST(km_atual, $1) WHERE id=$2 AND tenant_id=$3`,
        [km_momento, veiculo_id, req.user.tenant_id]
      ).catch(() => {})
    }
    res.status(201).json(r)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT /api/abastecimentos/:id
router.put('/:id', auth, paidOnly, async (req, res) => {
  const { veiculo_id, data, litros, valor_total, km_momento, combustivel, posto, observacoes } = req.body
  try {
    const { rows: [r] } = await pool.query(
      `UPDATE abastecimentos SET veiculo_id=$1, data=$2, litros=$3, valor_total=$4,
       km_momento=$5, combustivel=$6, posto=$7, observacoes=$8
       WHERE id=$9 AND tenant_id=$10 RETURNING *`,
      [veiculo_id||null, data, litros, valor_total, km_momento||0,
       combustivel||'gasolina', posto||null, observacoes||null,
       req.params.id, req.user.tenant_id]
    )
    if (!r) return res.status(404).json({ error: 'Não encontrado' })
    res.json(r)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE /api/abastecimentos/:id
router.delete('/:id', auth, paidOnly, async (req, res) => {
  try {
    await pool.query(`DELETE FROM abastecimentos WHERE id=$1 AND tenant_id=$2`, [req.params.id, req.user.tenant_id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
