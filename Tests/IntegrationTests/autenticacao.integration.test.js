const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { makeRequest } = require('./setup');

const prisma = new PrismaClient();

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
        expect(response.data.erro).toBe('Credenciais invalidas.');
    });

    it('3 Deve rejeitar login com password errada (401)', async () => {
        const utilizador = await prisma.utilizador.findFirst();

        if (!utilizador) {
            console.warn('Nenhum utilizador encontrado na BD, a ignorar teste.');
            return;
        }

        const response = await makeRequest('/autenticacao/login', 'POST', {
            Email: utilizador.Email,
            Password: 'PasswordErradaQueNaoFuncionaXYZ'
        });

        expect(response.status).toBe(401);
        expect(response.data.erro).toBe('Credenciais invalidas.');
    });

    it('4 Deve devolver token JWT com login valido para password guardada em hash', async () => {
        const codigoPostal = await prisma.codigoPostal.findFirst();

        if (!codigoPostal) {
            console.warn('Nenhum codigo postal encontrado na BD, a ignorar teste.');
            return;
        }

        const uniqueSuffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
        const plainPassword = 'PasswordHashTeste123';
        const email = `int-auth-${uniqueSuffix}@entartes.test`;
        const username = `int_auth_${uniqueSuffix}`;

        const utilizador = await prisma.utilizador.create({
            data: {
                CodigoPostal: codigoPostal.CodigoPostal,
                Morada: 'Morada de teste integracao',
                Permissoes: 3,
                NomeCompleto: 'Integracao Autenticacao',
                NomeUtilizador: username,
                Email: email,
                PalavraPasseHash: hashPassword(plainPassword),
                EstaAtivo: true
            }
        });

        try {
            const response = await makeRequest('/autenticacao/login', 'POST', {
                Email: email,
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
