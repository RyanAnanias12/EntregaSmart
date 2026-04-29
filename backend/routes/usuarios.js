const router   = require('express').Router()
const bcrypt   = require('bcryptjs')
const { pool } = require('../db')
const { auth, adminOnly } = require('../middleware')

router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, nome, email, papel, ativo, criado_em FROM usuarios WHERE tenant_id=$1 ORDER BY nome`,
      [req.user.tenant_id]
    )
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/', auth, adminOnly, async (req, res) => {
  const { nome, email, senha, papel = 'membro' } = req.body
  if (!nome || !email || !senha) return res.status(400).json({ error: 'Campos obrigatórios' })

  // Limite plano free: 1 usuário
  if (req.user.plano !== 'pro') {
    const { rows: [cnt] } = await pool.query(
      'SELECT COUNT(*) as total FROM usuarios WHERE tenant_id=$1 AND ativo=true',
      [req.user.tenant_id]
    )
    if (parseInt(cnt.total) >= 1) {
      return res.status(403).json({
        error: 'O plano gratuito permite apenas 1 membro. Faça upgrade para o plano Pro.',
        upgrade: true
      })
    }
  }
  try {
    const hash = await bcrypt.hash(senha, 10)
    const { rows: [u] } = await pool.query(
      `INSERT INTO usuarios (tenant_id, nome, email, senha_hash, papel) VALUES ($1,$2,$3,$4,$5) RETURNING id, nome, email, papel, ativo`,
      [req.user.tenant_id, nome, email.toLowerCase(), hash, papel]
    )
    res.status(201).json(u)
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: 'Email já cadastrado' })
    res.status(500).json({ error: e.message })
  }
})

router.put('/:id', auth, adminOnly, async (req, res) => {
  const { papel, ativo } = req.body
  try {
    const { rows: [u] } = await pool.query(
      `UPDATE usuarios SET papel=COALESCE($1,papel), ativo=COALESCE($2,ativo) WHERE id=$3 AND tenant_id=$4 RETURNING id, nome, email, papel, ativo`,
      [papel, ativo, req.params.id, req.user.tenant_id]
    )
    if (!u) return res.status(404).json({ error: 'Não encontrado' })
    res.json(u)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    await pool.query(`DELETE FROM usuarios WHERE id=$1 AND tenant_id=$2 AND id<>$3`, [req.params.id, req.user.tenant_id, req.user.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
