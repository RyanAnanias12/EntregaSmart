const router   = require('express').Router()
const { pool } = require('../db')
const { auth, paidOnly } = require('../middleware')

const CATEGORIAS = ['cnpj','seguro','manutencao','combustivel_fixo','aluguel','outros']

router.get('/', auth, paidOnly, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM despesas_fixas WHERE tenant_id=$1 AND ativo=true ORDER BY categoria, descricao',
      [req.user.tenant_id]
    )
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/', auth, paidOnly, async (req, res) => {
  const { categoria, descricao, valor } = req.body
  if (!descricao || !valor) return res.status(400).json({ error: 'Descrição e valor obrigatórios' })
  try {
    const { rows: [d] } = await pool.query(
      'INSERT INTO despesas_fixas (tenant_id, categoria, descricao, valor) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.user.tenant_id, categoria || 'outros', descricao, valor]
    )
    res.status(201).json(d)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/:id', auth, paidOnly, async (req, res) => {
  const { categoria, descricao, valor, ativo } = req.body
  try {
    const { rows: [d] } = await pool.query(
      'UPDATE despesas_fixas SET categoria=$1, descricao=$2, valor=$3, ativo=COALESCE($4,ativo) WHERE id=$5 AND tenant_id=$6 RETURNING *',
      [categoria, descricao, valor, ativo, req.params.id, req.user.tenant_id]
    )
    if (!d) return res.status(404).json({ error: 'Não encontrada' })
    res.json(d)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id', auth, paidOnly, async (req, res) => {
  try {
    await pool.query('UPDATE despesas_fixas SET ativo=false WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user.tenant_id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router