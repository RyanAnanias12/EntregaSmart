import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchRotas, criarRota, editarRota, deletarRota, fetchRota, fetchUsuarios, fmtBRL, fmtData, calcDuracao, calcRateio, buildQS, statusLabel, plataformaLabel, plataformaEmoji, iniciais, PLATAFORMAS, calcLucroPorHora } from '../lib/api'
import GastosRota from '../components/GastosRota'
import RotaForm from '../components/RotaForm'
import { Toast } from '../components/Toast'

const STATUS_OPTS = [
  { v: '', l: 'Todos os status' },
  { v: 'planejada',    l: 'Planejada' },
  { v: 'em_andamento', l: 'Em andamento' },
  { v: 'concluida',    l: 'Concluída' },
]

export default function Rotas() {
  const [rotas,    setRotas]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [detalhe,  setDetalhe]  = useState(null)
  const [toast,    setToast]    = useState(null)
  const [limiteAtingido, setLimiteAtingido] = useState(false)
  const [membros,  setMembros]  = useState([])
  const [filters,  setFilters]  = useState({ data_inicio: '', data_fim: '', piloto: '', ponto_coleta: '', status: '', plataforma: '' })
  const [searchParams, setSearchParams] = useSearchParams()

  const load = useCallback(async () => {
    setLoading(true)
    try { setRotas(await fetchRotas(buildQS(filters))) }
    catch { notify('Erro ao carregar rotas', 'error') }
    finally { setLoading(false) }
  }, [filters])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetchUsuarios().then(l => setMembros(l.filter(u => u.ativo))).catch(() => {})
    const nova   = searchParams.get('nova')
    const editar = searchParams.get('editar')
    const det    = searchParams.get('detalhe')
    if (nova === '1')   { setEditando(null); setShowForm(true); setSearchParams({}) }
    if (editar)         { fetchRota(editar).then(r => { setEditando(r); setShowForm(true) }); setSearchParams({}) }
    if (det)            { fetchRota(det).then(setDetalhe); setSearchParams({}) }
  }, [searchParams])

  const notify = (msg, type = 'success') => setToast({ msg, type })

  async function handleSave(form) {
    setSaving(true)
    try {
      if (editando) { await editarRota(editando.id, form); notify('Rota atualizada!') }
      else          { await criarRota(form);                notify('Rota criada! Email enviado.') }
      setShowForm(false); setEditando(null); setDetalhe(null); load()
    } catch (e) {
      if (e.message.includes('Limite')) {
        setShowForm(false)
        setLimiteAtingido(true)
      } else {
        notify(e.message, 'error')
      }
    }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm('Deletar esta rota permanentemente?')) return
    try { await deletarRota(id); notify('Rota removida'); setDetalhe(null); load() }
    catch { notify('Erro ao deletar', 'error') }
  }

  function openEdit(r, e) { e?.stopPropagation(); setEditando(r); setDetalhe(null); setShowForm(true) }
  const setF = (k, v) => setFilters(p => ({ ...p, [k]: v }))
  const clearFilters = () => setFilters({ data_inicio: '', data_fim: '', piloto: '', ponto_coleta: '', status: '', plataforma: '' })
  const hasFilters = Object.values(filters).some(Boolean)

  const taxa = r => {
    const s = parseInt(r.pacotes_saida) || 0
    const e = parseInt(r.pacotes_entregues) || 0
    if (!s) return null
    return Math.round((e / s) * 100)
  }

  return (
    <div style={{ padding: '28px 0 60px' }}>
      <div className="container">
        <div className="pg-header">
          <div>
            <h1 className="pg-title">Rotas</h1>
            <p className="pg-sub">{rotas.length} rota{rotas.length !== 1 ? 's' : ''} encontrada{rotas.length !== 1 ? 's' : ''}</p>
          </div>
          <button className="btn btn-primary" onClick={() => { setEditando(null); setShowForm(true) }}>+ Nova rota</button>
        </div>

        {/* FILTROS */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-header">
            <span className="card-title">Filtros</span>
            {hasFilters && <button className="btn btn-ghost btn-sm" onClick={clearFilters}>Limpar</button>}
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12 }}>
              <div className="field">
                <label className="field-label">Data início</label>
                <input className="input" type="date" value={filters.data_inicio} onChange={e => setF('data_inicio', e.target.value)}/>
              </div>
              <div className="field">
                <label className="field-label">Data fim</label>
                <input className="input" type="date" value={filters.data_fim} onChange={e => setF('data_fim', e.target.value)}/>
              </div>
              {isPaid && (
                <div className="field">
                  <label className="field-label">Piloto</label>
                  <select className="select" value={filters.piloto} onChange={e => setF('piloto', e.target.value)}>
                    <option value="">Todos</option>
                    {membros.map(m => <option key={m.nome}>{m.nome}</option>)}
                  </select>
                </div>
              )}
              <div className="field">
                <label className="field-label">Plataforma</label>
                <select className="select" value={filters.plataforma} onChange={e => setF('plataforma', e.target.value)}>
                  <option value="">Todas</option>
                  {PLATAFORMAS.map(p => <option key={p.v} value={p.v}>{p.l}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="field-label">Status</label>
                <select className="select" value={filters.status} onChange={e => setF('status', e.target.value)}>
                  {STATUS_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="field-label">Ponto de coleta</label>
                <input className="input" placeholder="Buscar..." value={filters.ponto_coleta} onChange={e => setF('ponto_coleta', e.target.value)}/>
              </div>
            </div>
          </div>
        </div>

        {/* DESKTOP TABLE */}
        <div className="card table-desktop">
          {loading ? (
            <div className="empty"><div className="spinner" style={{ margin: '0 auto' }}/></div>
          ) : rotas.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">📭</div>
              <p className="empty-title">{hasFilters ? 'Nenhum resultado' : 'Nenhuma rota ainda'}</p>
              <p className="empty-sub">{hasFilters ? 'Tente outros filtros' : 'Clique em "+ Nova rota" para começar'}</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>#</th><th>Data</th><th>Status</th><th>Plataforma</th><th>Equipe</th><th>Ponto</th><th>Veículo</th><th>KMs</th><th>Entrega</th><th>Bruto</th><th>Líquido</th><th></th></tr>
                </thead>
                <tbody>
                  {rotas.map(r => {
                    const t = taxa(r)
                    return (
                      <tr key={r.id} onClick={() => setDetalhe(r)}>
                        <td style={{ color: 'var(--t3)', fontSize: 11 }}>#{r.id}</td>
                        <td className="hl">{fmtData(r.data_rota)}</td>
                        <td><span className={`badge status-${r.status}`}>{statusLabel(r.status)}</span></td>
                        <td><span style={{ fontSize: 13 }}>{plataformaEmoji(r.plataforma)} {plataformaLabel(r.plataforma)}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            <span className="badge badge-orange">▶ {r.piloto}</span>
                            <span className="badge badge-gray">{r.copiloto}</span>
                          </div>
                        </td>
                        <td>{r.ponto_coleta || '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--t3)' }}>{r.veiculo_nome || '—'}</td>
                        <td className="hl">{r.kms ? `${r.kms} km` : '—'}</td>
                        <td>{t !== null ? <span className={`badge ${t >= 80 ? 'badge-green' : 'badge-yellow'}`}>{t}%</span> : '—'}</td>
                        <td>{fmtBRL(r.valor_total)}</td>
                        <td className="hl" style={{ color: 'var(--gr2)' }}>{r.status === 'concluida' ? fmtBRL(r.lucro_liquido) : '—'}</td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 5 }}>
                            <button className="btn-icon" onClick={e => openEdit(r, e)}>✏️</button>
                            <button className="btn-icon" style={{ color: 'var(--re)', borderColor: 'rgba(239,68,68,.2)' }} onClick={e => { e.stopPropagation(); handleDelete(r.id) }}>🗑️</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* MOBILE */}
        {!loading && rotas.map(r => {
          const t = taxa(r)
          return (
            <div key={r.id} className="rota-mobile" onClick={() => setDetalhe(r)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  <span className={`badge status-${r.status}`}>{statusLabel(r.status)}</span>
                  <span className="badge badge-orange">▶ {r.piloto}</span>
                  <span style={{ fontSize: 12 }}>{plataformaEmoji(r.plataforma)}</span>
                </div>
                {r.status === 'concluida' && <span style={{ fontFamily: 'var(--fm)', fontSize: 15, color: 'var(--gr2)' }}>{fmtBRL(r.lucro_liquido)}</span>}
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--t2)', marginBottom: 10 }}>
                <span>📍 {r.ponto_coleta || '—'}</span>
                <span>📅 {fmtData(r.data_rota)}</span>
                {r.kms > 0 && <span>🛣️ {r.kms} km</span>}
                {r.veiculo_nome && <span>🚗 {r.veiculo_nome}</span>}
                {t !== null && <span className={`badge ${t >= 80 ? 'badge-green' : 'badge-yellow'}`} style={{ fontSize: 10 }}>{t}%</span>}
              </div>
              <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                <button className="btn btn-ghost btn-sm" onClick={e => openEdit(r, e)}>✏️ Editar</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}>🗑️</button>
              </div>
            </div>
          )
        })}
      </div>

      {/* DETALHE MODAL */}
      {detalhe && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDetalhe(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Rota #{detalhe.id} {plataformaEmoji(detalhe.plataforma)}</h2>
              <button className="btn-icon" onClick={() => setDetalhe(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ textAlign: 'center', padding: '18px 0', background: 'var(--s2)', borderRadius: 'var(--rsm)' }}>
                {detalhe.status === 'concluida' ? (
                  <>
                    <p style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Lucro líquido</p>
                    <p style={{ fontFamily: 'var(--ff)', fontSize: 38, fontWeight: 800, color: 'var(--gr2)', lineHeight: 1 }}>{fmtBRL(detalhe.lucro_liquido)}</p>
                    <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 6 }}>Bruto {fmtBRL(detalhe.valor_total)} — Combustível {fmtBRL(detalhe.custo_combustivel)}</p>
                  </>
                ) : (
                  <>
                    <span className={`badge status-${detalhe.status}`} style={{ fontSize: 13, padding: '6px 16px' }}>{statusLabel(detalhe.status)}</span>
                    <p style={{ fontSize: 13, color: 'var(--t2)', marginTop: 8 }}>Valor previsto: {fmtBRL(detalhe.valor_total)}</p>
                  </>
                )}
              </div>

              <div className="grid2">
                {[
                  { label: 'Data',          val: fmtData(detalhe.data_rota) },
                  { label: 'Duração',       val: calcDuracao(detalhe.hora_inicio, detalhe.hora_fim) || '—' },
                  { label: 'Plataforma',    val: `${plataformaEmoji(detalhe.plataforma)} ${plataformaLabel(detalhe.plataforma)}` },
                  { label: 'Veículo',       val: detalhe.veiculo_nome || 'Padrão' },
                  { label: 'Ponto coleta',  val: detalhe.ponto_coleta || '—' },
                  { label: 'KMs rodados',   val: detalhe.kms ? `${detalhe.kms} km` : '—' },
                  ...(isSolo || tenant?.plano === 'pro' ? [{ label: '⏱️ Lucro por hora', val: (() => { const lph = calcLucroPorHora(detalhe.lucro_liquido, detalhe.hora_inicio, detalhe.hora_fim); return lph ? fmtBRL(lph) + '/h' : '—' })() }] : []),
                  { label: 'Saíram',        val: detalhe.pacotes_saida || '—' },
                  { label: 'Entregues',     val: detalhe.pacotes_entregues || '—' },
                  { label: 'Devolvidos',    val: detalhe.pacotes_devolvidos || '—' },
                  { label: 'Paradas',       val: detalhe.paradas || '—' },
                ].map(item => (
                  <div key={item.label} style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px 13px' }}>
                    <p style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 3 }}>{item.label}</p>
                    <p style={{ fontSize: 13, fontWeight: 500 }}>{item.val}</p>
                  </div>
                ))}
              </div>

              {detalhe.observacoes && (
                <div style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px 13px' }}>
                  <p style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 3 }}>Observações</p>
                  <p style={{ fontSize: 13, color: 'var(--t2)' }}>{detalhe.observacoes}</p>
                </div>
              )}

              <GastosRota rotaId={detalhe.id} onGastoChange={() => {
                fetchRota(detalhe.id).then(r => { setDetalhe(r); load() }).catch(() => {})
              }}/>

              {detalhe.status === 'concluida' && !isSolo && (
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 10 }}>Rateio (piloto 60% · copiloto 40%)</p>
                  {calcRateio(parseFloat(detalhe.lucro_liquido), detalhe.piloto, detalhe.copiloto).map(p => (
                    <div key={p.nome} className="rateio-row">
                      <div className="rateio-left">
                        <div className="avatar sm">{iniciais(p.nome)}</div>
                        <div><p className="rateio-nome">{p.nome}</p><p className="rateio-role">{p.role}</p></div>
                      </div>
                      <span className="rateio-val">{fmtBRL(p.valor)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(detalhe.id)}>🗑️ Deletar</button>
              <button className="btn btn-ghost btn-sm" onClick={e => openEdit(detalhe, e)}>✏️ Editar</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setDetalhe(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {limiteAtingido && (
        <div className="modal-overlay" onClick={() => setLimiteAtingido(false)}>
          <div className="modal" style={{ maxWidth:420, textAlign:'center' }}>
            <div className="modal-body" style={{ padding:'32px 28px' }}>
              <div style={{ fontSize:40, marginBottom:16 }}>🔒</div>
              <h2 style={{ fontFamily:'var(--ff)', fontSize:20, fontWeight:800, marginBottom:8 }}>Limite do plano gratuito</h2>
              <p style={{ color:'var(--t2)', fontSize:14, marginBottom:24 }}>Você atingiu o limite de 30 rotas por mês no plano gratuito. Faça upgrade para o plano Pro e crie rotas ilimitadas.</p>
              <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
                <button className="btn btn-ghost" onClick={() => setLimiteAtingido(false)}>Fechar</button>
                <button className="btn btn-primary" onClick={() => { setLimiteAtingido(false); window.location.href = '/precos' }}>⭐ Ver plano Pro</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && <RotaForm initial={editando} onSave={handleSave} onClose={() => { setShowForm(false); setEditando(null) }} loading={saving}/>}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)}/>}
    </div>
  )
}
