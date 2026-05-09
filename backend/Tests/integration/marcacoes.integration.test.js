const {
    makeRequest,
    getAdminToken,
    getAlunoToken,
    getGuardianStudentContext,
    ensureDatabaseReady
} = require('./setup');

describe('Integracao - Marcacoes', () => {
    describe('Protecao de rotas (Autenticacao/Autorizacao)', () => {
        it('1 Deve rejeitar GET /marcacoes sem token (401)', async () => {
            const response = await makeRequest('/marcacoes', 'GET');

            expect(response.status).toBe(401);
            expect(response.data.erro).toBeDefined();
        });

        it('2 Deve rejeitar GET /marcacoes com token sem permissao de Direcao (403)', async () => {
            await ensureDatabaseReady();
            const tokenAluno = await getAlunoToken();
            const response = await makeRequest('/marcacoes', 'GET', null, tokenAluno);

            expect(response.status).toBe(403);
        });

        it('3 Deve aceitar GET /marcacoes com token de Direcao (200)', async () => {
            await ensureDatabaseReady();
            const tokenAdmin = await getAdminToken();
            const response = await makeRequest('/marcacoes', 'GET', null, tokenAdmin);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.data)).toBe(true);
        });
    });

    describe('Criar Marcacao (POST /marcacoes/encarregado)', () => {
        it('4 Deve rejeitar criacao de marcacao sem token (401)', async () => {
            const payload = {
                IdAluno: '00000000-0000-0000-0000-000000000001',
                IdAula: '00000000-0000-0000-0000-000000000002'
            };

            const response = await makeRequest('/marcacoes/encarregado', 'POST', payload);

            expect(response.status).toBe(401);
        });

        it('5 Deve rejeitar criacao se a aula nao existir (404)', async () => {
            await ensureDatabaseReady();
            const context = await getGuardianStudentContext();
            const payload = {
                IdAluno: context.aluno.IdUtilizador,
                IdAula: '00000000-0000-0000-0000-000000000999'
            };

            const response = await makeRequest('/marcacoes/encarregado', 'POST', payload, context.token);

            expect(response.status).toBe(404);
            expect(response.data.erro).toMatch(/Aula/i);
        });
    });
});
