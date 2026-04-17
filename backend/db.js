const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

async function initDB() {
  await pool.query(`
    -- TENANTS
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

    -- USUÁRIOS
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

    -- VEÍCULOS
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

    -- ROTAS
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

    -- GASTOS EXTRAS POR ROTA
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

  // Migrações seguras
  await pool.query(`ALTER TABLE rotas ADD COLUMN IF NOT EXISTS plataforma TEXT DEFAULT 'mercado_livre'`).catch(() => {})
  await pool.query(`ALTER TABLE rotas ADD COLUMN IF NOT EXISTS veiculo_id INTEGER`).catch(() => {})
  await pool.query(`ALTER TABLE rotas ADD COLUMN IF NOT EXISTS preco_combustivel NUMERIC DEFAULT 4.69`).catch(() => {})
  await pool.query(`ALTER TABLE rotas ADD COLUMN IF NOT EXISTS notificacao_enviada BOOLEAN DEFAULT false`).catch(() => {})
  await pool.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_customer TEXT`).catch(() => {})
  await pool.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS meta_mensal NUMERIC DEFAULT 0`).catch(() => {})
  await pool.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_sub TEXT`).catch(() => {})

  console.log('[DB] Tabelas prontas')
}

module.exports = { pool, initDB }
