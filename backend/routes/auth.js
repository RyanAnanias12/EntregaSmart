const router  = require('express').Router()
const bcrypt  = require('bcryptjs')
const jwt     = require('jsonwebtoken')
const { pool } = require('../db')

/* =========================================================
   POST /api/auth/register
   Cria tenant + usuário admin
========================================================= */
router.post('/register', async (req, res) => {
  const { nomeEquipe, nomeAdmin, email, senha } = req.body || {}

  if (!nomeEquipe || !nomeAdmin || !email || !senha) {
    return res.status(400).json({ error: 'Preencha todos os campos' })
  }

  if (senha.length < 6) {
    return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres' })
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const slug =
      nomeEquipe
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') +
      '-' +
      Date.now().toString(36)

    const { rows: [tenant] } = await client.query(
      `INSERT INTO tenants (nome, slug)
       VALUES ($1, $2)
       RETURNING *`,
      [nomeEquipe, slug]
    )

    const hash = await bcrypt.hash(senha, 10)

    const { rows: [user] } = await client.query(
      `INSERT INTO usuarios (tenant_id, nome, email, senha_hash, papel)
       VALUES ($1, $2, $3, $4, 'admin')
       RETURNING id, nome, email, papel, tenant_id`,
      [tenant.id, nomeAdmin, email.toLowerCase(), hash]
    )

    await client.query('COMMIT')

    const token = jwt.sign(
      {
        id: user.id,
        tenant_id: tenant.id,
        papel: user.papel,
        nome: user.nome,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    return res.status(201).json({ token, user, tenant })

  } catch (e) {
    await client.query('ROLLBACK')

    if (e.code === '23505') {
      return res.status(400).json({ error: 'Email já cadastrado' })
    }

    console.error('[REGISTER ERROR]', e)
    return res.status(500).json({ error: 'Erro interno no servidor' })

  } finally {
    client.release()
  }
})

/* =========================================================
   POST /api/auth/login
========================================================= */
router.post('/login', async (req, res) => {
  const { email, senha } = req.body || {}

  if (!email || !senha) {
    return res.status(400).json({ error: 'Email e senha obrigatórios' })
  }

  try {
    const { rows } = await pool.query(
      `SELECT u.*, t.nome as tenant_nome, t.plano, t.ativo as tenant_ativo
       FROM usuarios u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.email = $1`,
      [email.toLowerCase()]
    )

    const user = rows[0]
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' })
    }

    if (!user.ativo) {
      return res.status(403).json({ error: 'Usuário inativo' })
    }

    if (!user.tenant_ativo) {
      return res.status(403).json({ error: 'Equipe inativa' })
    }

    const ok = await bcrypt.compare(senha, user.senha_hash)
    if (!ok) {
      return res.status(401).json({ error: 'Credenciais inválidas' })
    }

    const token = jwt.sign(
      {
        id: user.id,
        tenant_id: user.tenant_id,
        papel: user.papel,
        nome: user.nome,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    return res.json({
      token,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        papel: user.papel,
      },
      tenant: {
        id: user.tenant_id,
        nome: user.tenant_nome,
        plano: user.plano,
      },
    })

  } catch (e) {
    console.error('[LOGIN ERROR]', e)
    return res.status(500).json({ error: 'Erro interno no servidor' })
  }
})

/* =========================================================
   GET /api/auth/me
========================================================= */
router.get('/me', require('../middleware').auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.nome, u.email, u.papel,
              t.id as tenant_id, t.nome as tenant_nome, t.plano
       FROM usuarios u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = $1`,
      [req.user.id]
    )

    if (!rows[0]) {
      return res.status(404).json({ error: 'Usuário não encontrado' })
    }

    return res.json(rows[0])
  } catch (e) {
    console.error('[ME ERROR]', e)
    return res.status(500).json({ error: 'Erro interno no servidor' })
  }
})

module.exports = router