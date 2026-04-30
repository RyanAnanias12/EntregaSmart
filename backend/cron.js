const cron = require('node-cron')
const { pool } = require('./db')

function calcRateio(lucro, piloto, copiloto) {
  const liq = parseFloat(lucro) || 0
  return [
    { nome: piloto,   valor: parseFloat((liq * 0.60).toFixed(2)) },
    { nome: copiloto, valor: parseFloat((liq * 0.40).toFixed(2)) },
  ]
}

function fmtBRL(v) {
  return 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 })
}

// ─── RESUMO SEMANAL (segunda 8h) ─────────────────────────────────────────────
async function rodarResumoSemanal() {
  console.log('[CRON] Resumo semanal...')
  try {
    const { enviarResumoSemanal } = require('./email')
    const hoje = new Date()
    const dom  = new Date(hoje); dom.setDate(hoje.getDate() - hoje.getDay() - 7)
    const sab  = new Date(dom);  sab.setDate(dom.getDate() + 6)
    const ini  = dom.toISOString().slice(0,10)
    const fim  = sab.toISOString().slice(0,10)
    const periodo = ini.split('-').reverse().join('/') + ' a ' + fim.split('-').reverse().join('/')
    const { rows: tenants } = await pool.query(`SELECT id, nome, plano FROM tenants WHERE ativo=true AND plano IN ('solo','pro')`)
    for (const t of tenants) {
      const { rows: [stats] } = await pool.query(`
        SELECT COUNT(*) as total_rotas,
               COALESCE(SUM(valor_total),0)      as total_bruto,
               COALESCE(SUM(valor_total + COALESCE(bonificacao,0) - custo_combustivel),0) as total_liquido,
               COALESCE(SUM(kms),0)              as total_kms,
               COALESCE(SUM(pacotes_entregues),0) as total_entregues
        FROM rotas WHERE tenant_id=$1 AND status='concluida' AND data_rota BETWEEN $2 AND $3
      `, [t.id, ini, fim])
      if (parseInt(stats.total_rotas) === 0) continue
      const { rows: rotasSem } = await pool.query(
        `SELECT piloto, copiloto, valor_total + COALESCE(bonificacao,0) - custo_combustivel as lucro_liquido
         FROM rotas WHERE tenant_id=$1 AND status='concluida' AND data_rota BETWEEN $2 AND $3`,
        [t.id, ini, fim]
      )
      const acc = {}
      rotasSem.forEach(r => {
        calcRateio(r.lucro_liquido, r.piloto, r.copiloto).forEach(p => {
          acc[p.nome] = (acc[p.nome]||0) + p.valor
        })
      })
      const rateio   = Object.entries(acc).map(([nome, valor]) => ({ nome, valor: parseFloat(valor.toFixed(2)) }))
      const { rows: usuarios } = await pool.query(`SELECT email FROM usuarios WHERE tenant_id=$1 AND ativo=true`, [t.id])
      await enviarResumoSemanal(stats, rateio, usuarios.map(u=>u.email), t.nome, periodo, t.plano)
    }
  } catch(e) { console.error('[CRON] Erro semanal:', e.message) }
}

// ─── ALERTAS DE META ─────────────────────────────────────────────────────────
async function rodarAlertasMeta() {
  try {
    const { enviarAlertaMeta } = require('./email')
    const hoje = new Date()
    const ini  = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0,10)
    const fim  = hoje.toISOString().slice(0,10)
    const { rows: tenants } = await pool.query(`SELECT id, nome, meta_mensal FROM tenants WHERE ativo=true AND meta_mensal > 0 AND plano IN ('pro','solo')`)
    for (const t of tenants) {
      const { rows: [s] } = await pool.query(
        `SELECT COALESCE(SUM(valor_total),0) as bruto FROM rotas WHERE tenant_id=$1 AND status='concluida' AND data_rota BETWEEN $2 AND $3`,
        [t.id, ini, fim]
      )
      const pct = t.meta_mensal > 0 ? Math.round((parseFloat(s.bruto) / parseFloat(t.meta_mensal)) * 100) : 0
      for (const nivel of [50, 80, 100]) {
        if (pct >= nivel) {
          const chave = `meta_${t.id}_${hoje.getFullYear()}_${hoje.getMonth()+1}_${nivel}`
          const { rows: jaEnviou } = await pool.query(`SELECT 1 FROM meta_alertas_enviados WHERE chave=$1`, [chave])
          if (jaEnviou.length) continue
          const { rows: usuarios } = await pool.query(`SELECT email FROM usuarios WHERE tenant_id=$1 AND ativo=true`, [t.id])
          await enviarAlertaMeta(t.nome, pct, parseFloat(s.bruto), parseFloat(t.meta_mensal), usuarios.map(u=>u.email))
          await pool.query(`INSERT INTO meta_alertas_enviados (chave) VALUES ($1) ON CONFLICT DO NOTHING`, [chave])
        }
      }
    }
  } catch(e) { console.error('[CRON] Erro alertas meta:', e.message) }
}

// ─── ROTAS ATRASADAS ─────────────────────────────────────────────────────────
async function rodarNotificacaoRotasAtrasadas() {
  try {
    const { enviarRotasAtrasadas } = require('./email')
    const hoje = new Date().toISOString().slice(0,10)
    const { rows } = await pool.query(
      `SELECT r.*, t.nome as tenant_nome FROM rotas r JOIN tenants t ON t.id=r.tenant_id
       WHERE r.status='planejada' AND r.data_rota < $1 AND t.ativo=true`, [hoje]
    )
    const porTenant = {}
    rows.forEach(r => { if (!porTenant[r.tenant_id]) porTenant[r.tenant_id] = []; porTenant[r.tenant_id].push(r) })
    for (const [tid, rotas] of Object.entries(porTenant)) {
      const { rows: usuarios } = await pool.query(`SELECT email FROM usuarios WHERE tenant_id=$1 AND ativo=true`, [tid])
      await enviarRotasAtrasadas(rotas, usuarios.map(u=>u.email), rotas[0].tenant_nome)
    }
  } catch(e) { console.error('[CRON] Erro atrasadas:', e.message) }
}

// ─── EXPIRAR TRIALS ──────────────────────────────────────────────────────────
async function expirarTrials() {
  try {
    const { resend, FROM, baseTemplate } = require('./email')
    const { rows } = await pool.query(`
      UPDATE tenants SET plano='free', trial=false
      WHERE trial=true AND plano_expira_em < NOW()
      RETURNING id, nome
    `)
    for (const t of rows) {
      console.log('[CRON] Trial expirado: ' + t.nome)
      const { rows: users } = await pool.query(`SELECT email, nome FROM usuarios WHERE tenant_id=$1 AND papel='admin'`, [t.id])
      for (const u of users) {
        const html = baseTemplate(`
          <h2 style="font-size:20px;font-weight:800;color:#f4f4f6;margin-bottom:8px">Seu trial Pro expirou</h2>
          <p style="color:#7c7c96;font-size:14px;margin-bottom:20px">Olá, ${u.nome}! Seus 7 dias grátis do Pro acabaram.</p>
          <p style="color:#a0a0b8;font-size:13px;margin-bottom:24px">Você voltou para o plano Free. Para continuar com tudo, assine a partir de R$ 9,90/mês.</p>
          <a href="${process.env.FRONTEND_URL}/precos" style="display:block;text-align:center;background:#f97316;color:white;padding:13px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">
            Ver planos →
          </a>
        `)
        await resend.emails.send({ from: FROM, to: u.email, subject: 'Seu trial Smart Entregas Pro expirou', html }).catch(()=>{})
      }
    }
  } catch(e) { console.error('[CRON] Erro trials:', e.message) }
}

// ─── EMAIL D+1 SEM ROTA ───────────────────────────────────────────────────────
async function emailD1SemRota() {
  try {
    const { resend, FROM, baseTemplate } = require('./email')
    const ontem = new Date(); ontem.setDate(ontem.getDate()-1)
    const { rows: tenants } = await pool.query(`
      SELECT t.id, t.nome, u.nome as admin_nome, u.email
      FROM tenants t JOIN usuarios u ON u.tenant_id=t.id AND u.papel='admin'
      WHERE t.criado_em::date = $1
        AND NOT EXISTS (SELECT 1 FROM rotas r WHERE r.tenant_id=t.id)
    `, [ontem.toISOString().slice(0,10)])
    for (const t of tenants) {
      const html = baseTemplate(`
        <h2 style="font-size:20px;font-weight:800;color:#f4f4f6;margin-bottom:8px">Seu primeiro dia foi ontem 👋</h2>
        <p style="color:#7c7c96;font-size:14px;margin-bottom:20px">Olá, ${t.admin_nome}! Você criou sua conta mas ainda não registrou nenhuma rota.</p>
        <p style="color:#a0a0b8;font-size:13px;margin-bottom:8px">Registrar a primeira rota leva menos de 1 minuto e você vê o lucro real na hora.</p>
        <p style="color:#a0a0b8;font-size:13px;margin-bottom:24px">Você ainda tem acesso ao Pro por 7 dias grátis — aproveite!</p>
        <a href="${process.env.FRONTEND_URL}/rotas?nova=1" style="display:block;text-align:center;background:#f97316;color:white;padding:13px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">
          Registrar primeira rota →
        </a>
      `)
      await resend.emails.send({ from: FROM, to: t.email, subject: `${t.admin_nome}, registre sua primeira rota 🚚`, html }).catch(()=>{})
    }
  } catch(e) { console.error('[CRON] Erro D+1:', e.message) }
}

// ─── SEQUÊNCIA DE ATIVAÇÃO D+2 E D+3 ─────────────────────────────────────────
async function emailSequenciaAtivacao() {
  try {
    const { resend, FROM, baseTemplate } = require('./email')
    const hoje = new Date()

    for (const diasAtras of [2, 3]) {
      const dia = new Date(hoje); dia.setDate(hoje.getDate()-diasAtras)
      const { rows: tenants } = await pool.query(`
        SELECT t.id, t.nome, t.plano, u.nome as admin_nome, u.email,
               (SELECT COUNT(*) FROM rotas r WHERE r.tenant_id=t.id) as total_rotas
        FROM tenants t JOIN usuarios u ON u.tenant_id=t.id AND u.papel='admin'
        WHERE t.criado_em::date = $1
      `, [dia.toISOString().slice(0,10)])

      for (const t of tenants) {
        const chave = `ativacao_d${diasAtras}_${t.id}`
        const { rows: jaEnviou } = await pool.query(`SELECT 1 FROM meta_alertas_enviados WHERE chave=$1`, [chave])
        if (jaEnviou.length) continue

        let subject, html
        if (diasAtras === 2) {
          // D+2: como registrar rota
          subject = `Como registrar sua primeira rota no Smart Entregas`
          html = baseTemplate(`
            <h2 style="font-size:20px;font-weight:800;color:#f4f4f6;margin-bottom:8px">Como funciona o Smart Entregas</h2>
            <p style="color:#7c7c96;font-size:14px;margin-bottom:20px">Olá, ${t.admin_nome}! Deixa a gente te mostrar como é simples.</p>
            <div style="background:#1c1c22;border-radius:12px;padding:16px;margin-bottom:16px">
              <p style="font-weight:700;color:#f97316;margin-bottom:8px">3 passos para ver seu lucro real:</p>
              <p style="color:#a0a0b8;font-size:13px;margin-bottom:6px">1️⃣ Clique em <strong style="color:#f4f4f6">+ Nova rota</strong></p>
              <p style="color:#a0a0b8;font-size:13px;margin-bottom:6px">2️⃣ Preencha: ponto de coleta, KMs, pacotes e valor recebido</p>
              <p style="color:#a0a0b8;font-size:13px">3️⃣ O app desconta o combustível e mostra seu <strong style="color:#34d399">lucro real</strong></p>
            </div>
            <p style="color:#a0a0b8;font-size:13px;margin-bottom:24px">Leva menos de 1 minuto. Você ainda tem o Pro grátis — use agora!</p>
            <a href="${process.env.FRONTEND_URL}/rotas?nova=1" style="display:block;text-align:center;background:#f97316;color:white;padding:13px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">
              Registrar minha primeira rota →
            </a>
          `)
        } else {
          // D+3: equipe
          subject = `Você sabia que pode adicionar sua equipe no Smart Entregas?`
          html = baseTemplate(`
            <h2 style="font-size:20px;font-weight:800;color:#f4f4f6;margin-bottom:8px">Trabalha com copiloto?</h2>
            <p style="color:#7c7c96;font-size:14px;margin-bottom:20px">Olá, ${t.admin_nome}! O Smart Entregas tem rateio automático para equipes.</p>
            <div style="background:#1c1c22;border-radius:12px;padding:16px;margin-bottom:16px">
              <p style="font-weight:700;color:#f97316;margin-bottom:8px">No plano Pro você tem:</p>
              <p style="color:#a0a0b8;font-size:13px;margin-bottom:6px">✓ Rateio automático 60/40 para piloto e copiloto</p>
              <p style="color:#a0a0b8;font-size:13px;margin-bottom:6px">✓ Dashboard separado por membro</p>
              <p style="color:#a0a0b8;font-size:13px;margin-bottom:6px">✓ Resumo semanal por email para cada um</p>
              <p style="color:#a0a0b8;font-size:13px">✓ Comparativo de plataformas ML vs Shopee vs Amazon</p>
            </div>
            <p style="color:#a0a0b8;font-size:13px;margin-bottom:24px">Você ainda tem ${Math.max(0, 7-diasAtras)} dias de Pro grátis. Adicione sua equipe agora!</p>
            <a href="${process.env.FRONTEND_URL}/equipe" style="display:block;text-align:center;background:#f97316;color:white;padding:13px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">
              Adicionar equipe →
            </a>
          `)
        }

        await resend.emails.send({ from: FROM, to: t.email, subject, html }).catch(()=>{})
        await pool.query(`INSERT INTO meta_alertas_enviados (chave) VALUES ($1) ON CONFLICT DO NOTHING`, [chave])
        console.log(`[CRON] Email D+${diasAtras} enviado: ${t.email}`)
      }
    }
  } catch(e) { console.error('[CRON] Erro sequência:', e.message) }
}

// ─── ATUALIZAR STREAKS ────────────────────────────────────────────────────────
async function atualizarStreaks() {
  try {
    const { rows: tenants } = await pool.query(`SELECT id FROM tenants WHERE ativo=true`)
    for (const t of tenants) {
      const { rows: dias } = await pool.query(`
        SELECT DISTINCT (data_rota AT TIME ZONE 'America/Sao_Paulo')::date::text as data
        FROM rotas WHERE tenant_id=$1 AND status='concluida'
        ORDER BY 1 DESC LIMIT 365
      `, [t.id])
      if (!dias.length) { await pool.query(`UPDATE tenants SET streak_dias=0 WHERE id=$1`, [t.id]); continue }
      const agoraBR = new Date(new Date().toLocaleString('en-US', { timeZone:'America/Sao_Paulo' }))
      const hojeBR  = agoraBR.toISOString().slice(0,10)
      const ontemBR = new Date(new Date(agoraBR).setDate(agoraBR.getDate()-1)).toISOString().slice(0,10)
      const primeiro = dias[0].data
      let offset = primeiro===hojeBR ? 0 : primeiro===ontemBR ? 1 : null
      let streak = 0
      if (offset !== null) {
        const base = new Date(new Date().toLocaleString('en-US', { timeZone:'America/Sao_Paulo' }))
        for (let i = 0; i < dias.length; i++) {
          const esp = new Date(base); esp.setDate(base.getDate()-(i+offset))
          if (dias[i].data === esp.toISOString().slice(0,10)) streak++
          else break
        }
      }
      await pool.query(`UPDATE tenants SET streak_dias=$1, streak_ultima_data=CURRENT_DATE WHERE id=$2`, [streak, t.id])
    }
  } catch(e) { console.error('[CRON] Erro streaks:', e.message) }
}

// ─── NOTIFICAÇÃO META DIÁRIA (19h) ───────────────────────────────────────────
async function notificacaoMetaDiaria() {
  try {
    const hoje = new Date()
    const ini  = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0,10)
    const fim  = hoje.toISOString().slice(0,10)
    const { rows: tenants } = await pool.query(`
      SELECT t.id, t.nome, t.meta_mensal, u.nome as admin_nome
      FROM tenants t JOIN usuarios u ON u.tenant_id=t.id AND u.papel='admin'
      WHERE t.meta_mensal > 0 AND t.plano IN ('pro','solo') AND t.ativo=true
    `)
    for (const t of tenants) {
      const { rows: [stats] } = await pool.query(`
        SELECT COALESCE(SUM(valor_total + COALESCE(bonificacao,0) - custo_combustivel),0) as lucro
        FROM rotas WHERE tenant_id=$1 AND status='concluida' AND data_rota BETWEEN $2 AND $3
      `, [t.id, ini, fim])
      const lucro  = parseFloat(stats.lucro||0)
      const meta   = parseFloat(t.meta_mensal)
      const pct    = Math.round((lucro/meta)*100)
      if (pct >= 100) continue
      const faltam    = meta - lucro
      const diasMes   = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0).getDate()
      const diasRest  = Math.max(1, diasMes - hoje.getDate())
      const porDia    = faltam / diasRest
      const chave     = `meta_diaria_${t.id}_${hoje.toISOString().slice(0,10)}`
      const { rows: jaEnviou } = await pool.query(`SELECT 1 FROM meta_alertas_enviados WHERE chave=$1`, [chave])
      if (jaEnviou.length) continue
      // Push
      const { rows: subs } = await pool.query(`SELECT subscription_json FROM push_subscriptions WHERE tenant_id=$1`, [t.id])
      if (subs.length) {
        try {
          const webpush = require('./push')
          const payload = JSON.stringify({ title:'🎯 Meta do dia', body:`${t.admin_nome}, faltam ${fmtBRL(faltam)} para a meta. ~${fmtBRL(porDia)}/dia nos próximos ${diasRest}d.`, url:'/dashboard' })
          for (const s of subs) {
            try { await webpush.sendNotification(JSON.parse(s.subscription_json), payload) }
            catch(e) { if (e.statusCode===410) await pool.query(`DELETE FROM push_subscriptions WHERE subscription_json=$1`, [s.subscription_json]) }
          }
        } catch(_) {}
      }
      await pool.query(`INSERT INTO meta_alertas_enviados (chave) VALUES ($1) ON CONFLICT DO NOTHING`, [chave])
    }
  } catch(e) { console.error('[CRON] Erro meta diária:', e.message) }
}

// ─── RELATÓRIO MENSAL DIA 1 ───────────────────────────────────────────────────
async function relatorioMensalDia1() {
  try {
    const { resend, FROM, baseTemplate } = require('./email')
    const hoje    = new Date()
    const mesAnt  = new Date(hoje.getFullYear(), hoje.getMonth()-1, 1)
    const ini     = mesAnt.toISOString().slice(0,10)
    const fim     = new Date(hoje.getFullYear(), hoje.getMonth(), 0).toISOString().slice(0,10)
    const nomeMes = mesAnt.toLocaleDateString('pt-BR', { month:'long', year:'numeric' })

    const { rows: tenants } = await pool.query(`SELECT id, nome, plano FROM tenants WHERE ativo=true AND plano IN ('pro','solo')`)

    for (const t of tenants) {
      const { rows: [mes] } = await pool.query(`
        SELECT COUNT(*) as rotas,
               COALESCE(SUM(valor_total),0) as bruto,
               COALESCE(SUM(valor_total + COALESCE(bonificacao,0) - custo_combustivel),0) as liquido,
               COALESCE(SUM(kms),0) as kms,
               COALESCE(SUM(pacotes_entregues),0) as pacotes
        FROM rotas WHERE tenant_id=$1 AND status='concluida' AND data_rota BETWEEN $2 AND $3
      `, [t.id, ini, fim])

      if (parseInt(mes.rotas) === 0) continue

      // Mês anterior para comparativo
      const mesAnt2 = new Date(hoje.getFullYear(), hoje.getMonth()-2, 1)
      const { rows: [mesAnterior] } = await pool.query(`
        SELECT COALESCE(SUM(valor_total + COALESCE(bonificacao,0) - custo_combustivel),0) as liquido
        FROM rotas WHERE tenant_id=$1 AND status='concluida'
          AND data_rota BETWEEN $2 AND $3
      `, [t.id, mesAnt2.toISOString().slice(0,10), new Date(hoje.getFullYear(), hoje.getMonth()-1, 0).toISOString().slice(0,10)])

      const diff = parseFloat(mes.liquido) - parseFloat(mesAnterior.liquido||0)
      const pct  = parseFloat(mesAnterior.liquido) > 0 ? Math.round((diff/parseFloat(mesAnterior.liquido))*100) : null

      const { rows: usuarios } = await pool.query(`SELECT email, nome FROM usuarios WHERE tenant_id=$1 AND ativo=true`, [t.id])

      const html = baseTemplate(`
        <h2 style="font-size:20px;font-weight:800;color:#f4f4f6;margin-bottom:6px">📊 Relatório de ${nomeMes}</h2>
        <p style="color:#7c7c96;font-size:13px;margin-bottom:24px">${t.nome}</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px">
          ${[
            { l:'Rotas',    v:mes.rotas,                      c:'#f97316' },
            { l:'Pacotes',  v:mes.pacotes,                    c:'#f4f4f6' },
            { l:'Bruto',    v:fmtBRL(mes.bruto),              c:'#f97316' },
            { l:'Líquido',  v:fmtBRL(mes.liquido),            c:'#34d399' },
            { l:'KMs',      v:Number(mes.kms).toFixed(0)+'km',c:'#f4f4f6' },
            { l:'Vs mês ant', v: pct !== null ? `${pct>=0?'+':''}${pct}%` : '—', c: pct>=0?'#34d399':'#ef4444' },
          ].map(i=>`
            <div style="background:#1c1c22;border-radius:10px;padding:12px 14px">
              <p style="font-size:10px;color:#4a4a62;text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px">${i.l}</p>
              <p style="font-size:20px;font-weight:800;color:${i.c};margin:0">${i.v}</p>
            </div>
          `).join('')}
        </div>
        ${diff !== 0 ? `
          <div style="background:${diff>=0?'rgba(52,211,153,.08)':'rgba(239,68,68,.08)'};border:1px solid ${diff>=0?'rgba(52,211,153,.2)':'rgba(239,68,68,.2)'};border-radius:10px;padding:12px 14px;margin-bottom:20px">
            <p style="font-size:13px;color:${diff>=0?'#34d399':'#ef4444'}">
              ${diff>=0?'📈':'📉'} ${diff>=0?'Você lucrou':'Você lucrou menos'} ${fmtBRL(Math.abs(diff))} ${diff>=0?'a mais':'a menos'} que em ${new Date(mesAnt2).toLocaleDateString('pt-BR',{month:'long'})}.
            </p>
          </div>
        ` : ''}
        <a href="${process.env.FRONTEND_URL}/historico" style="display:block;text-align:center;background:#f97316;color:white;padding:13px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">
          Ver histórico completo →
        </a>
      `)

      for (const u of usuarios) {
        await resend.emails.send({ from: FROM, to: u.email, subject: `📊 Relatório de ${nomeMes} — ${t.nome}`, html }).catch(()=>{})
      }
      console.log(`[CRON] Relatório mensal: ${t.nome}`)
    }
  } catch(e) { console.error('[CRON] Erro relatorio mensal:', e.message) }
}

// ─── ALERTA DE REVISÃO DE VEÍCULO (9h diário) ────────────────────────────────
async function alertaRevisaoVeiculo() {
  try {
    const { resend, FROM, baseTemplate } = require('./email')
    const { rows: veiculos } = await pool.query(`
      SELECT v.id, v.nome, v.km_atual, v.km_ultima_revisao, v.km_intervalo_revisao,
             t.id as tenant_id, t.nome as tenant_nome, u.email, u.nome as admin_nome
      FROM veiculos v
      JOIN tenants t ON t.id=v.tenant_id
      JOIN usuarios u ON u.tenant_id=t.id AND u.papel='admin'
      WHERE v.ativo=true AND t.ativo=true AND t.plano IN ('pro','solo')
        AND v.km_atual > 0
    `)
    for (const v of veiculos) {
      const kmFaltam = parseFloat(v.km_intervalo_revisao||10000) - (parseFloat(v.km_atual||0) - parseFloat(v.km_ultima_revisao||0))
      if (kmFaltam > 500) continue
      const chave = `revisao_${v.id}_${new Date().toISOString().slice(0,7)}`
      const { rows: jaEnviou } = await pool.query(`SELECT 1 FROM meta_alertas_enviados WHERE chave=$1`, [chave])
      if (jaEnviou.length) continue
      const html = baseTemplate(`
        <h2 style="font-size:20px;font-weight:800;color:#f4f4f6;margin-bottom:8px">🔧 Revisão próxima</h2>
        <p style="color:#7c7c96;font-size:14px;margin-bottom:16px">Olá, ${v.admin_nome}! O veículo <strong style="color:#f97316">${v.nome}</strong> está se aproximando da revisão.</p>
        <div style="background:#1c1c22;border-radius:12px;padding:16px;margin-bottom:20px">
          <p style="color:#a0a0b8;font-size:13px;margin-bottom:6px">KM atual: <strong style="color:#f4f4f6">${Number(v.km_atual).toFixed(0)} km</strong></p>
          <p style="color:${kmFaltam<=0?'#ef4444':'#f59e0b'};font-size:13px;font-weight:700">
            ${kmFaltam <= 0 ? '⚠️ Revisão atrasada!' : `🔧 Faltam ${Number(kmFaltam).toFixed(0)} km para a revisão`}
          </p>
        </div>
        <a href="${process.env.FRONTEND_URL}/veiculos" style="display:block;text-align:center;background:#f97316;color:white;padding:13px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">
          Ver veículos →
        </a>
      `)
      await resend.emails.send({ from: FROM, to: v.email, subject: `🔧 Revisão próxima — ${v.nome}`, html }).catch(()=>{})
      await pool.query(`INSERT INTO meta_alertas_enviados (chave) VALUES ($1) ON CONFLICT DO NOTHING`, [chave])
      console.log(`[CRON] Alerta revisão: ${v.nome}`)
    }
  } catch(e) { console.error('[CRON] Erro revisão:', e.message) }
}

// ─── METAS MENSAIS — RESET DIA 1 ─────────────────────────────────────────────
async function resetarAlertasMetaMensal() {
  try {
    const hoje = new Date()
    if (hoje.getDate() !== 1) return
    // Limpa alertas do mês anterior para o novo mês começar zerado
    const mesPassado = new Date(hoje.getFullYear(), hoje.getMonth()-1, 1)
    const prefixo    = `meta_${mesPassado.getFullYear()}_${mesPassado.getMonth()+1}`
    // Não precisa resetar a meta em si — o stats já filtra pelo mês atual
    // Só limpa as chaves de alerta do mês passado para não sujar a tabela
    await pool.query(`DELETE FROM meta_alertas_enviados WHERE chave LIKE $1`, [`%_${prefixo}%`])
    console.log('[CRON] Alertas meta do mês anterior limpos')
  } catch(e) { console.error('[CRON] Erro reset meta:', e.message) }
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
function initCron() {
  if (!process.env.RESEND_API_KEY) {
    console.log('[CRON] RESEND_API_KEY não configurado — emails desativados')
    return
  }
  cron.schedule('0 8  * * 1', rodarResumoSemanal,          { timezone:'America/Sao_Paulo' }) // seg 8h
  cron.schedule('0 20 * * *', rodarNotificacaoRotasAtrasadas,{ timezone:'America/Sao_Paulo' }) // 20h
  cron.schedule('0 10 * * *', emailD1SemRota,               { timezone:'America/Sao_Paulo' }) // 10h
  cron.schedule('0 11 * * *', emailSequenciaAtivacao,        { timezone:'America/Sao_Paulo' }) // 11h D+2/D+3
  cron.schedule('0 3  * * *', expirarTrials,                 { timezone:'America/Sao_Paulo' }) // 3h
  cron.schedule('0 23 * * *', atualizarStreaks,              { timezone:'America/Sao_Paulo' }) // 23h
  cron.schedule('0 19 * * *', notificacaoMetaDiaria,         { timezone:'America/Sao_Paulo' }) // 19h
  cron.schedule('0 8  1 * *', relatorioMensalDia1,           { timezone:'America/Sao_Paulo' }) // dia 1 8h
  cron.schedule('0 8  1 * *', resetarAlertasMetaMensal,      { timezone:'America/Sao_Paulo' }) // dia 1 8h
  cron.schedule('0 9  * * *', alertaRevisaoVeiculo,          { timezone:'America/Sao_Paulo' }) // 9h
  cron.schedule('*/30 * * * *', rodarAlertasMeta,            { timezone:'America/Sao_Paulo' }) // a cada 30min
  console.log('[CRON] 10 jobs ativos: semanal, atrasadas, D+1/2/3, trial, streaks, meta, mensal, revisão')
}

module.exports = { initCron }
