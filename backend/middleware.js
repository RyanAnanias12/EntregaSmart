const jwt = require('jsonwebtoken')

function auth(req, res, next) {
  const header = req.headers.authorization || ''
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Token não fornecido' })
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' })
  }
}

function adminOnly(req, res, next) {
  if (req.user?.papel !== 'admin') return res.status(403).json({ error: 'Apenas administradores' })
  next()
}

function proOnly(req, res, next) {
  if (req.user?.plano !== 'pro') return res.status(403).json({ error: 'Recurso disponível apenas no plano Pro', upgrade: true })
  next()
}

module.exports = { auth, adminOnly, proOnly }
