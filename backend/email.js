const { Resend } = require('resend')

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM   = process.env.EMAIL_FROM || 'Smart Entregas <noreply@entregasml.com>'

function fmtBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

function fmtData(d) {
  if (!d) return '—'
  const s = typeof d === 'string' ? d.slice(0,10) : new Date(d).toISOString().slice(0,10)
  return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR')
}

function baseTemplate(content) {
  return `
<!DOCTYPE html>
<html lang="pt-br">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px">
      <div style="background:#f97316;width:32px;height:32px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-size:16px">🚚</div>
      <span style="font-size:18px;font-weight:800;color:#f4f4f6">Smart<span style="color:#f97316">Entregas</span></span>
    </div>
    ${content}
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;font-size:11px;color:#4a4a62">
      Smart Entregas · Sistema de controle de rotas
    </div>
  </div>
</body>
</html>`
}

// Nova rota criada
async function enviarNotificacaoRotaCriada(rota, emails, tenantNome) {
  if (!emails?.length) return
  const html = baseTemplate(`
    <h2 style="font-size:20px;font-weight:800;color:#f4f4f6;margin-bottom:6px">Nova rota registrada</h2>
    <p style="color:#7c7c96;font-size:13px;margin-bottom:24px">${tenantNome}</p>
    <div style="background:#141418;border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden;margin-bottom:20px">
      <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06)">
        <div style="display:flex;gap:8px;margin-bottom:10px">
          <span style="background:rgba(249,115,22,0.09);color:#fb923c;border:1px solid rgba(249,115,22,0.2);padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600">▶ ${rota.piloto}</span>
          <span style="background:rgba(255,255,255,0.05);color:#7c7c96;border:1px solid rgba(255,255,255,0.06);padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600">${rota.copiloto}</span>
        </div>
      </div>
      <div style="padding:16px 20px">
        <table style="width:100%;border-collapse:collapse">
          ${[
            ['📍 Ponto de coleta', rota.ponto_coleta],
            ['📅 Data', fmtData(rota.data_rota)],
            ['🕐 Horário', rota.hora_inicio ? `${rota.hora_inicio} → ${rota.hora_fim || '?'}` : '—'],
            ['📦 Pacotes saída', rota.pacotes_saida || '—'],
            ['💰 Valor previsto', fmtBRL(rota.valor_total)],
          ].map(([l, v]) => `
            <tr>
              <td style="padding:7px 0;color:#7c7c96;font-size:13px">${l}</td>
              <td style="padding:7px 0;color:#f4f4f6;font-size:13px;text-align:right;font-weight:500">${v}</td>
            </tr>
          `).join('')}
        </table>
      </div>
    </div>
    ${rota.observacoes ? `<p style="color:#7c7c96;font-size:13px;padding:12px 16px;background:#1c1c22;border-radius:8px">📝 ${rota.observacoes}</p>` : ''}
  `)

  for (const email of emails) {
    await resend.emails.send({ from: FROM, to: email, subject: `🚚 Nova rota — ${rota.ponto_coleta}`, html }).catch(console.error)
  }
}

// Rota concluída com rateio
async function enviarNotificacaoRotaConcluida(rota, rateio, emails, tenantNome, gastos = []) {
  if (!emails?.length) return
  const rateioHtml = rateio.map(p => `
    <tr>
      <td style="padding:8px 0;color:#f4f4f6;font-size:13px;font-weight:500">${p.nome}</td>
      <td style="padding:8px 0;color:#7c7c96;font-size:12px">${p.role}</td>
      <td style="padding:8px 0;color:#34d399;font-size:14px;font-weight:700;text-align:right;font-family:monospace">${fmtBRL(p.valor)}</td>
    </tr>
  `).join('')

  const html = baseTemplate(`
    <h2 style="font-size:20px;font-weight:800;color:#f4f4f6;margin-bottom:6px">✅ Rota concluída!</h2>
    <p style="color:#7c7c96;font-size:13px;margin-bottom:24px">${tenantNome}</p>
    <div style="text-align:center;background:#141418;border:1px solid rgba(16,185,129,0.2);border-radius:12px;padding:24px;margin-bottom:16px">
      <p style="font-size:11px;color:#4a4a62;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">Lucro líquido</p>
      <p style="font-size:36px;font-weight:800;color:#34d399;margin:0">${fmtBRL(rota.lucro_liquido)}</p>
      <p style="font-size:12px;color:#4a4a62;margin-top:6px">Bruto ${fmtBRL(rota.valor_total)} — Combustível ${fmtBRL(rota.custo_combustivel)}</p>
    </div>
    <div style="background:#141418;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:16px 20px;margin-bottom:16px">
      <table style="width:100%;border-collapse:collapse">
        ${[
          ['📍 Ponto', rota.ponto_coleta],
          ['📅 Data', fmtData(rota.data_rota)],
          ['🛣️ KMs', rota.kms ? `${rota.kms} km` : '—'],
          ['📦 Entregues', `${rota.pacotes_entregues || 0} de ${rota.pacotes_saida || 0}`],
          ['↩️ Devolvidos', rota.pacotes_devolvidos || 0],
        ].map(([l, v]) => `
          <tr>
            <td style="padding:7px 0;color:#7c7c96;font-size:13px">${l}</td>
            <td style="padding:7px 0;color:#f4f4f6;font-size:13px;text-align:right;font-weight:500">${v}</td>
          </tr>
        `).join('')}
      </table>
    </div>
    <div style="background:#141418;border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden">
      <div style="padding:12px 20px;border-bottom:1px solid rgba(255,255,255,0.06)">
        <p style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4a4a62;margin:0">Rateio (piloto 60% · copiloto 40%)</p>
      </div>
      <div style="padding:8px 20px">
        <table style="width:100%;border-collapse:collapse">${rateioHtml}</table>
      </div>
    </div>
  `)

  for (const email of emails) {
    await resend.emails.send({ from: FROM, to: email, subject: `✅ Rota concluída — ${fmtBRL(rota.lucro_liquido)} líquido`, html }).catch(console.error)
  }
}

// Resumo semanal
async function enviarResumoSemanal(stats, rateio, emails, tenantNome, periodo) {
  if (!emails?.length) return
  const rateioHtml = rateio.map(p => `
    <tr style="border-bottom:1px solid rgba(255,255,255,0.06)">
      <td style="padding:10px 16px;color:#f4f4f6;font-size:13px;font-weight:500">${p.nome}</td>
      <td style="padding:10px 16px;color:#34d399;font-size:15px;font-weight:700;text-align:right;font-family:monospace">${fmtBRL(p.valor)}</td>
    </tr>
  `).join('')

  const html = baseTemplate(`
    <h2 style="font-size:20px;font-weight:800;color:#f4f4f6;margin-bottom:6px">📊 Resumo da semana</h2>
    <p style="color:#7c7c96;font-size:13px;margin-bottom:24px">${tenantNome} · ${periodo}</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px">
      ${[
        { label:'Rotas', val: stats.total_rotas, color:'#f97316' },
        { label:'Lucro líquido', val: fmtBRL(stats.total_liquido), color:'#34d399' },
        { label:'Faturamento bruto', val: fmtBRL(stats.total_bruto), color:'#f4f4f6' },
        { label:'KMs rodados', val: `${Number(stats.total_kms).toFixed(0)} km`, color:'#f4f4f6' },
      ].map(item => `
        <div style="background:#1c1c22;border-radius:10px;padding:14px 16px">
          <p style="font-size:10px;color:#4a4a62;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">${item.label}</p>
          <p style="font-size:22px;font-weight:800;color:${item.color};margin:0">${item.val}</p>
        </div>
      `).join('')}
    </div>
    <div style="background:#141418;border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden">
      <div style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06)">
        <p style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4a4a62;margin:0">Rateio acumulado da semana</p>
      </div>
      <table style="width:100%;border-collapse:collapse">${rateioHtml}</table>
    </div>
  `)

  for (const email of emails) {
    await resend.emails.send({ from: FROM, to: email, subject: `📊 Resumo semanal — ${tenantNome}`, html }).catch(console.error)
  }
}

// Email de boas vindas
async function enviarBoasVindas(nome, email, tenantNome) {
  const html = baseTemplate(`
    <h2 style="font-size:22px;font-weight:800;color:#f4f4f6;margin-bottom:8px">Bem-vindo ao Smart Entregas! 🎉</h2>
    <p style="color:#7c7c96;font-size:14px;margin-bottom:24px">Olá ${nome}, sua equipe <strong style="color:#f4f4f6">${tenantNome}</strong> foi criada com sucesso.</p>
    <div style="background:#141418;border:1px solid rgba(249,115,22,0.2);border-radius:12px;padding:20px;margin-bottom:20px">
      <p style="color:#f4f4f6;font-size:14px;font-weight:600;margin-bottom:12px">Próximos passos:</p>
      ${[
        '1. Cadastre os veículos da equipe',
        '2. Adicione os membros da equipe',
        '3. Registre a primeira rota',
        '4. Acompanhe o rateio no dashboard',
      ].map(s => `<p style="color:#7c7c96;font-size:13px;margin:6px 0">✓ ${s}</p>`).join('')}
    </div>
    <a href="${process.env.FRONTEND_URL}" style="display:block;text-align:center;background:#f97316;color:white;padding:13px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">
      Acessar o sistema →
    </a>
  `)
  await resend.emails.send({ from: FROM, to: email, subject: '🚚 Bem-vindo ao Smart Entregas!', html }).catch(console.error)
}

// Rotas atrasadas — enviado às 20h se houver rotas não concluídas do dia
async function enviarRotasAtrasadas(rotas, emails, tenantNome, data) {
  if (!emails?.length || !rotas?.length) return
  const dataFmt = data.split('-').reverse().join('/')
  const rotasHtml = rotas.map(r => `
    <div style="background:#1c1c22;border-radius:10px;padding:14px 16px;margin-bottom:8px;border-left:3px solid #f59e0b">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:13px;font-weight:600;color:#f4f4f6">${r.piloto} + ${r.copiloto}</span>
        <span style="background:rgba(245,158,11,.15);color:#f59e0b;padding:2px 8px;border-radius:99px;font-size:11px">${r.status === 'em_andamento' ? 'Em andamento' : 'Planejada'}</span>
      </div>
      <p style="font-size:12px;color:#7c7c96">📍 ${r.ponto_coleta}${r.hora_inicio ? ` · 🕐 ${r.hora_inicio}` : ''}</p>
    </div>
  `).join('')

  const html = baseTemplate(`
    <h2 style="font-size:20px;font-weight:800;color:#f4f4f6;margin-bottom:6px">⚠️ Rotas não concluídas hoje</h2>
    <p style="color:#7c7c96;font-size:13px;margin-bottom:20px">${tenantNome} · ${dataFmt}</p>
    <div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:10px;padding:14px 16px;margin-bottom:20px">
      <p style="color:#f59e0b;font-size:13px;font-weight:500">
        ${rotas.length} rota${rotas.length > 1 ? 's' : ''} ainda não ${rotas.length > 1 ? 'foram concluídas' : 'foi concluída'} hoje.
        Lembre-se de atualizar o status para manter o controle correto.
      </p>
    </div>
    ${rotasHtml}
    <a href="${process.env.FRONTEND_URL}/rotas" style="display:block;text-align:center;background:#f97316;color:white;padding:13px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;margin-top:20px">
      Atualizar rotas →
    </a>
  `)

  for (const email of emails) {
    await resend.emails.send({ from: FROM, to: email, subject: `⚠️ ${rotas.length} rota(s) não concluída(s) hoje — ${tenantNome}`, html }).catch(console.error)
  }
}

module.exports = { enviarNotificacaoRotaCriada, enviarNotificacaoRotaConcluida, enviarResumoSemanal, enviarBoasVindas, enviarRotasAtrasadas }
