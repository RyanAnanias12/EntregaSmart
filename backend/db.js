const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenants (
      id               SERIAL PRIMARY KEY,
      nome             TEXT NOT NULL,
      slug             TEXT UNIQUE NOT NULL,
      plano            TEXT NOT NULL DEFAULT 'free',
      stripe_customer  TEXT,
      stripe_sub       TEXT,
      ativo            BOOLEAN DEFAULT true,
      criado_em        TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS usuarios (
      id         SERIAL PRIMARY KEY,
      tenant_id  INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      nome       TEXT NOT NULL,
      email      TEXT UNIQUE NOT NULL,
      senha_hash TEXT NOT NULL,
      papel      TEXT NOT NULL DEFAULT 'membro',
      ativo      BOOLEAN DEFAULT true,
      criado_em  TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS veiculos (
      id          SERIAL PRIMARY KEY,
      tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      nome        TEXT NOT NULL,
      placa       TEXT,
      tipo        TEXT NOT NULL DEFAULT 'carro',
      consumo_kml NUMERIC NOT NULL DEFAULT 6.5,
      combustivel TEXT NOT NULL DEFAULT 'alcool',
      ativo       BOOLEAN DEFAULT true,
      criado_em   TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS rotas (
      id                  SERIAL PRIMARY KEY,
      tenant_id           INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      criado_por          INTEGER REFERENCES usuarios(id),
      veiculo_id          INTEGER REFERENCES veiculos(id),
      plataforma          TEXT DEFAULT 'mercado_livre',
      piloto              TEXT NOT NULL,
      copiloto            TEXT NOT NULL,
      ponto_coleta        TEXT NOT NULL,
      hora_inicio         TEXT,
      hora_fim            TEXT,
      data_rota           DATE NOT NULL DEFAULT CURRENT_DATE,
      status              TEXT NOT NULL DEFAULT 'planejada',
      kms                 NUMERIC DEFAULT 0,
      pacotes_saida       INTEGER DEFAULT 0,
      pacotes_entregues   INTEGER DEFAULT 0,
      pacotes_devolvidos  INTEGER DEFAULT 0,
      paradas             INTEGER DEFAULT 0,
      valor_total         NUMERIC DEFAULT 0,
      custo_combustivel   NUMERIC DEFAULT 0,
      lucro_liquido       NUMERIC DEFAULT 0,
      preco_combustivel   NUMERIC DEFAULT 4.69,
      observacoes         TEXT,
      notificacao_enviada BOOLEAN DEFAULT false,
      criado_em           TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS gastos_rota (
      id          SERIAL PRIMARY KEY,
      rota_id     INTEGER NOT NULL REFERENCES rotas(id) ON DELETE CASCADE,
      tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      categoria   TEXT NOT NULL DEFAULT 'outros',
      descricao   TEXT,
      valor       NUMERIC NOT NULL DEFAULT 0,
      criado_em   TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_rotas_tenant    ON rotas(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_rotas_data      ON rotas(data_rota);
    CREATE INDEX IF NOT EXISTS idx_veiculos_tenant ON veiculos(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_usuarios_tenant ON usuarios(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_gastos_rota     ON gastos_rota(rota_id);
  `)

  // Migrations existentes
  const migs = [
    `ALTER TABLE rotas ADD COLUMN IF NOT EXISTS plataforma TEXT DEFAULT 'mercado_livre'`,
    `ALTER TABLE rotas ADD COLUMN IF NOT EXISTS veiculo_id INTEGER`,
    `ALTER TABLE rotas ADD COLUMN IF NOT EXISTS preco_combustivel NUMERIC DEFAULT 4.69`,
    `ALTER TABLE rotas ADD COLUMN IF NOT EXISTS notificacao_enviada BOOLEAN DEFAULT false`,
    `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_customer TEXT`,
    `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS meta_mensal NUMERIC DEFAULT 0`,
    `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS meta_diaria NUMERIC DEFAULT 0`,
    `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS modo_solo BOOLEAN DEFAULT false`,
    `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_sub TEXT`,
    `ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS km_atual NUMERIC DEFAULT 0`,
    `ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS km_ultima_revisao NUMERIC DEFAULT 0`,
    `ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS km_intervalo_revisao NUMERIC DEFAULT 10000`,
    // Novas migrations
    `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS streak_dias INTEGER DEFAULT 0`,
    `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS streak_ultima_data DATE`,
    `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0`,
    `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_concluido BOOLEAN DEFAULT false`,
    `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS preco_combustivel_padrao NUMERIC DEFAULT 4.69`,
  ]
  for (const m of migs) { await pool.query(m).catch(()=>{}) }

  // Tabelas novas
  await pool.query(`
    CREATE TABLE IF NOT EXISTS despesas_fixas (
      id          SERIAL PRIMARY KEY,
      tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      categoria   TEXT NOT NULL DEFAULT 'outros',
      descricao   TEXT NOT NULL,
      valor       NUMERIC NOT NULL DEFAULT 0,
      recorrente  BOOLEAN DEFAULT true,
      ativo       BOOLEAN DEFAULT true,
      criado_em   TIMESTAMP DEFAULT NOW()
    )
  `).catch(()=>{})
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_despesas_tenant ON despesas_fixas(tenant_id)`).catch(()=>{})
  await pool.query(`ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS km_atual NUMERIC DEFAULT 0`).catch(()=>{})

  await pool.query(`
    CREATE TABLE IF NOT EXISTS abastecimentos (
      id            SERIAL PRIMARY KEY,
      tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      veiculo_id    INTEGER REFERENCES veiculos(id) ON DELETE SET NULL,
      data          DATE NOT NULL DEFAULT CURRENT_DATE,
      litros        NUMERIC NOT NULL DEFAULT 0,
      valor_total   NUMERIC NOT NULL DEFAULT 0,
      km_momento    NUMERIC DEFAULT 0,
      combustivel   TEXT NOT NULL DEFAULT 'gasolina',
      posto         TEXT,
      observacoes   TEXT,
      criado_em     TIMESTAMP DEFAULT NOW()
    )
  `).catch(()=>{})
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_abastec_tenant ON abastecimentos(tenant_id)`).catch(()=>{})
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_abastec_data   ON abastecimentos(data)`).catch(()=>{})

  await pool.query(`
    CREATE TABLE IF NOT EXISTS meta_alertas_enviados (
      chave      TEXT PRIMARY KEY,
      criado_em  TIMESTAMP DEFAULT NOW()
    )
  `).catch(()=>{})

  // BONIFICAÇÕES
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bonificacoes (
      id          SERIAL PRIMARY KEY,
      tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      plataforma  TEXT NOT NULL DEFAULT 'mercado_livre',
      descricao   TEXT NOT NULL,
      valor       NUMERIC NOT NULL DEFAULT 0,
      data        DATE NOT NULL DEFAULT CURRENT_DATE,
      tipo        TEXT NOT NULL DEFAULT 'desafio',
      criado_em   TIMESTAMP DEFAULT NOW()
    )
  `).catch(()=>{})
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_bonif_tenant ON bonificacoes(tenant_id)`).catch(()=>{})
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_bonif_data   ON bonificacoes(data)`).catch(()=>{})

  console.log('[DB] Tabelas prontas')
}

module.exports = { pool, initDB }

// Executar após o initDB existente
;(async () => {
  const extra = [
    `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS mp_payment_id TEXT`,
    `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plano_expira_em TIMESTAMP`,
    `CREATE TABLE IF NOT EXISTS historico_combustivel (
      id         SERIAL PRIMARY KEY,
      tenant_id  INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      data       DATE NOT NULL DEFAULT CURRENT_DATE,
      preco      NUMERIC NOT NULL,
      combustivel TEXT NOT NULL DEFAULT 'gasolina',
      criado_em  TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_hcomb_tenant ON historico_combustivel(tenant_id)`,
    `CREATE INDEX IF NOT EXISTS idx_hcomb_data   ON historico_combustivel(data)`,
  ]
  for (const q of extra) {
    try { await pool.query(q) } catch(_) {}
  }
})()
