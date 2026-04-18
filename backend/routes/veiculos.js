const router   = require('express').Router()
const { pool } = require('../db')
const { auth, proOnly } = require('../middleware')

router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM veiculos WHERE tenant_id=$1 AND ativo=true ORDER BY nome`,
      [req.user.tenant_id]
    )
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/', auth, proOnly, async (req, res) => {
  const { nome, placa, tipo = 'carro', consumo_kml, combustivel = 'alcool' } = req.body
  if (!nome || !consumo_kml) return res.status(400).json({ error: 'Nome e consumo obrigatórios' })
  try {
    const { rows: [v] } = await pool.query(
      `INSERT INTO veiculos (tenant_id, nome, placa, tipo, consumo_kml, combustivel) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.tenant_id, nome, placa || null, tipo, consumo_kml, combustivel]
    )
    res.status(201).json(v)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/:id', auth, proOnly, async (req, res) => {
  const { nome, placa, tipo, consumo_kml, combustivel } = req.body
  try {
    const { rows: [v] } = await pool.query(
      `UPDATE veiculos SET nome=$1, placa=$2, tipo=$3, consumo_kml=$4, combustivel=$5
       WHERE id=$6 AND tenant_id=$7 RETURNING *`,
      [nome, placa || null, tipo, consumo_kml, combustivel, req.params.id, req.user.tenant_id]
    )
    if (!v) return res.status(404).json({ error: 'Não encontrado' })
    res.json(v)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id', auth, proOnly, async (req, res) => {
  try {
    await pool.query(`UPDATE veiculos SET ativo=false WHERE id=$1 AND tenant_id=$2`, [req.params.id, req.user.tenant_id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
