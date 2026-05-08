const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const BASE_URL = 'http://localhost:3000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'ChaveSuperSecretaDaEntArtes_2026';

// Instância partilhada do Prisma — evita fugas de conexão
const prisma = new PrismaClient();

const makeRequest = async (endpoint, method = 'GET', body = null, token = null) => {
    const headers = {
        'Content-Type': 'application/json',
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    const options = {
        method,
        headers,
    };
    if (body) {
        options.body = JSON.stringify(body);
    }
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    
    if (response.status === 204) return { status: 204, data: null };
    
    let data;
    const textData = await response.text();
    try {
        data = textData ? JSON.parse(textData) : null;
    } catch (e) {
        data = textData;
    }
    
    return { status: response.status, data };
};

/**
 * Gera um token JWT de administrador (Permissões: 3 / Direção).
 * Cria o utilizador na BD se ainda não existir.
 */
const getAdminToken = async () => {
    let cp = await prisma.codigoPostal.findFirst();
    if (!cp) {
        const pais = await prisma.pais.create({ data: { Nome: 'Portugal' } });
        const distrito = await prisma.distrito.create({ data: { Nome: 'Lisboa', IdPais: pais.IdPais } });
        const cidade = await prisma.cidade.create({ data: { Nome: 'Lisboa', IdDistrito: distrito.IdDistrito } });
        cp = await prisma.codigoPostal.create({ data: { CodigoPostal: '1000-000', IdCidade: cidade.IdCidade } });
    }

    let admin = await prisma.utilizador.findFirst({ where: { Email: 'admin@integration.test' } });
    if (!admin) {
        admin = await prisma.utilizador.create({
            data: {
                CodigoPostal: cp.CodigoPostal,
                Morada: 'Rua Admin',
                Permissoes: 3,
                NomeCompleto: 'Admin Test',
                NomeUtilizador: 'admintest',
                Email: 'admin@integration.test',
                PalavraPasseHash: 'hash',
                EstaAtivo: true,
                Nif: '999999999'
            }
        });
    }

    return jwt.sign(
        { IdUtilizador: admin.IdUtilizador, Permissoes: 3, Email: 'admin@integration.test' },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
};

/**
 * Gera um token JWT de aluno (Permissões: 1).
 * Cria o utilizador na BD se ainda não existir.
 */
const getAlunoToken = async () => {
    let cp = await prisma.codigoPostal.findFirst();
    if (!cp) {
        const pais = await prisma.pais.create({ data: { Nome: 'Portugal' } });
        const distrito = await prisma.distrito.create({ data: { Nome: 'Lisboa', IdPais: pais.IdPais } });
        const cidade = await prisma.cidade.create({ data: { Nome: 'Lisboa', IdDistrito: distrito.IdDistrito } });
        cp = await prisma.codigoPostal.create({ data: { CodigoPostal: '1000-000', IdCidade: cidade.IdCidade } });
    }

    let aluno = await prisma.utilizador.findFirst({ where: { Email: 'aluno@integration.test' } });
    if (!aluno) {
        aluno = await prisma.utilizador.create({
            data: {
                CodigoPostal: cp.CodigoPostal,
                Morada: 'Rua Aluno',
                Permissoes: 1,
                NomeCompleto: 'Aluno Test',
                NomeUtilizador: 'alunotest',
                Email: 'aluno@integration.test',
                PalavraPasseHash: 'hash',
                EstaAtivo: true,
                Nif: '888888888'
            }
        });
    }

    return jwt.sign(
        { IdUtilizador: aluno.IdUtilizador, Permissoes: 1, Email: 'aluno@integration.test' },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
};

module.exports = {
    makeRequest,
    getAdminToken,
    getAlunoToken,
    prisma,
    BASE_URL,
    JWT_SECRET
};
