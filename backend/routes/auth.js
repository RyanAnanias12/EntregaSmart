const router  = require('express').Router()
const bcrypt  = require('bcryptjs')
const crypto  = require('crypto')
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

// ─── REGISTER ────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { nomeEquipe, nomeAdmin, email, senha, telefone } = req.body
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

    const trialExpira = new Date(Date.now() + 7*24*60*60*1000)
    const { rows: [tenant] } = await client.query(
      `INSERT INTO tenants (nome, slug, plano, plano_expira_em, trial) VALUES ($1,$2,'pro',$3,true) RETURNING *`,
      [nomeEquipe, slug, trialExpira]
    )
    const hash = await bcrypt.hash(senha, 10)
    const { rows: [user] } = await client.query(
      `INSERT INTO usuarios (tenant_id, nome, email, senha_hash, papel, telefone) VALUES ($1,$2,$3,$4,'admin',$5) RETURNING *`,
      [tenant.id, nomeAdmin, email.toLowerCase(), hash, telefone || null]
    )
    await client.query('COMMIT')
    enviarBoasVindas(nomeAdmin, email, nomeEquipe).catch(() => {})
    const token = makeToken(user, tenant)
    res.status(201).json({ token, user: { id: user.id, nome: user.nome, email: user.email, papel: user.papel }, tenant: { id: tenant.id, nome: tenant.nome, plano: tenant.plano, trial: tenant.trial, plano_expira_em: tenant.plano_expira_em } })
  } catch (e) {
    await client.query('ROLLBACK')
    if (e.code === '23505') return res.status(400).json({ error: 'Email já cadastrado' })
    res.status(500).json({ error: e.message })
  } finally { client.release() }
})

// ─── LOGIN ────────────────────────────────────────────────────────────────────
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
    const { rows: [tenantFull] } = await pool.query(`SELECT * FROM tenants WHERE id=$1`, [user.tenant_id])
    const tenant = { id: user.tenant_id, nome: user.tenant_nome, plano: user.plano, trial: tenantFull.trial, plano_expira_em: tenantFull.plano_expira_em }
    res.json({ token: makeToken(user, tenant), user: { id: user.id, nome: user.nome, email: user.email, papel: user.papel }, tenant })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── ME ───────────────────────────────────────────────────────────────────────
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

// ─── PERFIL ───────────────────────────────────────────────────────────────────
router.put('/perfil', auth, async (req, res) => {
  const { nome, email, senha_atual, senha_nova } = req.body
  try {
    const { rows: [u] } = await pool.query(`SELECT * FROM usuarios WHERE id=$1`, [req.user.id])
    if (!u) return res.status(404).json({ error: 'Usuário não encontrado' })

    if (senha_nova) {
      if (!senha_atual) return res.status(400).json({ error: 'Informe a senha atual para alterar' })
      if (!await bcrypt.compare(senha_atual, u.senha_hash)) return res.status(400).json({ error: 'Senha atual incorreta' })
      if (senha_nova.length < 6) return res.status(400).json({ error: 'Nova senha mínima de 6 caracteres' })
    }

    const novoEmail = email ? email.toLowerCase() : u.email
    if (novoEmail !== u.email) {
      const { rows: existe } = await pool.query(`SELECT id FROM usuarios WHERE email=$1 AND id!=$2`, [novoEmail, u.id])
      if (existe.length) return res.status(400).json({ error: 'Email já está em uso' })
    }

    const novoHash = senha_nova ? await bcrypt.hash(senha_nova, 10) : u.senha_hash
    const { rows: [atualizado] } = await pool.query(
      `UPDATE usuarios SET nome=COALESCE($1,nome), email=$2, senha_hash=$3 WHERE id=$4 RETURNING id,nome,email,papel`,
      [nome||u.nome, novoEmail, novoHash, u.id]
    )
    res.json({ ok: true, user: atualizado })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── CONFIG ───────────────────────────────────────────────────────────────────
router.get('/config', auth, async (req, res) => {
  try {
    const { rows: [t] } = await pool.query('SELECT meta_mensal, meta_diaria, modo_solo FROM tenants WHERE id=$1', [req.user.tenant_id])
    res.json({ meta_mensal: parseFloat(t?.meta_mensal || 0), meta_diaria: parseFloat(t?.meta_diaria || 0), modo_solo: t?.modo_solo || false })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/config', auth, async (req, res) => {
  const { meta_mensal, meta_diaria, modo_solo } = req.body
  try {
    await pool.query(
      'UPDATE tenants SET meta_mensal=COALESCE($1,meta_mensal), meta_diaria=COALESCE($2,meta_diaria), modo_solo=COALESCE($3,modo_solo) WHERE id=$4',
      [meta_mensal, meta_diaria, modo_solo, req.user.tenant_id]
    )
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.get('/meta', auth, async (req, res) => {
  try {
    const { rows: [t] } = await pool.query('SELECT meta_mensal FROM tenants WHERE id=$1', [req.user.tenant_id])
    res.json({ meta_mensal: parseFloat(t?.meta_mensal || 0) })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/meta', auth, async (req, res) => {
  const { meta_mensal } = req.body
  if (meta_mensal < 0) return res.status(400).json({ error: 'Meta deve ser positiva' })
  try {
    await pool.query('UPDATE tenants SET meta_mensal=$1 WHERE id=$2', [meta_mensal, req.user.tenant_id])
    res.json({ ok: true, meta_mensal: parseFloat(meta_mensal) })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── RECUPERAÇÃO DE SENHA ─────────────────────────────────────────────────────
router.post('/forgot', async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email obrigatório' })
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.nome FROM usuarios u WHERE u.email=$1 AND u.ativo=true`,
      [email.toLowerCase()]
    )
    // Sempre retorna ok para não revelar se email existe
    if (!rows[0]) return res.json({ ok: true })

    const token  = crypto.randomBytes(32).toString('hex')
    const expira = new Date(Date.now() + 60*60*1000) // 1 hora

    await pool.query(
      `UPDATE usuarios SET reset_token=$1, reset_expira=$2 WHERE id=$3`,
      [token, expira, rows[0].id]
    )

    const link = `${process.env.FRONTEND_URL}/reset-senha?token=${token}`
    const { resend, FROM, baseTemplate } = require('../email')
    const html = baseTemplate(`
      <h2 style="font-size:20px;font-weight:800;color:#f4f4f6;margin-bottom:8px">Redefinir sua senha</h2>
      <p style="color:#7c7c96;font-size:14px;margin-bottom:20px">Olá, ${rows[0].nome}! Recebemos uma solicitação para redefinir sua senha.</p>
      <a href="${link}" style="display:block;text-align:center;background:#f97316;color:white;padding:13px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;margin-bottom:16px">
        Redefinir senha →
      </a>
      <p style="color:#4a4a62;font-size:12px;text-align:center">Este link expira em 1 hora. Se você não solicitou, ignore este email.</p>
    `)
    await resend.emails.send({ from: FROM, to: email, subject: 'Redefinir senha — Smart Entregas', html }).catch(()=>{})
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/reset', async (req, res) => {
  const { token, senha } = req.body
  if (!token || !senha) return res.status(400).json({ error: 'Token e senha obrigatórios' })
  if (senha.length < 6) return res.status(400).json({ error: 'Senha mínima de 6 caracteres' })
  try {
    const { rows } = await pool.query(
      `SELECT id FROM usuarios WHERE reset_token=$1 AND reset_expira > NOW() AND ativo=true`, [token]
    )
    if (!rows[0]) return res.status(400).json({ error: 'Link inválido ou expirado. Solicite um novo.' })
    const hash = await bcrypt.hash(senha, 10)
    await pool.query(
      `UPDATE usuarios SET senha_hash=$1, reset_token=null, reset_expira=null WHERE id=$2`,
      [hash, rows[0].id]
    )
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
