import { Client } from 'pg'
import {
  DbSchema,
  IDbResult,
  DbConnection,
  IDataRequest,
  RowUpdate,
  UpdateResult
} from '../../shared/types'
import { IDbService } from './IDbService'

export class PostgresService implements IDbService {
  private client: Client | null = null

  async connect(config: DbConnection): Promise<string> {
    try {
      await this.disconnect()
      const connectionUri = `postgresql://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}`
      this.client = new Client({ connectionString: connectionUri })
      await this.client.connect()
      return 'PostgreSQL Connected!'
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(msg)
    }
  }

  async execute(sql: string): Promise<IDbResult> {
    const start = performance.now()
    try {
      if (!this.client) throw new Error('Not connected')
      const res = await this.client.query(sql)
      let rows: Record<string, unknown>[] = []
      let columns: string[] = []
      if (Array.isArray(res)) {
        for (let i = res.length - 1; i >= 0; i--) {
          const r = res[i]
          if (r.command === 'SELECT') {
            rows = r.rows
            columns = r.fields.map((f) => f.name)
            break
          }
        }
      } else {
        rows = res.rows
        columns = res.fields.map((f) => f.name)
      }
      return { rows, columns, duration: Math.round(performance.now() - start) }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { rows: [], columns: [], duration: 0, error: msg }
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.end()
      this.client = null
    }
  }

  async getTables(dbName: string = 'public'): Promise<string[]> {
    if (!this.client) return []
    try {
      const sql = `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = $1
        ORDER BY table_name;
      `
      const res = await this.client.query(sql, [dbName])
      return res.rows.map((row) => row.table_name)
    } catch (e) {
      console.error('Error fetching tables:', e)
      return []
    }
  }

  async getDatabases(): Promise<string[]> {
    if (!this.client) return []
    try {
      const sql = `SELECT schema_name FROM information_schema.schemata
                   WHERE schema_name NOT IN ('information_schema', 'pg_catalog')`
      const res = await this.client.query(sql)
      return res.rows.map((row) => row.schema_name)
    } catch (e) {
      console.error('Error fetching schemas:', e)
      return []
    }
  }

  async getSchema(dbName?: string): Promise<DbSchema> {
    if (!this.client) return {}

    // Если dbName не передан, пытаемся использовать current_schema(), но лучше явно
    // Но для обратной совместимости: если dbName есть - используем его.
    // Если нет - используем current_schema() как раньше (или 'public' если так было)

    let whereClause = 'table_schema = current_schema()'
    const params: string[] = []

    if (dbName) {
      whereClause = 'table_schema = $1'
      params.push(dbName)
    }

    const sql = `
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE ${whereClause}
      ORDER BY table_name, ordinal_position;
    `
    const res = await this.client.query(sql, params)
    const schema: DbSchema = {}
    for (const row of res.rows) {
      const tableName = row.table_name
      const colName = row.column_name
      if (!schema[tableName]) schema[tableName] = []
      schema[tableName].push(colName)
    }
    return schema
  }

  async getTableData(req: IDataRequest): Promise<IDbResult> {
    if (!this.client) return { rows: [], columns: [], duration: 0, error: 'Not connected' }
    try {
      const tables = await this.getTables()
      if (!tables.includes(req.tableName)) {
        throw new Error(`Invalid table name: ${req.tableName}`)
      }

      const quoteChar = '"'
      let sql = `SELECT * FROM ${quoteChar}${req.tableName}${quoteChar}`

      if (req.sort && req.sort.length > 0) {
        const orderClauses = req.sort.map((s) => {
          if (s.colId.includes(quoteChar)) {
            throw new Error(`Invalid column name: ${s.colId}`)
          }
          return `${quoteChar}${s.colId}${quoteChar} ${s.sort.toUpperCase()}`
        })
        sql += ` ORDER BY ${orderClauses.join(', ')}`
      }

      const limit = Number(req.limit)
      const offset = Number(req.offset)

      if (isNaN(limit) || isNaN(offset)) {
        throw new Error('Invalid limit/offset')
      }

      sql += ` LIMIT ${limit} OFFSET ${offset}`

      return await this.execute(sql)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { rows: [], columns: [], error: msg, duration: 0 }
    }
  }

  async setActiveDatabase(dbName: string): Promise<void> {
    if (!this.client) throw new Error('Not connected')
    await this.client.query(`SET search_path TO "${dbName}"`)
  }

  async getPrimaryKeys(tableName: string): Promise<string[]> {
    if (!this.client) return []
    try {
      const sql = `
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_name = $1
          AND tc.table_schema = current_schema()
        ORDER BY kcu.ordinal_position;
      `
      const res = await this.client.query(sql, [tableName])
      return res.rows.map((row) => row.column_name)
    } catch (e) {
      console.error('Error fetching primary keys:', e)
      return []
    }
  }

  async updateRows(updates: RowUpdate[]): Promise<UpdateResult> {
    if (!this.client) {
      return { success: false, affectedRows: 0, error: 'Not connected' }
    }

    try {
      let totalAffected = 0

      for (const update of updates) {
        const { tableName, primaryKeys, changes } = update

        if (Object.keys(changes).length === 0) continue

        const setClauses: string[] = []
        const whereClauses: string[] = []
        const values: unknown[] = []
        let paramIndex = 1

        for (const [col, val] of Object.entries(changes)) {
          setClauses.push(`"${col}" = $${paramIndex++}`)
          values.push(val)
        }

        for (const [col, val] of Object.entries(primaryKeys)) {
          whereClauses.push(`"${col}" = $${paramIndex++}`)
          values.push(val)
        }

        const sql = `UPDATE "${tableName}" SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`

        const res = await this.client.query(sql, values)
        totalAffected += res.rowCount || 0
      }

      return { success: true, affectedRows: totalAffected }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { success: false, affectedRows: 0, error: msg }
    }
  }

  async getDashboardMetrics(): Promise<import('../../shared/types').DashboardMetrics> {
    if (!this.client) throw new Error('Not connected')

    // 1. Version
    const verRes = await this.client.query('SELECT version()')
    const version = verRes.rows[0].version

    // 2. Uptime (Postmaster start time)
    const timeRes = await this.client.query('SELECT pg_postmaster_start_time()')
    const startTime = new Date(timeRes.rows[0].pg_postmaster_start_time)
    const uptimeMs = Date.now() - startTime.getTime()
    // Simple duration formatter
    const uptime = this.formatDuration(uptimeMs)

    // 3. Active/Max Connections
    const conRes = await this.client.query('SELECT count(*) as cnt FROM pg_stat_activity')
    const activeConnections = parseInt(conRes.rows[0].cnt) || 0

    const maxConRes = await this.client.query('SHOW max_connections')
    const maxConnections = parseInt(maxConRes.rows[0].max_connections) || 100 // Default to 100 if fetch fails

    // 4. DB Size
    const sizeRes = await this.client.query(
      'SELECT pg_size_pretty(pg_database_size(current_database())) as size'
    )
    const dbSize = sizeRes.rows[0].size || '0 B'

    // 5. Indexes Size
    const idxSizeRes = await this.client.query(
      'SELECT pg_size_pretty(sum(pg_relation_size(indexrelid))) as size FROM pg_stat_user_indexes'
    )
    const indexesSize = idxSizeRes.rows[0].size || '0 B'

    // 6. Table Count
    const tableRes = await this.client.query(
      "SELECT count(*) as cnt FROM information_schema.tables WHERE table_schema = 'public'"
    )
    const tableCount = parseInt(tableRes.rows[0].cnt) || 0

    // 7. Cache Hit Ratio
    const cacheRes = await this.client.query(`
      SELECT 
        sum(heap_blks_hit) as hits,
        sum(heap_blks_read) as reads
      FROM pg_statio_user_tables
    `)
    const hits = parseInt(cacheRes.rows[0].hits || 0)
    const reads = parseInt(cacheRes.rows[0].reads || 0)
    const total = hits + reads
    const cacheHitRatio = total > 0 ? hits / total : 0

    // 8. Top Queries
    const queriesSql = `
      SELECT pid, usename as user, state,
             (extract(epoch from (now() - query_start))::numeric(10, 2) || 's') as duration,
             query
      FROM pg_stat_activity
      WHERE state = 'active' AND pid <> pg_backend_pid()
      ORDER BY query_start ASC
      LIMIT 5
    `
    const qRes = await this.client.query(queriesSql)
    const topQueries = qRes.rows.map((r) => ({
      pid: r.pid,
      user: r.user || 'system',
      state: r.state || 'active',
      duration: r.duration,
      query: r.query || ''
    }))

    return {
      version,
      uptime,
      activeConnections,
      maxConnections,
      dbSize,
      indexesSize,
      tableCount,
      cacheHitRatio,
      topQueries
    }
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ${hours % 24}h`
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }
}
