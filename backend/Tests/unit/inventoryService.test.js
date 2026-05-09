const inventoryService = require('../../src/services/inventoryService');
const inventoryRepository = require('../../src/repositories/inventoryRepository');
const PERMISSOES = require('../../src/config/permissions');

jest.mock('../../src/repositories/inventoryRepository');

describe('Inventory Service', () => {
    const direcao = { IdUtilizador: 'dir-1', Permissoes: PERMISSOES.DIRECAO };
    const anunciante = { IdUtilizador: 'user-1', Permissoes: PERMISSOES.ENCARREGADO };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('criarArtigo', () => {
        it('deve rejeitar quando o Nome não é fornecido', async () => {
            // Act & Assert
            await expect(inventoryService.criarArtigo({ CustoPorDia: 10 }, anunciante))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'Nome do artigo é obrigatório.' });

            expect(inventoryRepository.create).not.toHaveBeenCalled();
        });

        it('deve rejeitar quando o CustoPorDia é inválido', async () => {
            // Act & Assert
            await expect(inventoryService.criarArtigo({ Nome: 'Violino' }, anunciante))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'Custo por dia deve ser um valor positivo.' });

            expect(inventoryRepository.create).not.toHaveBeenCalled();
        });

        it('deve criar o artigo com o IdUtilizadorCriador do utilizador autenticado', async () => {
            // Arrange
            const dados = { Nome: 'Guitarra', CustoPorDia: 15 };
            inventoryRepository.create.mockResolvedValue({ IdArtigo: 'art-1', ...dados });

            // Act
            const resultado = await inventoryService.criarArtigo(dados, anunciante);

            // Assert
            expect(resultado.IdArtigo).toBe('art-1');
            expect(inventoryRepository.create).toHaveBeenCalledWith({
                ...dados,
                IdUtilizadorCriador: 'user-1'
            });
        });
    });

    describe('editarArtigo', () => {
        it('deve rejeitar quando o ID não é fornecido', async () => {
            // Act & Assert
            await expect(inventoryService.editarArtigo(null, {}, anunciante))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'ID do artigo é obrigatório para edição.' });

            expect(inventoryRepository.update).not.toHaveBeenCalled();
        });

        it('deve bloquear a edição por um utilizador que não é o criador nem Direção', async () => {
            // Arrange
            inventoryRepository.findById.mockResolvedValue({
                IdArtigo: 'art-1',
                IdUtilizadorCriador: 'other-user'
            });

            // Act & Assert
            await expect(inventoryService.editarArtigo('art-1', { Nome: 'Novo nome' }, anunciante))
                .rejects
                .toMatchObject({ statusCode: 403, message: 'Não tens permissão para editar este anúncio.' });

            expect(inventoryRepository.update).not.toHaveBeenCalled();
        });

        it('deve permitir que a Direção edite qualquer artigo', async () => {
            // Arrange
            inventoryRepository.findById.mockResolvedValue({
                IdArtigo: 'art-1',
                IdUtilizadorCriador: 'other-user'
            });
            inventoryRepository.update.mockResolvedValue({ IdArtigo: 'art-1', Nome: 'Novo nome' });

            // Act
            const resultado = await inventoryService.editarArtigo('art-1', { Nome: 'Novo nome' }, direcao);

            // Assert
            expect(resultado.IdArtigo).toBe('art-1');
            expect(inventoryRepository.update).toHaveBeenCalledWith('art-1', { Nome: 'Novo nome' });
        });
    });

    describe('removerArtigo', () => {
        it('deve rejeitar quando o ID não é fornecido', async () => {
            // Act & Assert
            await expect(inventoryService.removerArtigo(undefined, direcao))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'ID do artigo é obrigatório para remoção.' });

            expect(inventoryRepository.delete).not.toHaveBeenCalled();
        });

        it('deve permitir que o criador remova o seu próprio artigo', async () => {
            // Arrange
            inventoryRepository.findById.mockResolvedValue({
                IdArtigo: 'art-1',
                IdUtilizadorCriador: 'user-1'
            });
            inventoryRepository.delete.mockResolvedValue(true);

            // Act
            const resultado = await inventoryService.removerArtigo('art-1', anunciante);

            // Assert
            expect(resultado).toBe(true);
            expect(inventoryRepository.delete).toHaveBeenCalledWith('art-1');
        });

        it('deve bloquear a remoção por um utilizador que não é o criador nem Direção', async () => {
            // Arrange
            inventoryRepository.findById.mockResolvedValue({
                IdArtigo: 'art-1',
                IdUtilizadorCriador: 'outro-user'
            });

            // Act & Assert
            await expect(inventoryService.removerArtigo('art-1', anunciante))
                .rejects
                .toMatchObject({ statusCode: 403 });

            expect(inventoryRepository.delete).not.toHaveBeenCalled();
        });
    });
});
