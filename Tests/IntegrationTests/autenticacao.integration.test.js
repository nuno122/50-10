const { makeRequest } = require('./setup');

describe('Integração - Autenticação', () => {

    it('1️⃣ Deve rejeitar login sem email e sem password (400)', async () => {
        // Arrange: payload vazio
        const payload = {};

        // Act
        const response = await makeRequest('/autenticacao/login', 'POST', payload);

        // Assert
        expect(response.status).toBe(400);
        expect(response.data.erro).toBeDefined();
    });

    it('2️⃣ Deve rejeitar login com email inexistente (401)', async () => {
        // Arrange: utilizador que não existe na BD
        const payload = {
            Email: 'naoexiste_int_test@entartes.com',
            Password: 'qualquercoisa123'
        };

        // Act
        const response = await makeRequest('/autenticacao/login', 'POST', payload);

        // Assert
        expect(response.status).toBe(401);
        expect(response.data.erro).toBe('Credenciais invalidas.');
    });

    it('3️⃣ Deve rejeitar login com password errada (401)', async () => {
        // Arrange: Tenta encontrar qualquer utilizador válido na BD
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        const utilizador = await prisma.utilizador.findFirst();
        await prisma.$disconnect();

        if (!utilizador) {
            console.warn('Nenhum utilizador encontrado na BD, a ignorar teste.');
            return;
        }

        const payload = {
            Email: utilizador.Email,
            Password: 'PasswordErradaQueNaoFuncionaXYZ'
        };

        // Act
        const response = await makeRequest('/autenticacao/login', 'POST', payload);

        // Assert
        expect(response.status).toBe(401);
        expect(response.data.erro).toBe('Credenciais invalidas.');
    });

    it('4️⃣ Deve devolver token JWT com login válido', async () => {
        // Arrange: Busca um utilizador e usa a sua password real (armazenada em plaintext)
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        const utilizador = await prisma.utilizador.findFirst({
            where: { PalavraPasseHash: { not: undefined } }
        });
        await prisma.$disconnect();

        if (!utilizador) {
            console.warn('Nenhum utilizador com password encontrado, a ignorar teste.');
            return;
        }

        const payload = {
            Email: utilizador.Email,
            Password: utilizador.PalavraPasseHash // plaintext na BD
        };

        // Act
        const response = await makeRequest('/autenticacao/login', 'POST', payload);

        // Assert
        expect(response.status).toBe(200);
        expect(response.data.token).toBeDefined();
        expect(response.data.mensagem).toBe('Login efetuado com sucesso!');
    });
});
