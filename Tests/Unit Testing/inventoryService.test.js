const inventoryService = require('../../backend/src/services/inventoryService');
const inventoryRepository = require('../../backend/src/repositories/inventoryRepository');
const PERMISSOES = require('../../backend/src/config/permissions');

jest.mock('../../backend/src/repositories/inventoryRepository');

describe('Inventory Service', () => {
    const direcao = { IdUtilizador: 'dir-1', Permissoes: PERMISSOES.DIRECAO };
    const anunciante = { IdUtilizador: 'user-1', Permissoes: PERMISSOES.ENCARREGADO };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('criarArtigo', () => {
        it('rejects when Nome is missing', async () => {
            await expect(inventoryService.criarArtigo({ CustoPorDia: 10 }, anunciante))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'Nome do artigo e obrigatorio.' });
        });

        it('rejects when CustoPorDia is invalid', async () => {
            await expect(inventoryService.criarArtigo({ Nome: 'Violino' }, anunciante))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'Custo por dia deve ser um valor positivo.' });
        });

        it('creates article with creator id from the authenticated user', async () => {
            const dados = { Nome: 'Guitarra', CustoPorDia: 15 };
            inventoryRepository.create.mockResolvedValue({ IdArtigo: 'art-1', ...dados });

            const resultado = await inventoryService.criarArtigo(dados, anunciante);

            expect(resultado.IdArtigo).toBe('art-1');
            expect(inventoryRepository.create).toHaveBeenCalledWith({
                ...dados,
                IdUtilizadorCriador: 'user-1'
            });
        });
    });

    describe('editarArtigo', () => {
        it('rejects when id is missing', async () => {
            await expect(inventoryService.editarArtigo(null, {}, anunciante))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'ID do artigo e obrigatorio para edicao.' });
        });

        it('blocks editing by a different non-direction user', async () => {
            inventoryRepository.findById.mockResolvedValue({
                IdArtigo: 'art-1',
                IdUtilizadorCriador: 'other-user'
            });

            await expect(inventoryService.editarArtigo('art-1', { Nome: 'Novo nome' }, anunciante))
                .rejects
                .toMatchObject({ statusCode: 403, message: 'Nao tens permissao para editar este anuncio.' });
        });

        it('allows Direcao to edit any article', async () => {
            inventoryRepository.findById.mockResolvedValue({
                IdArtigo: 'art-1',
                IdUtilizadorCriador: 'other-user'
            });
            inventoryRepository.update.mockResolvedValue({ IdArtigo: 'art-1', Nome: 'Novo nome' });

            const resultado = await inventoryService.editarArtigo('art-1', { Nome: 'Novo nome' }, direcao);

            expect(resultado.IdArtigo).toBe('art-1');
            expect(inventoryRepository.update).toHaveBeenCalledWith('art-1', { Nome: 'Novo nome' });
        });
    });

    describe('removerArtigo', () => {
        it('rejects when id is missing', async () => {
            await expect(inventoryService.removerArtigo(undefined, direcao))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'ID do artigo e obrigatorio para remocao.' });
        });

        it('allows creator to remove own article', async () => {
            inventoryRepository.findById.mockResolvedValue({
                IdArtigo: 'art-1',
                IdUtilizadorCriador: 'user-1'
            });
            inventoryRepository.delete.mockResolvedValue(true);

            const resultado = await inventoryService.removerArtigo('art-1', anunciante);

            expect(resultado).toBe(true);
            expect(inventoryRepository.delete).toHaveBeenCalledWith('art-1');
        });
    });
});
