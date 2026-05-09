const {
    makeRequest,
    getAdminToken,
    ensureDatabaseReady,
    ensureUser,
    prisma
} = require('./setup');

describe('Integracao - Alugueres', () => {
    let adminToken;
    let utilizadorAluguer;
    let createdArticleId = null;
    let createdSizeId = null;

    beforeAll(async () => {
        try {
            await ensureDatabaseReady();
            adminToken = await getAdminToken();
            utilizadorAluguer = await ensureUser({
                email: 'cliente.aluguer@integration.test',
                nomeCompleto: 'Cliente Aluguer Integration Test',
                nomeUtilizador: 'clientealuguerintegration',
                permissoes: 1,
                nif: '555555555',
                createAluno: true
            });
        } catch (error) {
            adminToken = null;
            utilizadorAluguer = null;
        }
    });

    afterAll(async () => {
        if (createdSizeId) {
            await prisma.artigoAluguer.deleteMany({
                where: { IdTamanhoArtigo: createdSizeId }
            });

            await prisma.tamanhoArtigo.deleteMany({
                where: { IdTamanhoArtigo: createdSizeId }
            });
        }

        if (createdArticleId) {
            await prisma.artigo.deleteMany({
                where: { IdArtigo: createdArticleId }
            });
        }
    });

    describe('Protecao de rotas', () => {
        it('1 Deve rejeitar GET /alugueres sem token (401)', async () => {
            const response = await makeRequest('/alugueres', 'GET');

            expect(response.status).toBe(401);
            expect(response.data.erro).toBeDefined();
        });

        it('2 Deve aceitar GET /alugueres com token valido (200)', async () => {
            await ensureDatabaseReady();
            adminToken = adminToken || await getAdminToken();
            const response = await makeRequest('/alugueres', 'GET', null, adminToken);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.data)).toBe(true);
        });
    });

    describe('Criar Aluguer (POST /alugueres)', () => {
        it('3 Deve rejeitar sem token (401)', async () => {
            const payload = {
                IdUtilizador: '00000000-0000-0000-0000-000000000010',
                DataLevantamento: '2030-01-10',
                DataEntrega: '2030-01-12',
                ListaArtigos: []
            };

            const response = await makeRequest('/alugueres', 'POST', payload);

            expect(response.status).toBe(401);
        });

        it('4 Deve rejeitar quando DataEntrega e anterior a DataLevantamento (400)', async () => {
            await ensureDatabaseReady();
            adminToken = adminToken || await getAdminToken();
            utilizadorAluguer = utilizadorAluguer || await ensureUser({
                email: 'cliente.aluguer@integration.test',
                nomeCompleto: 'Cliente Aluguer Integration Test',
                nomeUtilizador: 'clientealuguerintegration',
                permissoes: 1,
                nif: '555555555',
                createAluno: true
            });
            const payload = {
                IdUtilizador: utilizadorAluguer.IdUtilizador,
                DataLevantamento: '2030-01-15',
                DataEntrega: '2030-01-10',
                ListaArtigos: [{
                    IdTamanhoArtigo: '00000000-0000-0000-0000-000000000111',
                    Quantidade: 1
                }]
            };

            const response = await makeRequest('/alugueres', 'POST', payload, adminToken);

            expect(response.status).toBe(400);
            expect(response.data.erro).toBe('A DataEntrega nao pode ser anterior a DataLevantamento.');
        });

        it('5 Deve rejeitar quando nao ha artigos na lista (400)', async () => {
            await ensureDatabaseReady();
            adminToken = adminToken || await getAdminToken();
            utilizadorAluguer = utilizadorAluguer || await ensureUser({
                email: 'cliente.aluguer@integration.test',
                nomeCompleto: 'Cliente Aluguer Integration Test',
                nomeUtilizador: 'clientealuguerintegration',
                permissoes: 1,
                nif: '555555555',
                createAluno: true
            });
            const payload = {
                IdUtilizador: utilizadorAluguer.IdUtilizador,
                DataLevantamento: '2030-01-10',
                DataEntrega: '2030-01-15',
                ListaArtigos: []
            };

            const response = await makeRequest('/alugueres', 'POST', payload, adminToken);

            expect(response.status).toBe(400);
            expect(response.data.erro).toMatch(/ListaArtigos/i);
        });

        it('6 Deve rejeitar quando stock e insuficiente (400)', async () => {
            await ensureDatabaseReady();
            adminToken = adminToken || await getAdminToken();
            utilizadorAluguer = utilizadorAluguer || await ensureUser({
                email: 'cliente.aluguer@integration.test',
                nomeCompleto: 'Cliente Aluguer Integration Test',
                nomeUtilizador: 'clientealuguerintegration',
                permissoes: 1,
                nif: '555555555',
                createAluno: true
            });
            let artigo = await prisma.tamanhoArtigo.findFirst({
                include: { Artigo: true }
            });

            if (!artigo) {
                const baseArtigo = await prisma.artigo.create({
                    data: {
                        Nome: `Artigo Integ ${Date.now()}`,
                        CustoPorDia: 5,
                        DisponivelParaAluguer: true,
                        IdUtilizadorCriador: utilizadorAluguer.IdUtilizador
                    }
                });

                const tamanho = await prisma.tamanhoArtigo.create({
                    data: {
                        IdArtigo: baseArtigo.IdArtigo,
                        Tamanho: 'M',
                        Quantidade: 10
                    }
                });

                createdArticleId = baseArtigo.IdArtigo;
                createdSizeId = tamanho.IdTamanhoArtigo;
                artigo = {
                    ...tamanho,
                    Artigo: baseArtigo
                };
            }

            const payload = {
                IdUtilizador: utilizadorAluguer.IdUtilizador,
                DataLevantamento: '2030-01-10',
                DataEntrega: '2030-01-15',
                ListaArtigos: [{
                    IdTamanhoArtigo: artigo.IdTamanhoArtigo,
                    Quantidade: 999999
                }]
            };

            const response = await makeRequest('/alugueres', 'POST', payload, adminToken);

            expect(response.status).toBe(400);
            expect(response.data.erro).toMatch(/Stock insuficiente/i);
        });
    });
});
