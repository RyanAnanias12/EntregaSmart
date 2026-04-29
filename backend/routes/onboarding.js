const router   = require('express').Router()
const { pool } = require('../db')
const { auth } = require('../middleware')

// GET /api/onboarding
router.get('/', auth, async (req, res) => {
  try {
    const { rows: [t] } = await pool.query(
      `SELECT onboarding_step, onboarding_concluido FROM tenants WHERE id=$1`,
      [req.user.tenant_id]
    )
    res.json(t || { onboarding_step: 0, onboarding_concluido: false })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// PUT /api/onboarding
router.put('/', auth, async (req, res) => {
  const { step, concluido } = req.body
  try {
    await pool.query(
      `UPDATE tenants SET onboarding_step=$1, onboarding_concluido=$2 WHERE id=$3`,
      [step ?? 0, concluido ?? false, req.user.tenant_id]
    )
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
