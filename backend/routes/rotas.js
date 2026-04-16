const router   = require('express').Router()
const { pool } = require('../db')
const { auth } = require('../middleware')
const { enviarNotificacaoRotaCriada, enviarNotificacaoRotaConcluida } = require('../email')

const PRECO_ALCOOL_PADRAO = 4.69

function calcComb(kms, consumo, preco) {
  return parseFloat(((kms / consumo) * preco).toFixed(2))
}

function calcRateio(lucro, piloto, copiloto) {
  const liq = parseFloat(lucro) || 0
  return [
    { nome: piloto,   valor: parseFloat((liq * 0.60).toFixed(2)), role: 'Piloto'   },
    { nome: copiloto, valor: parseFloat((liq * 0.40).toFixed(2)), role: 'Copiloto' },
  ]
}

async function getEmails(tenantId) {
  const { rows } = await pool.query(`SELECT email FROM usuarios WHERE tenant_id=$1 AND ativo=true`, [tenantId])
  return rows.map(r => r.email)
}

async function getTenantNome(tenantId) {
  const { rows } = await pool.query(`SELECT nome FROM tenants WHERE id=$1`, [tenantId])
  return rows[0]?.nome || ''
}

router.get('/', auth, async (req, res) => {
  try {
    const { data_inicio, data_fim, piloto, ponto_coleta, status, plataforma } = req.query
    const conds = ['r.tenant_id=$1'], params = [req.user.tenant_id]
    let i = 2
    if (data_inicio)  { conds.push(`r.data_rota >= $${i++}`);       params.push(data_inicio) }
    if (data_fim)     { conds.push(`r.data_rota <= $${i++}`);       params.push(data_fim) }
    if (piloto)       { conds.push(`r.piloto = $${i++}`);           params.push(piloto) }
    if (ponto_coleta) { conds.push(`r.ponto_coleta ILIKE $${i++}`); params.push(`%${ponto_coleta}%`) }
    if (status)       { conds.push(`r.status = $${i++}`);           params.push(status) }
    if (plataforma)   { conds.push(`r.plataforma = $${i++}`);       params.push(plataforma) }
    const { rows } = await pool.query(
      `SELECT r.*, v.nome as veiculo_nome, v.consumo_kml, v.tipo as veiculo_tipo
       FROM rotas r LEFT JOIN veiculos v ON v.id = r.veiculo_id
       WHERE ${conds.join(' AND ')} ORDER BY r.data_rota DESC, r.criado_em DESC`,
      params
    )
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.get('/recentes', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      (SELECT r.*, v.nome as veiculo_nome FROM rotas r LEFT JOIN veiculos v ON v.id=r.veiculo_id WHERE r.tenant_id=$1 AND r.status='planejada'    ORDER BY r.data_rota ASC  LIMIT 2)
      UNION ALL
      (SELECT r.*, v.nome as veiculo_nome FROM rotas r LEFT JOIN veiculos v ON v.id=r.veiculo_id WHERE r.tenant_id=$1 AND r.status='concluida'    ORDER BY r.data_rota DESC LIMIT 2)
      UNION ALL
      (SELECT r.*, v.nome as veiculo_nome FROM rotas r LEFT JOIN veiculos v ON v.id=r.veiculo_id WHERE r.tenant_id=$1 AND r.status='em_andamento' ORDER BY r.data_rota DESC LIMIT 1)
      ORDER BY data_rota DESC LIMIT 3
    `, [req.user.tenant_id])
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.get('/stats', auth, async (req, res) => {
  try {
    const { data_inicio, data_fim } = req.query
    const conds = ['tenant_id=$1'], params = [req.user.tenant_id]
    let i = 2
    if (data_inicio) { conds.push(`data_rota >= $${i++}`); params.push(data_inicio) }
    if (data_fim)    { conds.push(`data_rota <= $${i++}`); params.push(data_fim) }
    const w = conds.join(' AND ')

    const geral = await pool.query(`
      SELECT COUNT(*) as total_rotas,
             COALESCE(SUM(valor_total),0)       as total_bruto,
             COALESCE(SUM(lucro_liquido),0)      as total_liquido,
             COALESCE(SUM(kms),0)                as total_kms,
             COALESCE(SUM(pacotes_entregues),0)  as total_entregues,
             COALESCE(SUM(pacotes_devolvidos),0) as total_devolvidos,
             COALESCE(SUM(custo_combustivel),0)  as total_combustivel
      FROM rotas WHERE ${w}`, params)

    const porMes = await pool.query(`
      SELECT TO_CHAR(data_rota,'YYYY-MM') as mes,
             COUNT(*) as rotas,
             COALESCE(SUM(valor_total),0)  as bruto,
             COALESCE(SUM(lucro_liquido),0) as liquido
      FROM rotas WHERE ${w}
      GROUP BY TO_CHAR(data_rota,'YYYY-MM') ORDER BY mes DESC LIMIT 6`, params)

    const porPiloto = await pool.query(`
      SELECT piloto as nome, COUNT(*) as rotas,
             COALESCE(SUM(valor_total),0)  as bruto,
             COALESCE(SUM(lucro_liquido),0) as liquido
      FROM rotas WHERE ${w} GROUP BY piloto ORDER BY rotas DESC`, params)

    const porPlataforma = await pool.query(`
      SELECT plataforma, COUNT(*) as rotas, COALESCE(SUM(valor_total),0) as bruto
      FROM rotas WHERE ${w} GROUP BY plataforma ORDER BY rotas DESC`, params)

    const rotasList = await pool.query(`SELECT piloto, copiloto, lucro_liquido FROM rotas WHERE ${w}`, params)
    const acc = {}
    rotasList.rows.forEach(r => {
      calcRateio(r.lucro_liquido, r.piloto, r.copiloto).forEach(p => {
        acc[p.nome] = (acc[p.nome] || 0) + p.valor
      })
    })

    res.json({
      geral: geral.rows[0],
      porMes: [...porMes.rows].reverse(),
      porPiloto: porPiloto.rows,
      porPlataforma: porPlataforma.rows,
      rateioAcumulado: Object.entries(acc).map(([nome, valor]) => ({ nome, valor: parseFloat(valor.toFixed(2)) }))
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, v.nome as veiculo_nome, v.consumo_kml, v.tipo as veiculo_tipo
       FROM rotas r LEFT JOIN veiculos v ON v.id=r.veiculo_id WHERE r.id=$1 AND r.tenant_id=$2`,
      [req.params.id, req.user.tenant_id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Não encontrada' })
    const r = rows[0]
    r.rateio = calcRateio(r.lucro_liquido, r.piloto, r.copiloto)
    res.json(r)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/', auth, async (req, res) => {
  try {
    const d = req.body
    if (d.piloto === d.copiloto) return res.status(400).json({ error: 'Piloto e copiloto não podem ser iguais' })

    let consumo = 6.5, preco = PRECO_ALCOOL_PADRAO
    if (d.veiculo_id) {
      const { rows: [v] } = await pool.query(`SELECT consumo_kml FROM veiculos WHERE id=$1 AND tenant_id=$2`, [d.veiculo_id, req.user.tenant_id])
      if (v) consumo = parseFloat(v.consumo_kml)
    }
    if (d.preco_combustivel) preco = parseFloat(d.preco_combustivel)

    const comb = calcComb(d.kms || 0, consumo, preco)
    const liq  = parseFloat(((d.valor_total || 0) - comb).toFixed(2))

    const { rows: [r] } = await pool.query(`
      INSERT INTO rotas (tenant_id,criado_por,veiculo_id,plataforma,piloto,copiloto,ponto_coleta,hora_inicio,hora_fim,data_rota,status,kms,pacotes_saida,pacotes_entregues,pacotes_devolvidos,paradas,valor_total,custo_combustivel,lucro_liquido,preco_combustivel,observacoes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING *
    `, [req.user.tenant_id,req.user.id,d.veiculo_id||null,d.plataforma||'mercado_livre',
        d.piloto,d.copiloto,d.ponto_coleta,d.hora_inicio||null,d.hora_fim||null,
        d.data_rota,d.status||'planejada',d.kms||0,d.pacotes_saida||0,d.pacotes_entregues||0,
        d.pacotes_devolvidos||0,d.paradas||0,d.valor_total||0,comb,liq,preco,d.observacoes||null])

    r.rateio = calcRateio(liq, r.piloto, r.copiloto)

    // Notificação de nova rota
    if (process.env.RESEND_API_KEY) {
      const emails = await getEmails(req.user.tenant_id)
      const tenantNome = await getTenantNome(req.user.tenant_id)
      enviarNotificacaoRotaCriada(r, emails, tenantNome).catch(() => {})
    }

    res.status(201).json(r)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/:id', auth, async (req, res) => {
  try {
    const d = req.body
    if (d.piloto === d.copiloto) return res.status(400).json({ error: 'Piloto e copiloto não podem ser iguais' })

    const { rows: [atual] } = await pool.query(`SELECT status FROM rotas WHERE id=$1 AND tenant_id=$2`, [req.params.id, req.user.tenant_id])
    if (!atual) return res.status(404).json({ error: 'Não encontrada' })

    let consumo = 6.5, preco = PRECO_ALCOOL_PADRAO
    if (d.veiculo_id) {
      const { rows: [v] } = await pool.query(`SELECT consumo_kml FROM veiculos WHERE id=$1`, [d.veiculo_id])
      if (v) consumo = parseFloat(v.consumo_kml)
    }
    if (d.preco_combustivel) preco = parseFloat(d.preco_combustivel)

    const comb = calcComb(d.kms || 0, consumo, preco)
    const liq  = parseFloat(((d.valor_total || 0) - comb).toFixed(2))

    const { rows: [r] } = await pool.query(`
      UPDATE rotas SET veiculo_id=$1,plataforma=$2,piloto=$3,copiloto=$4,ponto_coleta=$5,hora_inicio=$6,hora_fim=$7,data_rota=$8,status=$9,kms=$10,pacotes_saida=$11,pacotes_entregues=$12,pacotes_devolvidos=$13,paradas=$14,valor_total=$15,custo_combustivel=$16,lucro_liquido=$17,preco_combustivel=$18,observacoes=$19
      WHERE id=$20 AND tenant_id=$21 RETURNING *
    `, [d.veiculo_id||null,d.plataforma||'mercado_livre',d.piloto,d.copiloto,d.ponto_coleta,
        d.hora_inicio||null,d.hora_fim||null,d.data_rota,d.status||'planejada',
        d.kms||0,d.pacotes_saida||0,d.pacotes_entregues||0,d.pacotes_devolvidos||0,d.paradas||0,
        d.valor_total||0,comb,liq,preco,d.observacoes||null,req.params.id,req.user.tenant_id])

    r.rateio = calcRateio(liq, r.piloto, r.copiloto)

    // Notificação quando conclui
    const foiConcluida = atual.status !== 'concluida' && d.status === 'concluida'
    if (foiConcluida && process.env.RESEND_API_KEY) {
      const emails = await getEmails(req.user.tenant_id)
      const tenantNome = await getTenantNome(req.user.tenant_id)
      enviarNotificacaoRotaConcluida(r, r.rateio, emails, tenantNome).catch(() => {})
    }

    res.json(r)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query(`DELETE FROM rotas WHERE id=$1 AND tenant_id=$2`, [req.params.id, req.user.tenant_id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router