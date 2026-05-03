const { makeRequest, getAdminToken } = require('./setup');

describe('Integração - Alugueres', () => {

    describe('Proteção de rotas', () => {

        it('1️⃣ Deve rejeitar GET /alugueres sem token (401)', async () => {
            // Arrange: sem token
            // Act
            const response = await makeRequest('/alugueres', 'GET');

            // Assert
            expect(response.status).toBe(401);
            expect(response.data.erro).toBeDefined();
        });

        it('2️⃣ Deve aceitar GET /alugueres com token válido (200)', async () => {
            // Arrange
            const token = getAdminToken();

            // Act
            const response = await makeRequest('/alugueres', 'GET', null, token);

            // Assert
            expect(response.status).toBe(200);
            expect(Array.isArray(response.data)).toBe(true);
        });

    });

    describe('Criar Aluguer (POST /alugueres)', () => {

        it('3️⃣ Deve rejeitar sem token (401)', async () => {
            // Arrange
            const payload = { IdUtilizador: 1, DataLevantamento: '2030-01-10', DataEntrega: '2030-01-12', ListaArtigos: [] };

            // Act
            const response = await makeRequest('/alugueres', 'POST', payload);

            // Assert
            expect(response.status).toBe(401);
        });

        it('4️⃣ Deve rejeitar quando DataEntrega é anterior à DataLevantamento (400)', async () => {
            // Arrange: datas trocadas
            const token = getAdminToken();
            const payload = {
                IdUtilizador: 1,
                DataLevantamento: '2030-01-15',
                DataEntrega: '2030-01-10',  // antes da data de levantamento
                ListaArtigos: [{ IdTamanhoArtigo: 999, Quantidade: 1 }]
            };

            // Act
            const response = await makeRequest('/alugueres', 'POST', payload, token);

            // Assert
            expect(response.status).toBe(400);
            expect(response.data.erro).toBe('A DataEntrega nao pode ser anterior a DataLevantamento.');
        });

        it('5️⃣ Deve rejeitar quando não há artigos na lista (400)', async () => {
            // Arrange: lista vazia
            const token = getAdminToken();
            const payload = {
                IdUtilizador: 1,
                DataLevantamento: '2030-01-10',
                DataEntrega: '2030-01-15',
                ListaArtigos: []
            };

            // Act
            const response = await makeRequest('/alugueres', 'POST', payload, token);

            // Assert
            expect(response.status).toBe(400);
            expect(response.data.erro).toBeDefined();
        });

        it('6️⃣ Deve rejeitar quando stock é insuficiente (400)', async () => {
            // Arrange: ArticleId válido mas quantidade absurda
            const { PrismaClient } = require('@prisma/client');
            const prisma = new PrismaClient();
            let artigo = await prisma.tamanhoArtigo.findFirst();
            await prisma.$disconnect();

            if (!artigo) {
                // Criar Artigo temporário para teste
                const baseArtigo = await prisma.artigo.create({
                    data: { Nome: `Artigo Integ ${Date.now()}`, CustoPorDia: 5 }
                });
                artigo = await prisma.tamanhoArtigo.create({
                    data: { IdArtigo: baseArtigo.IdArtigo, Tamanho: 'M', Quantidade: 10 }
                });
            }

            const token = getAdminToken();
            const payload = {
                IdUtilizador: 1,
                DataLevantamento: '2030-01-10',
                DataEntrega: '2030-01-15',
                ListaArtigos: [{ IdTamanhoArtigo: artigo.IdTamanhoArtigo, Quantidade: 999999 }]
            };

            // Act
            const response = await makeRequest('/alugueres', 'POST', payload, token);

            // Assert
            expect(response.status).toBe(400);
            expect(response.data.erro).toMatch(/Stock insuficiente/);
        });

    });

});
