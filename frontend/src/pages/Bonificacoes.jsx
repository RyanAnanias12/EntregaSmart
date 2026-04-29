import { useState, useEffect } from 'react'
import { fetchBonificacoes, fetchBonificacoesStats, criarBonificacao, editarBonificacao, deletarBonificacao, fmtBRL, PLATAFORMAS, TIPOS_BONIF } from '../lib/api'
import { Toast } from '../components/Toast'
import { useAuth } from '../context/AuthContext'

const MESES = (() => {
  const r = [], hoje = new Date()
  for (let i = 0; i < 6; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth()-i, 1)
    r.push({ val:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`, label: d.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}) })
  }
  return r
})()

const VAZIO = { plataforma:'mercado_livre', descricao:'', valor:'', data:new Date().toISOString().slice(0,10), tipo:'desafio' }

export default function Bonificacoes() {
  const { tenant } = useAuth()
  const isPaid = ['pro','solo'].includes(tenant?.plano)
  const [lista,    setLista]    = useState([])
  const [stats,    setStats]    = useState(null)
  const [mes,      setMes]      = useState(MESES[0].val)
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form,     setForm]     = useState(VAZIO)
  const [saving,   setSaving]   = useState(false)
  const [toast,    setToast]    = useState(null)
  const notify = (msg, type='success') => setToast({ msg, type })
  const sf = (k,v) => setForm(p=>({...p,[k]:v}))

  useEffect(() => { load() }, [mes])

  async function load() {
    setLoading(true)
    Promise.all([
      fetchBonificacoes(`mes=${mes}`),
      fetchBonificacoesStats(),
    ]).then(([l,s]) => { setLista(l); setStats(s) }).catch(()=>{}).finally(()=>setLoading(false))
  }

  function abrirNova() { setForm(VAZIO); setEditando(null); setShowForm(true) }
  function abrirEditar(b) { setForm({ plataforma:b.plataforma, descricao:b.descricao, valor:b.valor, data:b.data.slice(0,10), tipo:b.tipo }); setEditando(b); setShowForm(true) }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editando) { await editarBonificacao(editando.id, form); notify('Bonificação atualizada!') }
      else          { await criarBonificacao(form);                notify('Bonificação registrada!') }
      setShowForm(false); load()
    } catch(e) { notify(e.message,'error') }
    finally { setSaving(false) }
  }

  async function handleDel(id) {
    if (!confirm('Remover bonificação?')) return
    try { await deletarBonificacao(id); notify('Removido'); load() }
    catch(e) { notify(e.message,'error') }
  }

  const total = lista.reduce((a,b) => a+parseFloat(b.valor),0)

  return (
    <div style={{ padding:'28px 0 60px' }}>
      <div className="container">
        <div className="pg-header">
          <div>
            <h1 className="pg-title">🏆 Bonificações e Desafios</h1>
            <p className="pg-sub">Registre bônus extras dos apps — desafios, metas de plataforma e pagamentos especiais</p>
          </div>
          <button className="btn btn-primary" onClick={abrirNova}>+ Registrar bônus</button>
        </div>

        {/* STATS */}
        {stats && (
          <div className="grid4" style={{ marginBottom:14 }}>
            {[
              { l:'Total do mês', v:fmtBRL(stats.total_valor), c:'var(--or)' },
              { l:'Desafios',     v:fmtBRL(stats.total_desafios), c:'var(--ye)' },
              { l:'Bônus',        v:fmtBRL(stats.total_bonus),    c:'var(--gr2)' },
              { l:'Extras',       v:fmtBRL(stats.total_extras),   c:'var(--bl)' },
            ].map(k => (
              <div key={k.l} className="metric">
                <p className="metric-label">{k.l}</p>
                <p className="metric-value" style={{ color:k.c, fontSize:20 }}>{k.v}</p>
              </div>
            ))}
          </div>
        )}

        {/* FILTRO MÊS */}
        <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
          {MESES.map(m => (
            <button key={m.val} onClick={()=>setMes(m.val)} className={`btn btn-sm ${mes===m.val?'btn-primary':'btn-ghost'}`}>{m.label}</button>
          ))}
        </div>

        {/* LISTA */}
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:40 }}><div className="spinner"/></div>
        ) : lista.length === 0 ? (
          <div className="card">
            <div className="empty">
              <div className="empty-icon">🏆</div>
              <p className="empty-title">Nenhum bônus registrado</p>
              <p className="empty-sub">Registre desafios e pagamentos extras dos apps</p>
              <button className="btn btn-primary" style={{ marginTop:16 }} onClick={abrirNova}>+ Registrar primeiro bônus</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ background:'var(--od)', border:'1px solid rgba(249,115,22,.2)', borderRadius:'var(--r)', padding:'12px 16px', marginBottom:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <p style={{ fontSize:13, color:'var(--t2)' }}>{lista.length} bonificaç{lista.length===1?'ão':'ões'} em {MESES.find(m2=>m2.val===mes)?.label}</p>
              <p style={{ fontFamily:'var(--fm)', fontSize:16, color:'var(--or)', fontWeight:700 }}>{fmtBRL(total)}</p>
            </div>
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Data</th><th>Plataforma</th><th>Tipo</th><th>Descrição</th><th>Valor</th><th></th></tr>
                  </thead>
                  <tbody>
                    {lista.map(b => {
                      const tipo = TIPOS_BONIF.find(t=>t.v===b.tipo)
                      return (
                        <tr key={b.id} onClick={()=>abrirEditar(b)}>
                          <td className="hl">{new Date(b.data+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}</td>
                          <td><span className="badge badge-orange" style={{ fontSize:11 }}>{b.plataforma==='mercado_livre'?'ML':b.plataforma==='shopee'?'Shopee':b.plataforma==='amazon'?'Amazon':'Outro'}</span></td>
                          <td><span style={{ background:'rgba(255,255,255,.05)', color:tipo?.cor||'var(--t3)', border:`1px solid rgba(255,255,255,.08)`, borderRadius:99, padding:'2px 9px', fontSize:11, fontWeight:600 }}>{tipo?.l||b.tipo}</span></td>
                          <td className="hl">{b.descricao}</td>
                          <td style={{ fontFamily:'var(--fm)', color:'var(--gr2)', fontWeight:700 }}>{fmtBRL(b.valor)}</td>
                          <td onClick={e=>e.stopPropagation()}>
                            <button className="btn-icon" style={{ color:'var(--re)' }} onClick={()=>handleDel(b.id)}>✕</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* MODAL */}
      {showForm && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowForm(false)}>
          <div className="modal" style={{ maxWidth:440 }}>
            <div className="modal-header">
              <h2 className="modal-title">{editando?'Editar bonificação':'Registrar bonificação'}</h2>
              <button className="btn-icon" onClick={()=>setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="field" style={{ marginBottom:12 }}>
                  <label className="field-label">Tipo</label>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6 }}>
                    {TIPOS_BONIF.map(t => (
                      <button key={t.v} type="button" onClick={()=>sf('tipo',t.v)}
                        style={{ background:form.tipo===t.v?'rgba(255,255,255,.08)':'transparent', border:`1px solid ${form.tipo===t.v?'rgba(255,255,255,.2)':'var(--b2)'}`, borderRadius:'var(--rsm)', padding:'8px 4px', fontSize:11, color:form.tipo===t.v?t.cor:'var(--t3)', cursor:'pointer', fontWeight:form.tipo===t.v?700:400 }}>
                        {t.l}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid2" style={{ marginBottom:12 }}>
                  <div className="field">
                    <label className="field-label">Plataforma</label>
                    <select className="select" value={form.plataforma} onChange={e=>sf('plataforma',e.target.value)}>
                      {PLATAFORMAS.map(p=><option key={p.v} value={p.v}>{p.l}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">Data</label>
                    <input className="input" type="date" value={form.data} onChange={e=>sf('data',e.target.value)} required/>
                  </div>
                </div>
                <div className="field" style={{ marginBottom:12 }}>
                  <label className="field-label">Descrição do desafio / bônus</label>
                  <input className="input" placeholder="Ex: Desafio 50 pacotes semana 15" value={form.descricao} onChange={e=>sf('descricao',e.target.value)} required/>
                </div>
                <div className="field">
                  <label className="field-label">Valor (R$)</label>
                  <input className="input" type="number" step="0.01" min="0" placeholder="50,00" value={form.valor} onChange={e=>sf('valor',e.target.value)} required/>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={()=>setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Salvando...':editando?'Salvar':'Registrar bônus'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
    </div>
  )
}
