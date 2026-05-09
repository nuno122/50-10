const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const BASE_URL = process.env.TEST_API_BASE_URL || 'http://localhost:3000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'ChaveSuperSecretaDaEntArtes_2026';

const prisma = new PrismaClient();

let databaseReadyPromise = null;

const makeRequest = async (endpoint, method = 'GET', body = null, token = null) => {
    const headers = {
        'Content-Type': 'application/json'
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
        method,
        headers,
        ...(body ? { body: JSON.stringify(body) } : {})
    });

    if (response.status === 204) {
        return { status: 204, data: null };
    }

    const textData = await response.text();

    try {
        return {
            status: response.status,
            data: textData ? JSON.parse(textData) : null
        };
    } catch (error) {
        return {
            status: response.status,
            data: textData
        };
    }
};

const ensureDatabaseReady = async () => {
    if (!databaseReadyPromise) {
        databaseReadyPromise = (async () => {
            try {
                await prisma.$connect();
                await prisma.$queryRawUnsafe('SELECT 1');
            } catch (error) {
                const details = error?.message || String(error);
                throw new Error(
                    `A BD de integracao nao esta acessivel. Confirma o SQL Server local, o DATABASE_URL e o estado da app/API. Detalhes: ${details}`
                );
            }
        })();
    }

    return databaseReadyPromise;
};

const ensurePostalCode = async () => {
    await ensureDatabaseReady();

    const existing = await prisma.codigoPostal.findFirst();
    if (existing) {
        return existing;
    }

    const pais = await prisma.pais.create({
        data: {
            Nome: 'Portugal',
            Sigla: 'PT'
        }
    });

    const distrito = await prisma.distrito.create({
        data: {
            Nome: 'Lisboa',
            IdPais: pais.IdPais
        }
    });

    const cidade = await prisma.cidade.create({
        data: {
            Nome: 'Lisboa',
            IdDistrito: distrito.IdDistrito
        }
    });

    return await prisma.codigoPostal.create({
        data: {
            CodigoPostal: '1000-000',
            IdCidade: cidade.IdCidade
        }
    });
};

const ensureUser = async ({
    email,
    nomeCompleto,
    nomeUtilizador,
    permissoes,
    nif,
    palavraPasseHash = 'hash',
    createAluno = false,
    createEncarregado = false
}) => {
    await ensureDatabaseReady();

    const existing = await prisma.utilizador.findUnique({
        where: { Email: email },
        include: {
            Aluno: true,
            Encarregado: true
        }
    });

    if (existing) {
        if (createAluno && !existing.Aluno) {
            await prisma.aluno.create({
                data: {
                    IdUtilizador: existing.IdUtilizador
                }
            });
        }

        if (createEncarregado && !existing.Encarregado) {
            await prisma.encarregado.create({
                data: {
                    IdUtilizador: existing.IdUtilizador
                }
            });
        }

        return await prisma.utilizador.findUnique({
            where: { IdUtilizador: existing.IdUtilizador },
            include: {
                Aluno: true,
                Encarregado: true
            }
        });
    }

    const codigoPostal = await ensurePostalCode();

    return await prisma.utilizador.create({
        data: {
            CodigoPostal: codigoPostal.CodigoPostal,
            Morada: 'Rua de Integracao',
            Permissoes: permissoes,
            NomeCompleto: nomeCompleto,
            NomeUtilizador: nomeUtilizador,
            Email: email,
            PalavraPasseHash: palavraPasseHash,
            EstaAtivo: true,
            Nif: nif,
            ...(createAluno ? {
                Aluno: {
                    create: {}
                }
            } : {}),
            ...(createEncarregado ? {
                Encarregado: {
                    create: {}
                }
            } : {})
        },
        include: {
            Aluno: true,
            Encarregado: true
        }
    });
};

const createToken = (utilizador) => jwt.sign(
    {
        IdUtilizador: utilizador.IdUtilizador,
        Permissoes: utilizador.Permissoes,
        Email: utilizador.Email
    },
    JWT_SECRET,
    { expiresIn: '1h' }
);

const getAdminToken = async () => {
    const admin = await ensureUser({
        email: 'admin@integration.test',
        nomeCompleto: 'Admin Integration Test',
        nomeUtilizador: 'admintestintegration',
        permissoes: 3,
        nif: '999999999'
    });

    return createToken(admin);
};

const getAlunoToken = async () => {
    const aluno = await ensureUser({
        email: 'aluno@integration.test',
        nomeCompleto: 'Aluno Integration Test',
        nomeUtilizador: 'alunotestintegration',
        permissoes: 1,
        nif: '888888888',
        createAluno: true
    });

    return createToken(aluno);
};

const getEncarregadoToken = async () => {
    const encarregado = await ensureUser({
        email: 'encarregado@integration.test',
        nomeCompleto: 'Encarregado Integration Test',
        nomeUtilizador: 'encarregadotestintegration',
        permissoes: 4,
        nif: '777777777',
        createEncarregado: true
    });

    return createToken(encarregado);
};

const getGuardianStudentContext = async () => {
    const encarregado = await ensureUser({
        email: 'encarregado@integration.test',
        nomeCompleto: 'Encarregado Integration Test',
        nomeUtilizador: 'encarregadotestintegration',
        permissoes: 4,
        nif: '777777777',
        createEncarregado: true
    });

    const aluno = await ensureUser({
        email: 'aluno.guardado@integration.test',
        nomeCompleto: 'Aluno Guardado Integration Test',
        nomeUtilizador: 'alunoguardadotestintegration',
        permissoes: 1,
        nif: '666666666',
        createAluno: true
    });

    await prisma.encarregadoAluno.upsert({
        where: {
            IdEncarregado_IdAluno: {
                IdEncarregado: encarregado.IdUtilizador,
                IdAluno: aluno.IdUtilizador
            }
        },
        update: {
            RelacaoParental: 'Pai'
        },
        create: {
            IdEncarregado: encarregado.IdUtilizador,
            IdAluno: aluno.IdUtilizador,
            RelacaoParental: 'Pai'
        }
    });

    return {
        encarregado,
        aluno,
        token: createToken(encarregado)
    };
};

module.exports = {
    BASE_URL,
    JWT_SECRET,
    makeRequest,
    ensureDatabaseReady,
    ensurePostalCode,
    ensureUser,
    getAdminToken,
    getAlunoToken,
    getEncarregadoToken,
    getGuardianStudentContext,
    prisma
};
