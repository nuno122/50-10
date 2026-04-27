const { makeRequest, getAdminToken } = require('./setup');
const jwt = require('jsonwebtoken');

// Gera um token de Aluno (Permissoes: 1) para testes que requerem autenticação de aluno
const getAlunoToken = (idUtilizador = 8888) => {
    return jwt.sign(
        { IdUtilizador: idUtilizador, Permissoes: 1, Email: 'aluno@integration.test' },
        'ChaveSuperSecretaDaEntArtes_2026',
        { expiresIn: '1h' }
    );
};

describe('Integração - Marcações', () => {

    describe('Proteção de rotas (Autenticação/Autorização)', () => {

        it('1️⃣ Deve rejeitar GET /marcacoes sem token (401)', async () => {
            // Arrange: sem token
            // Act
            const response = await makeRequest('/marcacoes', 'GET');

            // Assert
            expect(response.status).toBe(401);
            expect(response.data.erro).toBeDefined();
        });

        it('2️⃣ Deve rejeitar GET /marcacoes com token de Aluno (403 - sem permissão de Direção)', async () => {
            // Arrange: token de aluno, mas a rota exige Direção
            const tokenAluno = getAlunoToken();

            // Act
            const response = await makeRequest('/marcacoes', 'GET', null, tokenAluno);

            // Assert
            expect(response.status).toBe(403);
        });

        it('3️⃣ Deve aceitar GET /marcacoes com token de Direção (200)', async () => {
            // Arrange: token de Direção (Permissoes: 3)
            const tokenAdmin = getAdminToken();

            // Act
            const response = await makeRequest('/marcacoes', 'GET', null, tokenAdmin);

            // Assert
            expect(response.status).toBe(200);
            expect(Array.isArray(response.data)).toBe(true);
        });

    });

    describe('Criar Marcação (POST /marcacoes)', () => {

        it('4️⃣ Deve rejeitar criação de marcação sem token (401)', async () => {
            // Arrange: payload válido mas sem autenticação
            const payload = { IdAluno: 1, IdAula: 1 };

            // Act
            const response = await makeRequest('/marcacoes', 'POST', payload);

            // Assert
            expect(response.status).toBe(401);
        });

        it('5️⃣ Deve rejeitar criação se aula não existir (400 ou 404)', async () => {
            // Arrange: IdAula inexistente na BD
            const tokenAluno = getAlunoToken(1);
            const payload = {
                IdAluno: 1,
                IdAula: 'aula-que-nao-existe-00000000'
            };

            // Act
            const response = await makeRequest('/marcacoes', 'POST', payload, tokenAluno);

            // Assert: deve retornar erro de negócio (não 2xx)
            expect(response.status).toBeGreaterThanOrEqual(400);
        });

    });

});
