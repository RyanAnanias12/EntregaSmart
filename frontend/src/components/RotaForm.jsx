import { useState, useEffect } from 'react'
import { calcCombustivel, fmtBRL, fetchVeiculos, fetchUsuarios, PLATAFORMAS } from '../lib/api'
import { useAuth } from '../context/AuthContext'

const STATUS = [
  { v: 'planejada',    l: 'Planejada'    },
  { v: 'em_andamento', l: 'Em andamento' },
  { v: 'concluida',    l: 'Concluída'    },
]
const PONTOS = ['CD Guarulhos','CD São Paulo','CD Osasco','CD Mauá','CD ABC','CD Campinas']
const EMPTY = {
  piloto: '', copiloto: '', ponto_coleta: '', hora_inicio: '', hora_fim: '',
  data_rota: new Date().toISOString().slice(0, 10), status: 'planejada',
  plataforma: 'mercado_livre', veiculo_id: '', preco_combustivel: '4.69',
  kms: '', pacotes_saida: '', pacotes_entregues: '', pacotes_devolvidos: '',
  paradas: '', valor_total: '', observacoes: '',
}

function normDate(val) {
  if (!val) return ''
  const d = new Date(val)
  if (isNaN(d)) return String(val).slice(0, 10)
  return new Date(d.getTime() + d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export default function RotaForm({ initial, onSave, onClose, loading }) {
  const { tenant } = useAuth()
  const isPro = tenant?.plano === 'pro'
  const [f, setF]           = useState(EMPTY)
  const [membros, setMembros] = useState([])
  const [veiculos, setVeiculos] = useState([])

  useEffect(() => {
    fetchUsuarios().then(l => setMembros(l.filter(u => u.ativo))).catch(() => {})
    fetchVeiculos().then(setVeiculos).catch(() => {})
  }, [])

  useEffect(() => {
    if (initial) {
      setF({ ...EMPTY, ...initial, data_rota: normDate(initial.data_rota) || EMPTY.data_rota, veiculo_id: initial.veiculo_id || '' })
    } else {
      setF(p => ({ ...EMPTY, piloto: membros[0]?.nome || '', copiloto: membros[1]?.nome || '', preco_combustivel: p.preco_combustivel }))
    }
  }, [initial])

  const s = (k, v) => setF(p => ({ ...p, [k]: v }))

  const veiculo = veiculos.find(v => String(v.id) === String(f.veiculo_id))
  const consumo = veiculo ? parseFloat(veiculo.consumo_kml) : 6.5
  const preco   = parseFloat(f.preco_combustivel) || 4.69
  const kms     = parseFloat(f.kms) || 0
  const vt      = parseFloat(f.valor_total) || 0
  const comb    = kms > 0 ? calcCombustivel(kms, consumo, preco) : 0
  const liq     = vt - comb

  const submit = e => {
    e.preventDefault()
    if (isPro && f.piloto === f.copiloto) { alert('Piloto e copiloto não podem ser iguais!'); return }
    onSave({ ...f, veiculo_id: f.veiculo_id || null, copiloto: isPro ? f.copiloto : '' })
  }

  const nomes = membros.map(m => m.nome)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{initial?.id ? '✏️ Editar rota' : '+ Nova rota'}</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">

            {/* EQUIPE */}
            <div className="modal-sect">
              <p className="modal-sect-title">Equipe</p>
              <div className="grid2">
                <div className="field">
                  <label className="field-label">Piloto</label>
                  <select className="select" value={f.piloto} onChange={e => s('piloto', e.target.value)} required>
                    <option value="">Selecione...</option>
                    {nomes.map(n => <option key={n}>{n}</option>)}
                  </select>
                </div>
                {isPro ? (
                  <div className="field">
                    <label className="field-label">Copiloto</label>
                    <select className="select" value={f.copiloto} onChange={e => s('copiloto', e.target.value)} required>
                      <option value="">Selecione...</option>
                      {nomes.map(n => <option key={n}>{n}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="field">
                    <label className="field-label">Copiloto</label>
                    <div style={{ padding:'10px 13px', background:'var(--s3)', border:'1px solid var(--b1)', borderRadius:'var(--rsm)', fontSize:13, color:'var(--t3)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                      <span>Apenas no plano Pro</span>
                      <a href="/precos" style={{ fontSize:11, color:'var(--or2)', textDecoration:'none', fontWeight:600 }}>⭐ Upgrade</a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ROTA */}
            <div className="modal-sect">
              <p className="modal-sect-title">Rota</p>
              <div className="grid2" style={{ marginBottom: 10 }}>
                <div className="field">
                  <label className="field-label">Plataforma</label>
                  <select className="select" value={f.plataforma} onChange={e => s('plataforma', e.target.value)}>
                    {PLATAFORMAS.map(p => <option key={p.v} value={p.v}>{p.l}</option>)}
                  </select>
                </div>
                {isPro ? (
                  <div className="field">
                    <label className="field-label">Veículo</label>
                    <select className="select" value={f.veiculo_id} onChange={e => s('veiculo_id', e.target.value)}>
                      <option value="">Padrão (6,5 km/L)</option>
                      {veiculos.map(v => <option key={v.id} value={v.id}>{v.nome} — {v.consumo_kml} km/L</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="field">
                    <label className="field-label">Veículo</label>
                    <div style={{ padding:'10px 13px', background:'var(--s3)', borderRadius:'var(--rsm)', fontSize:13, color:'var(--t3)' }}>
                      🔒 Padrão (6,5 km/L) · <span style={{ color:'var(--or2)' }}>Pro para veículos próprios</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="field" style={{ marginBottom: 10 }}>
                <label className="field-label">Ponto de coleta</label>
                <input className="input" list="pontos-dl" value={f.ponto_coleta} onChange={e => s('ponto_coleta', e.target.value)} placeholder="Ex: CD Guarulhos" required/>
                <datalist id="pontos-dl">{PONTOS.map(p => <option key={p} value={p}/>)}</datalist>
              </div>
              <div className="grid2" style={{ marginBottom: 10 }}>
                <div className="field">
                  <label className="field-label">Status</label>
                  <select className="select" value={f.status} onChange={e => s('status', e.target.value)}>
                    {STATUS.map(st => <option key={st.v} value={st.v}>{st.l}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Data</label>
                  <input className="input" type="date" value={f.data_rota} onChange={e => s('data_rota', e.target.value)} required/>
                </div>
              </div>
              <div className="grid2">
                <div className="field">
                  <label className="field-label">Início</label>
                  <input className="input" type="time" value={f.hora_inicio} onChange={e => s('hora_inicio', e.target.value)}/>
                </div>
                <div className="field">
                  <label className="field-label">Fim</label>
                  <input className="input" type="time" value={f.hora_fim} onChange={e => s('hora_fim', e.target.value)}/>
                </div>
              </div>
            </div>

            {/* ENTREGAS */}
            <div className="modal-sect">
              <p className="modal-sect-title">Entregas &amp; KMs</p>
              <div className="grid2" style={{ marginBottom: 10 }}>
                <div className="field">
                  <label className="field-label">KMs rodados</label>
                  <input className="input" type="number" min="0" step="1" value={f.kms} onChange={e => s('kms', e.target.value)} placeholder="0"/>
                </div>
                <div className="field">
                  <label className="field-label">Paradas</label>
                  <input className="input" type="number" min="0" step="1" value={f.paradas} onChange={e => s('paradas', e.target.value)} placeholder="0"/>
                </div>
              </div>
              <div className="grid3">
                <div className="field">
                  <label className="field-label">Saíram</label>
                  <input className="input" type="number" min="0" step="1" value={f.pacotes_saida} onChange={e => s('pacotes_saida', e.target.value)} placeholder="0"/>
                </div>
                <div className="field">
                  <label className="field-label">Entregues</label>
                  <input className="input" type="number" min="0" step="1" value={f.pacotes_entregues} onChange={e => s('pacotes_entregues', e.target.value)} placeholder="0"/>
                </div>
                <div className="field">
                  <label className="field-label">Devolvidos</label>
                  <input className="input" type="number" min="0" step="1" value={f.pacotes_devolvidos} onChange={e => s('pacotes_devolvidos', e.target.value)} placeholder="0"/>
                </div>
              </div>
            </div>

            {/* FINANCEIRO */}
            <div className="modal-sect">
              <p className="modal-sect-title">Financeiro</p>
              <div className="grid2" style={{ marginBottom: 10 }}>
                <div className="field">
                  <label className="field-label">Valor total (R$)</label>
                  <input className="input" type="number" step="0.01" min="0" value={f.valor_total} onChange={e => s('valor_total', e.target.value)} placeholder="0,00" required/>
                </div>
                <div className="field">
                  <label className="field-label">Preço combustível (R$/L)</label>
                  <input className="input" type="number" step="0.01" min="0" value={f.preco_combustivel} onChange={e => s('preco_combustivel', e.target.value)} placeholder="4.69"/>
                </div>
              </div>
              {kms > 0 && vt > 0 && (
                <div className="grid2">
                  <div style={{ background: 'var(--s3)', borderRadius: 8, padding: '10px 12px' }}>
                    <p style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4 }}>
                      Combustível ({consumo}km/L × R${preco.toFixed(2)})
                    </p>
                    <p style={{ fontFamily: 'var(--fm)', fontSize: 14, color: 'var(--ye)' }}>{fmtBRL(comb)}</p>
                  </div>
                  <div style={{ background: 'var(--s3)', borderRadius: 8, padding: '10px 12px' }}>
                    <p style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4 }}>Lucro líquido est.</p>
                    <p style={{ fontFamily: 'var(--fm)', fontSize: 14, color: liq >= 0 ? 'var(--gr2)' : 'var(--re)' }}>{fmtBRL(liq)}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="field">
              <label className="field-label">Observações (opcional)</label>
              <textarea className="textarea input" value={f.observacoes} onChange={e => s('observacoes', e.target.value)} placeholder="Qualquer anotação sobre a rota..."/>
            </div>

          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Salvando...' : initial?.id ? 'Salvar alterações' : 'Criar rota'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
