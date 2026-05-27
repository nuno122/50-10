const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const sql = require('mssql');

dotenv.config();

const SOURCE_DATABASE_URL = process.env.SQLSERVER_SOURCE_DATABASE_URL
    || 'sqlserver://localhost:1433;database=EntArtes_Projeto;user=sa;password=12345;encrypt=false;trustServerCertificate=true';

const OUTPUT_FILE = path.join(__dirname, 'generated', 'supabase-import.sql');

const tables = [
    { source: 'Pais' },
    { source: 'Distrito' },
    { source: 'Cidade' },
    { source: 'CodigoPostal' },
    { source: 'Utilizador' },
    { source: 'Aluno' },
    { source: 'Professor' },
    { source: 'Encarregado' },
    { source: 'EncarregadoAluno' },
    { source: 'EstiloDanca' },
    { source: 'Estudio' },
    { source: 'EstiloProfessor' },
    { source: 'EstudioEstilo' },
    { source: 'Disponibilidade' },
    { source: 'Artigo' },
    { source: 'TamanhoArtigo' },
    { source: 'Aula' },
    { source: 'Marcacao' },
    { source: 'Aluguer' },
    { source: 'ArtigoAluguer' },
    { source: 'Pagamento' },
    { source: 'PedidoExtensao' },
    { source: 'PedidoAula' },
    { source: 'Evento' },
    { source: 'EventoComentario' },
];

const reverseTables = [...tables].reverse();

const dateOnlyColumns = new Set([
    'Aluno.DataNascimento',
    'Aluguer.DataLevantamento',
    'Aluguer.DataEntrega',
    'Aula.Data',
    'Disponibilidade.Data',
    'Evento.DataEvento',
    'Pagamento.DataPagamento',
    'Pagamento.PrazoPagamento',
    'PedidoAula.DataPretendida',
    'PedidoExtensao.NovaDataProposta',
    'PedidoExtensao.DataPedido',
    'Utilizador.ValidadeCartaoCidadao',
]);

const timeOnlyColumns = new Set([
    'Aula.HoraInicio',
    'Aula.HoraFim',
    'Disponibilidade.HoraInicio',
    'Disponibilidade.HoraFim',
    'PedidoAula.HoraPretendida',
]);

function parseBoolean(value, defaultValue = false) {
    if (value === undefined) {
        return defaultValue;
    }

    return String(value).toLowerCase() === 'true';
}

function getSqlServerConfig(connectionString) {
    if (!connectionString.startsWith('sqlserver://')) {
        throw new Error('SQLSERVER_SOURCE_DATABASE_URL invalida para SQL Server.');
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

function escapeIdentifier(value) {
    return `"${String(value).replace(/"/g, '""')}"`;
}

function escapeString(value) {
    return String(value).replace(/'/g, "''");
}

function formatDate(date) {
    return date.toISOString().slice(0, 10);
}

function formatTime(date) {
    return date.toISOString().slice(11, 23);
}

function formatTimestamp(date) {
    return date.toISOString().replace('T', ' ').replace('Z', '+00:00');
}

function formatValue(tableName, columnName, value) {
    if (value === null || value === undefined) {
        return 'NULL';
    }

    if (Buffer.isBuffer(value)) {
        return `'\\\\x${value.toString('hex')}'`;
    }

    if (value instanceof Date) {
        const qualifiedColumn = `${tableName}.${columnName}`;

        if (timeOnlyColumns.has(qualifiedColumn)) {
            return `'${formatTime(value)}'`;
        }

        if (dateOnlyColumns.has(qualifiedColumn)) {
            return `'${formatDate(value)}'`;
        }

        return `'${formatTimestamp(value)}'`;
    }

    if (typeof value === 'boolean') {
        return value ? 'TRUE' : 'FALSE';
    }

    if (typeof value === 'number') {
        return Number.isFinite(value) ? String(value) : 'NULL';
    }

    return `'${escapeString(value)}'`;
}

function buildInsertStatement(tableName, rows) {
    if (!rows.length) {
        return '';
    }

    const columns = Object.keys(rows[0]);
    const columnSql = columns.map(escapeIdentifier).join(', ');
    const valuesSql = rows
        .map((row) => {
            const values = columns.map((column) => formatValue(tableName, column, row[column]));
            return `(${values.join(', ')})`;
        })
        .join(',\n');

    return `INSERT INTO ${escapeIdentifier(tableName)} (${columnSql}) VALUES\n${valuesSql};`;
}

async function main() {
    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });

    const pool = await sql.connect(getSqlServerConfig(SOURCE_DATABASE_URL));

    try {
        const statements = ['BEGIN;'];

        for (const { source } of reverseTables) {
            statements.push(`DELETE FROM ${escapeIdentifier(source)};`);
        }

        for (const { source } of tables) {
            const result = await pool.request().query(`SELECT * FROM ${source}`);
            const rows = result.recordset;

            if (!rows.length) {
                console.log(`${source}: 0 registos`);
                continue;
            }

            statements.push(buildInsertStatement(source, rows));
            console.log(`${source}: ${rows.length} registos preparados`);
        }

        statements.push('COMMIT;');

        fs.writeFileSync(OUTPUT_FILE, `${statements.filter(Boolean).join('\n\n')}\n`, 'utf8');
        console.log(`SQL gerado em ${OUTPUT_FILE}`);
    } finally {
        await pool.close();
    }
}

main().catch((error) => {
    console.error('Falha na geracao da migracao:', error);
    process.exit(1);
});
