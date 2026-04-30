const cron = require('node-cron')
const { pool } = require('./db')
const { enviarResumoSemanal, enviarRotasAtrasadas, enviarRelatorioMensal, enviarAlertaMeta } = require('./email')

function calcRateio(lucro, piloto, copiloto) {
  const liq = parseFloat(lucro) || 0
  return [
    { nome: piloto,   valor: parseFloat((liq * 0.60).toFixed(2)) },
    { nome: copiloto, valor: parseFloat((liq * 0.40).toFixed(2)) },
  ]
}

// ─── RESUMO SEMANAL ─────────────────────────────────────────────────────────
async function rodarResumoSemanal() {
  console.log('[CRON] Iniciando resumo semanal...')
  try {
    const hoje   = new Date()
    const dom    = new Date(hoje); dom.setDate(hoje.getDate() - hoje.getDay() - 7)
    const sab    = new Date(dom);  sab.setDate(dom.getDate() + 6)
    const ini    = dom.toISOString().slice(0, 10)
    const fim    = sab.toISOString().slice(0, 10)
    const periodo = ini.split('-').reverse().join('/') + ' a ' + fim.split('-').reverse().join('/')

    const { rows: tenants } = await pool.query(`SELECT id, nome, plano FROM tenants WHERE ativo=true AND plano IN ('solo','pro')`)

    for (const tenant of tenants) {
      const { rows: [stats] } = await pool.query(`
        SELECT COUNT(*) as total_rotas,
               COALESCE(SUM(valor_total),0)      as total_bruto,
               COALESCE(SUM(lucro_liquido),0)     as total_liquido,
               COALESCE(SUM(kms),0)               as total_kms,
               COALESCE(SUM(pacotes_entregues),0) as total_entregues
        FROM rotas WHERE tenant_id=$1 AND data_rota BETWEEN $2 AND $3
      `, [tenant.id, ini, fim])

      if (parseInt(stats.total_rotas) === 0) continue

      const { rows: rotasSem } = await pool.query(
        'SELECT piloto, copiloto, lucro_liquido FROM rotas WHERE tenant_id=$1 AND data_rota BETWEEN $2 AND $3',
        [tenant.id, ini, fim]
      )
      const acc = {}
      rotasSem.forEach(r => {
        calcRateio(r.lucro_liquido, r.piloto, r.copiloto).forEach(p => {
          acc[p.nome] = (acc[p.nome] || 0) + p.valor
        })
      })
      const rateio = Object.entries(acc).sort((a,b) => b[1]-a[1]).map(([nome,valor]) => ({ nome, valor: parseFloat(valor.toFixed(2)) }))
      const { rows: usuarios } = await pool.query('SELECT email FROM usuarios WHERE tenant_id=$1 AND ativo=true', [tenant.id])
      await enviarResumoSemanal(stats, rateio, usuarios.map(u=>u.email), tenant.nome, periodo, tenant.plano)
      console.log('[CRON] Resumo enviado: ' + tenant.nome)
    }
  } catch (e) { console.error('[CRON] Erro resumo semanal:', e.message) }
}

// ─── RELATÓRIO MENSAL (dia 1 de cada mês) ───────────────────────────────────
async function rodarRelatorioMensal() {
  console.log('[CRON] Iniciando relatório mensal...')
  try {
    const hoje   = new Date()
    const anoAtual = hoje.getFullYear()
    const mesAtual = hoje.getMonth() // mês anterior (0-indexed)
    // Mês anterior
    const ini = new Date(anoAtual, mesAtual - 1, 1).toISOString().slice(0,10)
    const fim = new Date(anoAtual, mesAtual, 0).toISOString().slice(0,10)
    // Dois meses atrás (para comparativo)
    const ini2 = new Date(anoAtual, mesAtual - 2, 1).toISOString().slice(0,10)
    const fim2 = new Date(anoAtual, mesAtual - 1, 0).toISOString().slice(0,10)
    const nomeMes = new Date(anoAtual, mesAtual - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    const nomeMes2 = new Date(anoAtual, mesAtual - 2, 1).toLocaleDateString('pt-BR', { month: 'long' })

    const { rows: tenants } = await pool.query(`SELECT id, nome, plano FROM tenants WHERE ativo=true AND plano IN ('solo','pro')`)

    for (const tenant of tenants) {
      const { rows: [stats] } = await pool.query(`
        SELECT COUNT(*) as total_rotas,
               COALESCE(SUM(valor_total),0)      as total_bruto,
               COALESCE(SUM(lucro_liquido),0)     as total_liquido,
               COALESCE(SUM(kms),0)               as total_kms,
               COALESCE(SUM(pacotes_entregues),0) as total_entregues
        FROM rotas WHERE tenant_id=$1 AND data_rota BETWEEN $2 AND $3
      `, [tenant.id, ini, fim])

      if (parseInt(stats.total_rotas) === 0) continue

      const { rows: [stats2] } = await pool.query(`
        SELECT COUNT(*) as total_rotas,
               COALESCE(SUM(valor_total),0)  as total_bruto,
               COALESCE(SUM(lucro_liquido),0) as total_liquido
        FROM rotas WHERE tenant_id=$1 AND data_rota BETWEEN $2 AND $3
      `, [tenant.id, ini2, fim2])

      const { rows: usuarios } = await pool.query('SELECT email FROM usuarios WHERE tenant_id=$1 AND ativo=true', [tenant.id])
      await enviarRelatorioMensal(stats, { ...stats2, mes: nomeMes2 }, usuarios.map(u => u.email), tenant.nome, nomeMes)
      console.log('[CRON] Relatório mensal: ' + tenant.nome)
    }
  } catch (e) { console.error('[CRON] Erro relatório mensal:', e.message) }
}

// ─── ALERTAS DE META ─────────────────────────────────────────────────────────
async function rodarAlertasMeta() {
  console.log('[CRON] Verificando metas...')
  try {
    const hoje = new Date()
    const ini  = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0,10)
    const fim  = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0).toISOString().slice(0,10)

    const { rows: tenants } = await pool.query(`
      SELECT id, nome, plano, meta_mensal FROM tenants
      WHERE ativo=true AND meta_mensal > 0 AND plano IN ('solo','pro')
    `)

    for (const tenant of tenants) {
      const { rows: [stats] } = await pool.query(
        `SELECT COALESCE(SUM(valor_total),0) as total_bruto FROM rotas WHERE tenant_id=$1 AND data_rota BETWEEN $2 AND $3`,
        [tenant.id, ini, fim]
      )
      const atual = parseFloat(stats.total_bruto)
      const meta  = parseFloat(tenant.meta_mensal)
      const pct   = Math.round((atual / meta) * 100)

      // Checar quais marcos já foram notificados hoje
      const marcos = [50, 80, 100].filter(m => pct >= m)
      if (!marcos.length) continue

      // Usar uma tabela simples para evitar envio duplicado no mesmo mês
      for (const marco of marcos) {
        const chave = `meta_alerta_${tenant.id}_${hoje.getFullYear()}_${hoje.getMonth()}_${marco}`
        const { rows: [jaEnviou] } = await pool.query(
          `SELECT 1 FROM meta_alertas_enviados WHERE chave=$1`, [chave]
        ).catch(() => ({ rows: [] }))
        if (jaEnviou) continue

        const { rows: usuarios } = await pool.query('SELECT email FROM usuarios WHERE tenant_id=$1 AND ativo=true', [tenant.id])
        await enviarAlertaMeta(marco, atual, meta, usuarios.map(u=>u.email), tenant.nome)
        await pool.query(
          `INSERT INTO meta_alertas_enviados (chave, criado_em) VALUES ($1, NOW()) ON CONFLICT DO NOTHING`, [chave]
        ).catch(() => {})
        console.log(`[CRON] Alerta meta ${marco}%: ${tenant.nome}`)
      }
    }
  } catch (e) { console.error('[CRON] Erro alertas meta:', e.message) }
}

// ─── ROTAS ATRASADAS ─────────────────────────────────────────────────────────
async function rodarNotificacaoRotasAtrasadas() {
  console.log('[CRON] Verificando rotas atrasadas...')
  try {
    const hoje = new Date().toISOString().slice(0, 10)
    const { rows: tenants } = await pool.query('SELECT id, nome FROM tenants WHERE ativo=true')
    for (const tenant of tenants) {
      const { rows: rotas } = await pool.query(`
        SELECT piloto, copiloto, ponto_coleta, hora_inicio, status
        FROM rotas WHERE tenant_id=$1 AND data_rota=$2 AND status IN ('planejada','em_andamento')
        ORDER BY hora_inicio ASC
      `, [tenant.id, hoje])
      if (!rotas.length) continue
      const { rows: usuarios } = await pool.query('SELECT email FROM usuarios WHERE tenant_id=$1 AND ativo=true', [tenant.id])
      const emails = usuarios.map(u => u.email)
      if (!emails.length) continue
      await enviarRotasAtrasadas(rotas, emails, tenant.nome, hoje)
      console.log('[CRON] Alerta atrasadas: ' + tenant.nome + ' - ' + rotas.length + ' rota(s)')
    }
  } catch (e) { console.error('[CRON] Erro rotas atrasadas:', e.message) }
}

function initCron() {
  if (!process.env.RESEND_API_KEY) {
    console.log('[CRON] RESEND_API_KEY nao configurado - emails desativados')
    return
  }
  cron.schedule('0 8 * * 1', rodarResumoSemanal,          { timezone: 'America/Sao_Paulo' })
  cron.schedule('0 7 1 * *', rodarRelatorioMensal,         { timezone: 'America/Sao_Paulo' })
  cron.schedule('0 9 * * *', rodarAlertasMeta,             { timezone: 'America/Sao_Paulo' })
  cron.schedule('0 20 * * *', rodarNotificacaoRotasAtrasadas, { timezone: 'America/Sao_Paulo' })
  console.log('[CRON] Agendamentos: resumo semanal (seg 08h) | relatório mensal (dia 1 07h) | alertas meta (09h diário) | atrasadas (20h diário)')
}

module.exports = { initCron }

async function rodarResumoSemanal() {
  console.log('[CRON] Iniciando resumo semanal...')
  try {
    const hoje   = new Date()
    const dom    = new Date(hoje); dom.setDate(hoje.getDate() - hoje.getDay() - 7)
    const sab    = new Date(dom);  sab.setDate(dom.getDate() + 6)
    const ini    = dom.toISOString().slice(0, 10)
    const fim    = sab.toISOString().slice(0, 10)
    const periodo = ini.split('-').reverse().join('/') + ' a ' + fim.split('-').reverse().join('/')

    const { rows: tenants } = await pool.query('SELECT id, nome FROM tenants WHERE ativo=true')

    for (const tenant of tenants) {
      const { rows: [stats] } = await pool.query(`
        SELECT COUNT(*) as total_rotas,
               COALESCE(SUM(valor_total),0)      as total_bruto,
               COALESCE(SUM(lucro_liquido),0)     as total_liquido,
               COALESCE(SUM(kms),0)               as total_kms,
               COALESCE(SUM(pacotes_entregues),0) as total_entregues
        FROM rotas WHERE tenant_id=$1 AND data_rota BETWEEN $2 AND $3
      `, [tenant.id, ini, fim])

      if (parseInt(stats.total_rotas) === 0) continue

      const { rows: rotasSem } = await pool.query(
        'SELECT piloto, copiloto, lucro_liquido FROM rotas WHERE tenant_id=$1 AND data_rota BETWEEN $2 AND $3',
        [tenant.id, ini, fim]
      )
      const acc = {}
      rotasSem.forEach(r => {
        calcRateio(r.lucro_liquido, r.piloto, r.copiloto).forEach(p => {
          acc[p.nome] = (acc[p.nome] || 0) + p.valor
        })
      })
      const rateio = Object.entries(acc).sort((a,b) => b[1]-a[1]).map(([nome,valor]) => ({ nome, valor: parseFloat(valor.toFixed(2)) }))
      const { rows: usuarios } = await pool.query('SELECT email FROM usuarios WHERE tenant_id=$1 AND ativo=true', [tenant.id])
      await enviarResumoSemanal(stats, rateio, usuarios.map(u=>u.email), tenant.nome, periodo, tenant.plano)
      console.log('[CRON] Resumo enviado: ' + tenant.nome)
    }
  } catch (e) { console.error('[CRON] Erro resumo semanal:', e.message) }
}

async function rodarNotificacaoRotasAtrasadas() {
  console.log('[CRON] Verificando rotas atrasadas...')
  try {
    const hoje = new Date().toISOString().slice(0, 10)
    const { rows: tenants } = await pool.query('SELECT id, nome FROM tenants WHERE ativo=true')
    for (const tenant of tenants) {
      const { rows: rotas } = await pool.query(`
        SELECT piloto, copiloto, ponto_coleta, hora_inicio, status
        FROM rotas WHERE tenant_id=$1 AND data_rota=$2 AND status IN ('planejada','em_andamento')
        ORDER BY hora_inicio ASC
      `, [tenant.id, hoje])
      if (!rotas.length) continue
      const { rows: usuarios } = await pool.query('SELECT email FROM usuarios WHERE tenant_id=$1 AND ativo=true', [tenant.id])
      const emails = usuarios.map(u => u.email)
      if (!emails.length) continue
      await enviarRotasAtrasadas(rotas, emails, tenant.nome, hoje)
      console.log('[CRON] Alerta atrasadas: ' + tenant.nome + ' - ' + rotas.length + ' rota(s)')
    }
  } catch (e) { console.error('[CRON] Erro rotas atrasadas:', e.message) }
}

// ─── EXPIRAR TRIALS ─────────────────────────────────────────────────────────
async function expirarTrials() {
  try {
    const { rows } = await pool.query(`
      UPDATE tenants SET plano='free', trial=false
      WHERE trial=true AND plano_expira_em < NOW()
      RETURNING id, nome
    `)
    for (const t of rows) {
      console.log('[CRON] Trial expirado: ' + t.nome)
      // Email avisando que o trial expirou
      const { rows: users } = await pool.query(
        `SELECT email, nome FROM usuarios WHERE tenant_id=$1 AND papel='admin'`, [t.id]
      )
      for (const u of users) {
        const { resend, FROM, baseTemplate } = require('./email')
        const html = baseTemplate(`
          <h2 style="font-size:20px;font-weight:800;color:#f4f4f6;margin-bottom:8px">Seu trial Pro expirou</h2>
          <p style="color:#7c7c96;font-size:14px;margin-bottom:20px">Olá, ${u.nome}! Seus 7 dias grátis do Pro acabaram.</p>
          <p style="color:#a0a0b8;font-size:13px;margin-bottom:24px">Você ainda tem acesso ao plano Free. Para continuar usando todas as funcionalidades — dashboard completo, mapa de calor, comparativo semanal e muito mais — assine o Solo ou Pro.</p>
          <a href="${process.env.FRONTEND_URL}/precos" style="display:block;text-align:center;background:#f97316;color:white;padding:13px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">
            Ver planos a partir de R$ 9,90/mês →
          </a>
        `)
        await resend.emails.send({ from: FROM, to: u.email, subject: 'Seu trial Smart Entregas Pro expirou', html }).catch(()=>{})
      }
    }
  } catch (e) { console.error('[CRON] Erro expirar trials:', e.message) }
}

// ─── EMAIL D+1 SEM ROTA ──────────────────────────────────────────────────────
async function emailD1SemRota() {
  try {
    const ontem = new Date()
    ontem.setDate(ontem.getDate() - 1)
    const ontemStr = ontem.toISOString().slice(0,10)

    // Tenants criados ontem que ainda não têm nenhuma rota
    const { rows: tenants } = await pool.query(`
      SELECT t.id, t.nome, u.nome as admin_nome, u.email
      FROM tenants t
      JOIN usuarios u ON u.tenant_id=t.id AND u.papel='admin'
      WHERE t.criado_em::date = $1
        AND NOT EXISTS (SELECT 1 FROM rotas r WHERE r.tenant_id=t.id)
    `, [ontemStr])

    const { resend, FROM, baseTemplate } = require('./email')
    for (const t of tenants) {
      const html = baseTemplate(`
        <h2 style="font-size:20px;font-weight:800;color:#f4f4f6;margin-bottom:8px">Seu primeiro dia foi ontem 👋</h2>
        <p style="color:#7c7c96;font-size:14px;margin-bottom:20px">Olá, ${t.admin_nome}! Você criou sua conta no Smart Entregas mas ainda não registrou nenhuma rota.</p>
        <p style="color:#a0a0b8;font-size:13px;margin-bottom:8px">Registrar a primeira rota leva menos de 1 minuto. Você vai ver na hora quanto lucrou de verdade depois do combustível.</p>
        <p style="color:#a0a0b8;font-size:13px;margin-bottom:24px">E você ainda tem acesso ao plano <strong style="color:#f97316">Pro por 7 dias grátis</strong> — aproveite!</p>
        <a href="${process.env.FRONTEND_URL}/rotas?nova=1" style="display:block;text-align:center;background:#f97316;color:white;padding:13px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">
          Registrar primeira rota →
        </a>
      `)
      await resend.emails.send({ from: FROM, to: t.email, subject: `${t.admin_nome}, registre sua primeira rota 🚚`, html }).catch(()=>{})
      console.log('[CRON] Email D+1 enviado: ' + t.email)
    }
  } catch (e) { console.error('[CRON] Erro email D+1:', e.message) }
}

// ─── STREAK COM TOLERÂNCIA ───────────────────────────────────────────────────
// Streak não zera se motorista ficou 1 dia sem rodar (tolerância de 1 dia)
// Já implementado no routes/streak.js — apenas garantir que roda diariamente
async function atualizarStreaks() {
  try {
    const { rows: tenants } = await pool.query(`SELECT id FROM tenants WHERE ativo=true`)
    for (const t of tenants) {
      const { rows: dias } = await pool.query(`
        SELECT DISTINCT data_rota::text as data
        FROM rotas WHERE tenant_id=$1 AND status='concluida'
        ORDER BY data_rota DESC LIMIT 365
      `, [t.id])

      if (!dias.length) { await pool.query(`UPDATE tenants SET streak_dias=0 WHERE id=$1`, [t.id]); continue }

      const agoraBR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
      const hojeBR  = agoraBR.toISOString().slice(0,10)
      const ontemBR = new Date(new Date(agoraBR).setDate(agoraBR.getDate()-1)).toISOString().slice(0,10)

      const primeiro = dias[0].data
      let offset = primeiro===hojeBR ? 0 : primeiro===ontemBR ? 1 : null
      let streak = 0

      if (offset !== null) {
        const base = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
        for (let i = 0; i < dias.length; i++) {
          const esp = new Date(base); esp.setDate(base.getDate() - (i + offset))
          if (dias[i].data === esp.toISOString().slice(0,10)) streak++
          else break
        }
      }

      await pool.query(`UPDATE tenants SET streak_dias=$1, streak_ultima_data=CURRENT_DATE WHERE id=$2`, [streak, t.id])
    }
  } catch (e) { console.error('[CRON] Erro streaks:', e.message) }
}

// ─── NOTIFICAÇÃO META DIÁRIA ─────────────────────────────────────────────────
async function notificacaoMetaDiaria() {
  try {
    const hoje = new Date()
    const ini  = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0,10)
    const fim  = hoje.toISOString().slice(0,10)

    // Busca tenants com meta definida e plano pago
    const { rows: tenants } = await pool.query(`
      SELECT t.id, t.nome, t.meta_mensal,
             u.nome as admin_nome, u.email
      FROM tenants t
      JOIN usuarios u ON u.tenant_id = t.id AND u.papel = 'admin'
      WHERE t.meta_mensal > 0
        AND t.plano IN ('pro','solo')
        AND t.ativo = true
    `)

    for (const t of tenants) {
      // Calcula lucro do mês atual
      const { rows: [stats] } = await pool.query(`
        SELECT COALESCE(SUM(valor_total + COALESCE(bonificacao,0) - custo_combustivel), 0) as lucro
        FROM rotas
        WHERE tenant_id = $1
          AND status = 'concluida'
          AND data_rota BETWEEN $2 AND $3
      `, [t.id, ini, fim])

      const lucroMes  = parseFloat(stats.lucro || 0)
      const meta      = parseFloat(t.meta_mensal)
      const pct       = meta > 0 ? Math.round((lucroMes / meta) * 100) : 0
      const faltam    = meta - lucroMes

      // Só notifica se ainda não bateu a meta
      if (pct >= 100) continue

      // Calcula meta diária restante
      const diasMes    = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0).getDate()
      const diasRest   = diasMes - hoje.getDate()
      const porDia     = diasRest > 0 ? faltam / diasRest : faltam
      const chave      = `meta_diaria_${t.id}_${hoje.toISOString().slice(0,10)}`

      // Evita notificar duas vezes no mesmo dia
      const { rows: jaEnviou } = await pool.query(
        `SELECT 1 FROM meta_alertas_enviados WHERE chave=$1`, [chave]
      )
      if (jaEnviou.length) continue

      // Envia push notification
      const { rows: subs } = await pool.query(
        `SELECT subscription_json FROM push_subscriptions WHERE tenant_id=$1`, [t.id]
      )
      if (subs.length) {
        const webpush = require('../push')
        const payload = JSON.stringify({
          title: '🎯 Meta do dia — Smart Entregas',
          body:  `${t.admin_nome}, faltam R$${faltam.toFixed(0)} para a meta. Precisa de ~R$${porDia.toFixed(0)}/dia nos próximos ${diasRest} dias.`,
          url:   '/dashboard'
        })
        for (const s of subs) {
          try { await webpush.sendNotification(JSON.parse(s.subscription_json), payload) }
          catch(e) { if (e.statusCode === 410) await pool.query(`DELETE FROM push_subscriptions WHERE subscription_json=$1`, [s.subscription_json]) }
        }
      }

      // Registra envio
      await pool.query(`INSERT INTO meta_alertas_enviados (chave) VALUES ($1) ON CONFLICT DO NOTHING`, [chave])
      console.log(`[CRON] Meta diária: ${t.nome} — ${pct}% (faltam R$${faltam.toFixed(0)})`)
    }
  } catch(e) { console.error('[CRON] Erro meta diária:', e.message) }
}

function initCron() {
  if (!process.env.RESEND_API_KEY) {
    console.log('[CRON] RESEND_API_KEY nao configurado - emails desativados')
    return
  }
  cron.schedule('0 8  * * 1', rodarResumoSemanal,             { timezone: 'America/Sao_Paulo' })
  cron.schedule('0 20 * * *', rodarNotificacaoRotasAtrasadas,  { timezone: 'America/Sao_Paulo' })
  cron.schedule('0 10 * * *', emailD1SemRota,                  { timezone: 'America/Sao_Paulo' })
  cron.schedule('0 3  * * *', expirarTrials,                   { timezone: 'America/Sao_Paulo' })
  cron.schedule('0 23 * * *', atualizarStreaks,                 { timezone: 'America/Sao_Paulo' })
  cron.schedule('0 19 * * *', notificacaoMetaDiaria,            { timezone: 'America/Sao_Paulo' })
  console.log('[CRON] Jobs: resumo semanal, atrasadas, D+1, trial expira, streaks, meta diária')
}