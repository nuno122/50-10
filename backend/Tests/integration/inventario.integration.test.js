const { makeRequest, getAdminToken, ensureDatabaseReady } = require('./setup');

describe('Integracao - Inventario', () => {
    let token = null;
    let artigoCriadoId = null;

    beforeAll(async () => {
        await ensureDatabaseReady();
        token = await getAdminToken();

        const res = await makeRequest('/inventario', 'POST', {
            Nome: `Artigo Teste Integracao ${Date.now()}`,
            CustoPorDia: 12.5
        }, token);

        if (res.status === 201 && res.data?.IdArtigo) {
            artigoCriadoId = res.data.IdArtigo;
        }
    });

    afterAll(async () => {
        if (artigoCriadoId) {
            try {
                await makeRequest(`/inventario/${artigoCriadoId}`, 'DELETE', null, token);
            } catch (error) {
                // O cleanup e best-effort.
            }
        }
    });

    describe('GET /inventario', () => {
        it('1 Deve retornar a lista de artigos com token de admin (200)', async () => {
            const res = await makeRequest('/inventario', 'GET', null, token);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.data)).toBe(true);
        });
    });

    describe('POST /inventario', () => {
        it('2 Deve rejeitar criacao sem Nome (400)', async () => {
            const res = await makeRequest('/inventario', 'POST', { CustoPorDia: 5 }, token);

            expect(res.status).toBe(400);
            expect(res.data.erro).toBeDefined();
        });
    });

    describe('PUT /inventario/:id', () => {
        it('3 Deve editar o artigo criado com sucesso', async () => {
            expect(artigoCriadoId).toBeDefined();

            const res = await makeRequest(`/inventario/${artigoCriadoId}`, 'PUT', {
                Nome: 'Artigo Teste Editado',
                CustoPorDia: 15.0
            }, token);

            expect(res.status).toBe(200);
            expect(res.data.Nome).toBe('Artigo Teste Editado');
        });
    });

    describe('DELETE /inventario/:id', () => {
        it('4 Deve apagar o artigo criado com sucesso', async () => {
            expect(artigoCriadoId).toBeDefined();

            const res = await makeRequest(`/inventario/${artigoCriadoId}`, 'DELETE', null, token);

            expect(res.status).toBe(200);
            expect(res.data.IdArtigo).toBe(artigoCriadoId);

            artigoCriadoId = null;
        });
    });
});
