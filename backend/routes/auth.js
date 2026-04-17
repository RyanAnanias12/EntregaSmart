const router  = require('express').Router()
const bcrypt  = require('bcryptjs')
const jwt     = require('jsonwebtoken')
const { pool } = require('../db')
const { enviarBoasVindas } = require('../email')
const { auth } = require('../middleware')

function makeToken(user, tenant) {
  return jwt.sign(
    { id: user.id, tenant_id: tenant.id, papel: user.papel, nome: user.nome, email: user.email, plano: tenant.plano },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )
}

router.post('/register', async (req, res) => {
  const { nomeEquipe, nomeAdmin, email, senha } = req.body
  if (!nomeEquipe || !nomeAdmin || !email || !senha)
    return res.status(400).json({ error: 'Preencha todos os campos' })
  if (senha.length < 6)
    return res.status(400).json({ error: 'Senha mínima de 6 caracteres' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const slug = nomeEquipe.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36)

    const { rows: [tenant] } = await client.query(
      `INSERT INTO tenants (nome, slug) VALUES ($1,$2) RETURNING *`, [nomeEquipe, slug]
    )
    const hash = await bcrypt.hash(senha, 10)
    const { rows: [user] } = await client.query(
      `INSERT INTO usuarios (tenant_id, nome, email, senha_hash, papel) VALUES ($1,$2,$3,$4,'admin') RETURNING *`,
      [tenant.id, nomeAdmin, email.toLowerCase(), hash]
    )
    await client.query('COMMIT')

    enviarBoasVindas(nomeAdmin, email, nomeEquipe).catch(() => {})

    const token = makeToken(user, tenant)
    res.status(201).json({ token, user: { id: user.id, nome: user.nome, email: user.email, papel: user.papel }, tenant: { id: tenant.id, nome: tenant.nome, plano: tenant.plano } })
  } catch (e) {
    await client.query('ROLLBACK')
    if (e.code === '23505') return res.status(400).json({ error: 'Email já cadastrado' })
    res.status(500).json({ error: e.message })
  } finally { client.release() }
})

router.post('/login', async (req, res) => {
  const { email, senha } = req.body
  if (!email || !senha) return res.status(400).json({ error: 'Email e senha obrigatórios' })
  try {
    const { rows } = await pool.query(
      `SELECT u.*, t.nome as tenant_nome, t.plano, t.ativo as tenant_ativo
       FROM usuarios u JOIN tenants t ON t.id = u.tenant_id WHERE u.email=$1`,
      [email.toLowerCase()]
    )
    const user = rows[0]
    if (!user || !user.ativo || !user.tenant_ativo) return res.status(401).json({ error: 'Credenciais inválidas' })
    if (!await bcrypt.compare(senha, user.senha_hash)) return res.status(401).json({ error: 'Credenciais inválidas' })
    const tenant = { id: user.tenant_id, nome: user.tenant_nome, plano: user.plano }
    res.json({ token: makeToken(user, tenant), user: { id: user.id, nome: user.nome, email: user.email, papel: user.papel }, tenant })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.get('/me', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.nome, u.email, u.papel, t.id as tenant_id, t.nome as tenant_nome, t.plano
       FROM usuarios u JOIN tenants t ON t.id = u.tenant_id WHERE u.id=$1`, [req.user.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Não encontrado' })
    res.json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/auth/meta — busca meta mensal
router.get('/meta', auth, async (req, res) => {
  try {
    const { rows: [t] } = await pool.query('SELECT meta_mensal FROM tenants WHERE id=$1', [req.user.tenant_id])
    res.json({ meta_mensal: parseFloat(t?.meta_mensal || 0) })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT /api/auth/meta — atualiza meta mensal
router.put('/meta', auth, async (req, res) => {
  const { meta_mensal } = req.body
  if (meta_mensal < 0) return res.status(400).json({ error: 'Meta deve ser positiva' })
  try {
    await pool.query('UPDATE tenants SET meta_mensal=$1 WHERE id=$2', [meta_mensal, req.user.tenant_id])
    res.json({ ok: true, meta_mensal: parseFloat(meta_mensal) })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
