const jwt = require('jsonwebtoken')
const { pool } = require('./db')

function auth(req, res, next) {
  const header = req.headers.authorization || ''
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Token não fornecido' })

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.user = payload   // { id, tenant_id, papel, nome, email }
    next()
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' })
  }
}

function adminOnly(req, res, next) {
  if (req.user?.papel !== 'admin') {
    return res.status(403).json({ error: 'Apenas administradores' })
  }
  next()
}

module.exports = { auth, adminOnly }
