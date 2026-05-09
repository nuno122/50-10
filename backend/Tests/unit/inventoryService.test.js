const inventoryService = require('../../src/services/inventoryService');
const inventoryRepository = require('../../src/repositories/inventoryRepository');
const PERMISSOES = require('../../src/config/permissions');

jest.mock('../../src/repositories/inventoryRepository');

describe('Inventory Service', () => {
    const direcao = { IdUtilizador: 'dir-1', Permissoes: PERMISSOES.DIRECAO };
    const anunciante = { IdUtilizador: 'user-1', Permissoes: PERMISSOES.ENCARREGADO };
    const stockBase = [{ Tamanho: 'M', Quantidade: 2, Condicao: 'Bom' }];

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('criarArtigo', () => {
        it('deve rejeitar quando o Nome nao e fornecido', async () => {
            await expect(inventoryService.criarArtigo({ CustoPorDia: 10, TamanhoArtigo: stockBase }, anunciante))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'Nome do artigo é obrigatório.' });

            expect(inventoryRepository.create).not.toHaveBeenCalled();
        });

        it('deve rejeitar quando o CustoPorDia e invalido', async () => {
            await expect(inventoryService.criarArtigo({ Nome: 'Violino', TamanhoArtigo: stockBase }, anunciante))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'Custo por dia deve ser um valor positivo.' });

            expect(inventoryRepository.create).not.toHaveBeenCalled();
        });

        it('deve rejeitar quando nao existem tamanhos com quantidade', async () => {
            await expect(inventoryService.criarArtigo({ Nome: 'Violino', CustoPorDia: 10, TamanhoArtigo: [] }, anunciante))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'Indica pelo menos um tamanho com quantidade.' });

            expect(inventoryRepository.create).not.toHaveBeenCalled();
        });

        it('deve criar o artigo com stock e estado de aluguer definidos', async () => {
            const dados = {
                Nome: 'Guitarra',
                CustoPorDia: 15,
                DisponivelParaAluguer: true,
                TamanhoArtigo: stockBase
            };
            inventoryRepository.create.mockResolvedValue({ IdArtigo: 'art-1', ...dados });

            const resultado = await inventoryService.criarArtigo(dados, anunciante);

            expect(resultado.IdArtigo).toBe('art-1');
            expect(inventoryRepository.create).toHaveBeenCalledWith({
                ...dados,
                IdUtilizadorCriador: 'user-1',
                DisponivelParaAluguer: true,
                TamanhoArtigo: stockBase
            });
        });

        it('deve aceitar quantidade sem tamanho e assumir Único', async () => {
            const dados = {
                Nome: 'Capa',
                CustoPorDia: 10,
                TamanhoArtigo: [{ Quantidade: 3, Condicao: 'Bom' }]
            };
            inventoryRepository.create.mockResolvedValue({ IdArtigo: 'art-2', ...dados });

            await inventoryService.criarArtigo(dados, anunciante);

            expect(inventoryRepository.create).toHaveBeenCalledWith({
                ...dados,
                IdUtilizadorCriador: 'user-1',
                DisponivelParaAluguer: false,
                TamanhoArtigo: [{ Tamanho: 'Único', Quantidade: 3, Condicao: 'Bom', IdTamanhoArtigo: undefined }]
            });
        });
    });

    describe('editarArtigo', () => {
        it('deve rejeitar quando o ID nao e fornecido', async () => {
            await expect(inventoryService.editarArtigo(null, {}, anunciante))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'ID do artigo é obrigatório para edição.' });

            expect(inventoryRepository.update).not.toHaveBeenCalled();
        });

        it('deve bloquear a edicao por um utilizador que nao e o criador nem Direcao', async () => {
            inventoryRepository.findById.mockResolvedValue({
                IdArtigo: 'art-1',
                IdUtilizadorCriador: 'other-user',
                DisponivelParaAluguer: false
            });

            await expect(inventoryService.editarArtigo('art-1', { Nome: 'Novo nome' }, anunciante))
                .rejects
                .toMatchObject({ statusCode: 403, message: 'Não tens permissão para editar este anúncio.' });

            expect(inventoryRepository.update).not.toHaveBeenCalled();
        });

        it('deve permitir alterar o estado de aluguer e as quantidades', async () => {
            inventoryRepository.findById.mockResolvedValue({
                IdArtigo: 'art-1',
                IdUtilizadorCriador: 'user-1',
                DisponivelParaAluguer: false
            });
            inventoryRepository.update.mockResolvedValue({ IdArtigo: 'art-1', Nome: 'Novo nome' });

            const payload = {
                Nome: 'Novo nome',
                DisponivelParaAluguer: true,
                TamanhoArtigo: [{ IdTamanhoArtigo: 'size-1', Tamanho: 'L', Quantidade: 4, Condicao: 'Bom' }]
            };

            const resultado = await inventoryService.editarArtigo('art-1', payload, anunciante);

            expect(resultado.IdArtigo).toBe('art-1');
            expect(inventoryRepository.update).toHaveBeenCalledWith('art-1', payload);
        });
    });

    describe('listarArtigos', () => {
        it('deve pedir apenas os artigos do utilizador autenticado quando o filtro mine esta ativo', async () => {
            inventoryRepository.findAll.mockResolvedValue([
                { IdArtigo: 'art-1', EstadoArtigo: true, IdUtilizadorCriador: 'user-1' }
            ]);

            const resultado = await inventoryService.listarArtigos(anunciante, {
                mine: true
            });

            expect(resultado).toHaveLength(1);
            expect(inventoryRepository.findAll).toHaveBeenCalledWith({
                DisponivelParaAluguer: undefined,
                IdUtilizadorCriador: 'user-1'
            });
        });

        it('deve permitir filtrar o catalogo publico de aluguer', async () => {
            inventoryRepository.findAll.mockResolvedValue([
                { IdArtigo: 'art-2', EstadoArtigo: true, IdUtilizadorCriador: 'dir-1', DisponivelParaAluguer: true }
            ]);

            await inventoryService.listarArtigos(direcao, {
                DisponivelParaAluguer: true
            });

            expect(inventoryRepository.findAll).toHaveBeenCalledWith({
                DisponivelParaAluguer: true,
                IdUtilizadorCriador: undefined
            });
        });
    });

    describe('removerArtigo', () => {
        it('deve rejeitar quando o ID nao e fornecido', async () => {
            await expect(inventoryService.removerArtigo(undefined, direcao))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'ID do artigo é obrigatório para remoção.' });

            expect(inventoryRepository.delete).not.toHaveBeenCalled();
        });

        it('deve permitir que o criador remova o seu proprio artigo', async () => {
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
