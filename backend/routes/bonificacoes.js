const router   = require('express').Router()
const { pool } = require('../db')
const { auth } = require('../middleware')

// GET /api/bonificacoes?mes=2026-04
router.get('/', auth, async (req, res) => {
  const { mes, data_inicio, data_fim } = req.query
  const conds  = ['tenant_id=$1']
  const params = [req.user.tenant_id]
  let i = 2
  if (mes) {
    const [ano, m] = mes.split('-')
    conds.push(`data >= $${i++} AND data <= $${i++}`)
    params.push(`${ano}-${m}-01`)
    params.push(new Date(ano, m, 0).toISOString().slice(0,10))
  }
  if (data_inicio) { conds.push(`data >= $${i++}`); params.push(data_inicio) }
  if (data_fim)    { conds.push(`data <= $${i++}`); params.push(data_fim) }
  try {
    const { rows } = await pool.query(
      `SELECT * FROM bonificacoes WHERE ${conds.join(' AND ')} ORDER BY data DESC, criado_em DESC`,
      params
    )
    res.json(rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// GET /api/bonificacoes/stats
router.get('/stats', auth, async (req, res) => {
  try {
    const hoje = new Date()
    const ini  = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0,10)
    const fim  = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0).toISOString().slice(0,10)
    const { rows: [s] } = await pool.query(`
      SELECT
        COUNT(*)                                      as total,
        COALESCE(SUM(valor),0)                        as total_valor,
        COALESCE(SUM(valor) FILTER (WHERE tipo='desafio'),0)   as total_desafios,
        COALESCE(SUM(valor) FILTER (WHERE tipo='bonus'),0)     as total_bonus,
        COALESCE(SUM(valor) FILTER (WHERE tipo='extra'),0)     as total_extras
      FROM bonificacoes WHERE tenant_id=$1 AND data BETWEEN $2 AND $3
    `, [req.user.tenant_id, ini, fim])
    res.json(s)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// POST /api/bonificacoes
router.post('/', auth, async (req, res) => {
  const { plataforma, descricao, valor, data, tipo } = req.body
  if (!descricao || !valor) return res.status(400).json({ error: 'Descrição e valor são obrigatórios' })
  try {
    const { rows: [b] } = await pool.query(
      `INSERT INTO bonificacoes (tenant_id, plataforma, descricao, valor, data, tipo)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.tenant_id, plataforma||'mercado_livre', descricao, parseFloat(valor), data||new Date().toISOString().slice(0,10), tipo||'desafio']
    )
    res.status(201).json(b)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// PUT /api/bonificacoes/:id
router.put('/:id', auth, async (req, res) => {
  const { plataforma, descricao, valor, data, tipo } = req.body
  try {
    const { rows: [b] } = await pool.query(
      `UPDATE bonificacoes SET plataforma=$1, descricao=$2, valor=$3, data=$4, tipo=$5
       WHERE id=$6 AND tenant_id=$7 RETURNING *`,
      [plataforma, descricao, parseFloat(valor), data, tipo, req.params.id, req.user.tenant_id]
    )
    if (!b) return res.status(404).json({ error: 'Não encontrado' })
    res.json(b)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// DELETE /api/bonificacoes/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query(`DELETE FROM bonificacoes WHERE id=$1 AND tenant_id=$2`, [req.params.id, req.user.tenant_id])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
