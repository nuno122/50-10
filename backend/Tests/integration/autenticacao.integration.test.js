const crypto = require('crypto');
const { makeRequest, ensureDatabaseReady, ensurePostalCode, prisma } = require('./setup');

const hashPassword = (value) => crypto.createHash('sha256').update(value).digest('hex');

describe('Integracao - Autenticacao', () => {
    afterAll(async () => {
        await prisma.$disconnect();
    });

    it('1 Deve rejeitar login sem email e sem password (400)', async () => {
        const response = await makeRequest('/autenticacao/login', 'POST', {});

        expect(response.status).toBe(400);
        expect(response.data.erro).toBeDefined();
    });

    it('2 Deve rejeitar login com email inexistente (401)', async () => {
        const response = await makeRequest('/autenticacao/login', 'POST', {
            Email: 'naoexiste_int_test@entartes.com',
            Password: 'qualquercoisa123'
        });

        expect(response.status).toBe(401);
        expect(response.data.erro).toMatch(/Credenciais/i);
    });

    it('3 Deve rejeitar login com password errada (401)', async () => {
        const codigoPostal = await ensurePostalCode();
        const uniqueSuffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

        const utilizador = await prisma.utilizador.create({
            data: {
                CodigoPostal: codigoPostal.CodigoPostal,
                Morada: 'Morada teste password errada',
                Permissoes: 3,
                NomeCompleto: 'Integracao Password Errada',
                NomeUtilizador: `int_auth_wrong_${uniqueSuffix}`,
                Email: `int-auth-wrong-${uniqueSuffix}@entartes.test`,
                PalavraPasseHash: hashPassword('PasswordCorreta123'),
                EstaAtivo: true,
                Nif: `91${uniqueSuffix}`.slice(0, 9)
            }
        });

        try {
            const response = await makeRequest('/autenticacao/login', 'POST', {
                Email: utilizador.Email,
                Password: 'PasswordErradaQueNaoFuncionaXYZ'
            });

            expect(response.status).toBe(401);
            expect(response.data.erro).toMatch(/Credenciais/i);
        } finally {
            await prisma.utilizador.delete({
                where: { IdUtilizador: utilizador.IdUtilizador }
            });
        }
    });

    it('4 Deve devolver token JWT com login valido para password guardada em hash', async () => {
        const codigoPostal = await ensurePostalCode();
        const uniqueSuffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
        const plainPassword = 'PasswordHashTeste123';

        const utilizador = await prisma.utilizador.create({
            data: {
                CodigoPostal: codigoPostal.CodigoPostal,
                Morada: 'Morada de teste integracao',
                Permissoes: 3,
                NomeCompleto: 'Integracao Autenticacao',
                NomeUtilizador: `int_auth_${uniqueSuffix}`,
                Email: `int-auth-${uniqueSuffix}@entartes.test`,
                PalavraPasseHash: hashPassword(plainPassword),
                EstaAtivo: true,
                Nif: `92${uniqueSuffix}`.slice(0, 9)
            }
        });

        try {
            const response = await makeRequest('/autenticacao/login', 'POST', {
                Email: utilizador.Email,
                Password: plainPassword
            });

            expect(response.status).toBe(200);
            expect(response.data.token).toBeDefined();
            expect(response.data.mensagem).toBe('Login efetuado com sucesso!');
        } finally {
            await prisma.utilizador.delete({
                where: { IdUtilizador: utilizador.IdUtilizador }
            });
        }
    });
});
