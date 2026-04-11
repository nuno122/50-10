const dotenv = require('dotenv');
const sql = require('mssql');

dotenv.config();

function parseBoolean(value, defaultValue = false) {
    if (value === undefined) {
        return defaultValue;
    }

    return String(value).toLowerCase() === 'true';
}

function getSqlConfig() {
    const connectionString = process.env.DATABASE_URL || '';

    if (!connectionString.startsWith('sqlserver://')) {
        throw new Error('DATABASE_URL invalida para SQL Server.');
    }

    const withoutProtocol = connectionString.replace('sqlserver://', '');
    const [serverPart, ...rawOptions] = withoutProtocol.split(';');
    const [server, rawPort] = serverPart.split(':');

    const optionsMap = rawOptions.reduce((acc, entry) => {
        const [key, ...rest] = entry.split('=');

        if (!key || rest.length === 0) {
            return acc;
        }

        acc[key] = rest.join('=');
        return acc;
    }, {});

    return {
        server,
        port: rawPort ? Number(rawPort) : 1433,
        user: optionsMap.user,
        password: optionsMap.password,
        database: optionsMap.database,
        options: {
            encrypt: parseBoolean(optionsMap.encrypt, false),
            trustServerCertificate: parseBoolean(optionsMap.trustServerCertificate, true),
        },
    };
}

async function query(queryText) {
    const pool = await sql.connect(getSqlConfig());

    try {
        const result = await pool.request().query(queryText);
        return result.recordset;
    } finally {
        await pool.close();
    }
}

module.exports = { query };
