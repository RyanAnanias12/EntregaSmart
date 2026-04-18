const router   = require('express').Router()
const { pool } = require('../db')
const { auth, proOnly } = require('../middleware')

router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT *, (km_atual - km_ultima_revisao) as km_desde_revisao, (km_intervalo_revisao - (km_atual - km_ultima_revisao)) as km_faltam FROM veiculos WHERE tenant_id=$1 AND ativo=true ORDER BY nome`,
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
  const { nome, placa, tipo, consumo_kml, combustivel, km_atual, km_ultima_revisao, km_intervalo_revisao } = req.body
  try {
    const { rows: [v] } = await pool.query(
      `UPDATE veiculos SET nome=$1, placa=$2, tipo=$3, consumo_kml=$4, combustivel=$5, km_atual=COALESCE($6,km_atual), km_ultima_revisao=COALESCE($7,km_ultima_revisao), km_intervalo_revisao=COALESCE($8,km_intervalo_revisao)
       WHERE id=$9 AND tenant_id=$10 RETURNING *`,
      [nome, placa || null, tipo, consumo_kml, combustivel, km_atual||null, km_ultima_revisao||null, km_intervalo_revisao||null, req.params.id, req.user.tenant_id]
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

// PUT /api/veiculos/:id/km — atualiza km atual após rota
router.put('/:id/km', auth, async (req, res) => {
  const { km_rodados } = req.body
  if (!km_rodados || km_rodados <= 0) return res.status(400).json({ error: 'KMs inválidos' })
  try {
    const { rows: [v] } = await pool.query(
      `UPDATE veiculos SET km_atual = km_atual + $1 WHERE id=$2 AND tenant_id=$3
       RETURNING *, (km_atual - km_ultima_revisao) as km_desde_revisao, (km_intervalo_revisao - (km_atual - km_ultima_revisao)) as km_faltam`,
      [km_rodados, req.params.id, req.user.tenant_id]
    )
    if (!v) return res.status(404).json({ error: 'Não encontrado' })
    res.json(v)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT /api/veiculos/:id/revisao — registra revisão feita
router.put('/:id/revisao', auth, async (req, res) => {
  try {
    const { rows: [v] } = await pool.query(
      `UPDATE veiculos SET km_ultima_revisao = km_atual WHERE id=$1 AND tenant_id=$2
       RETURNING *, 0 as km_desde_revisao, km_intervalo_revisao as km_faltam`,
      [req.params.id, req.user.tenant_id]
    )
    if (!v) return res.status(404).json({ error: 'Não encontrado' })
    res.json(v)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
