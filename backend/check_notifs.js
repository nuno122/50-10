
const notificationRepo = require('./src/repositories/notificationRepository');
async function main() {
    await notificationRepo.ensureTable();
    const { sql, getSqlConfig } = require('./src/database/sqlServer');
    const pool = await sql.connect(getSqlConfig());
    const result = await pool.request().query('SELECT TOP 10 * FROM dbo.Notificacao ORDER BY DataCriacao DESC');
    console.log(JSON.stringify(result.recordset, null, 2));
    await pool.close();
}
main().catch(console.error);

