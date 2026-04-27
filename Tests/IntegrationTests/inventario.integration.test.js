const { makeRequest, getAdminToken } = require('./setup');

describe('Integracao - Inventario', () => {
    let token = null;
    let artigoCriadoId = null;

    beforeAll(async () => {
        token = getAdminToken();
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
        });

        it('3 Deve criar um novo artigo com sucesso (201)', async () => {
            const res = await makeRequest('/inventario', 'POST', {
                Nome: 'Artigo Teste Integracao',
                CustoPorDia: 12.5,
                QuantidadeTotal: 10,
                Descricao: 'Criado via teste de integracao'
            }, token);

            expect(res.status).toBe(201);
            if (res.data && res.data.IdArtigo) {
                artigoCriadoId = res.data.IdArtigo;
            }
        });
    });

    describe('PUT /inventario/:id', () => {
        it('4 Deve editar o artigo criado com sucesso', async () => {
            if (!artigoCriadoId) {
                console.warn('Artigo nao foi criado, a ignorar teste de edicao.');
                return;
            }

            const res = await makeRequest(`/inventario/${artigoCriadoId}`, 'PUT', {
                Nome: 'Artigo Teste (Editado)',
                CustoPorDia: 15.0
            }, token);

            expect(res.status).toBe(200);
        });
    });

    describe('DELETE /inventario/:id', () => {
        it('5 Deve apagar o artigo e retornar mensagem de confirmacao', async () => {
            if (!artigoCriadoId) {
                console.warn('Artigo nao foi criado, a ignorar teste de eliminacao.');
                return;
            }

            const res = await makeRequest(`/inventario/${artigoCriadoId}`, 'DELETE', null, token);
            expect(res.status).toBe(200);
        });
    });
});
