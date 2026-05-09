const { makeRequest, getAdminToken } = require('./setup');

describe('Integracao - Inventario', () => {
    let token = null;
    let artigoCriadoId = null;

    beforeAll(async () => {
        token = await getAdminToken();

        // Criar artigo de teste no beforeAll para eliminar dependência entre testes
        const res = await makeRequest('/inventario', 'POST', {
            Nome: `Artigo Teste Integracao ${Date.now()}`,
            CustoPorDia: 12.5,
            QuantidadeTotal: 10,
            Descricao: 'Criado via teste de integracao'
        }, token);

        if (res.status === 201 && res.data && res.data.IdArtigo) {
            artigoCriadoId = res.data.IdArtigo;
        }
    });

    afterAll(async () => {
        // Limpeza: remover artigo criado durante os testes
        if (artigoCriadoId) {
            try {
                await makeRequest(`/inventario/${artigoCriadoId}`, 'DELETE', null, token);
            } catch (e) {
                // Ignora se já foi apagado no teste DELETE
            }
        }
    });

    describe('GET /inventario', () => {
        it('1 Deve retornar a lista de artigos com token de admin (200)', async () => {
            // Act
            const res = await makeRequest('/inventario', 'GET', null, token);

            // Assert
            expect(res.status).toBe(200);
            expect(Array.isArray(res.data)).toBe(true);
        });
    });

    describe('POST /inventario', () => {
        it('2 Deve rejeitar criacao sem Nome (400)', async () => {
            // Act
            const res = await makeRequest('/inventario', 'POST', { CustoPorDia: 5 }, token);

            // Assert
            expect(res.status).toBe(400);
        });
    });

    describe('PUT /inventario/:id', () => {
        it('3 Deve editar o artigo criado com sucesso', async () => {
            // Arrange
            expect(artigoCriadoId).toBeDefined();

            // Act
            const res = await makeRequest(`/inventario/${artigoCriadoId}`, 'PUT', {
                Nome: 'Artigo Teste (Editado)',
                CustoPorDia: 15.0
            }, token);

            // Assert
            expect(res.status).toBe(200);
        });
    });

    describe('DELETE /inventario/:id', () => {
        it('4 Deve apagar o artigo e retornar mensagem de confirmacao', async () => {
            // Arrange
            expect(artigoCriadoId).toBeDefined();

            // Act
            const res = await makeRequest(`/inventario/${artigoCriadoId}`, 'DELETE', null, token);

            // Assert
            expect(res.status).toBe(200);

            // Marcar como limpo para não tentar apagar no afterAll
            artigoCriadoId = null;
        });
    });
});
