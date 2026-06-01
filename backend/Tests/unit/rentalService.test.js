const rentalService = require('../../src/services/rentalService');
const rentalRepository = require('../../src/repositories/rentalRepository');
const PERMISSOES = require('../../src/config/permissions');

jest.mock('../../src/repositories/rentalRepository');

describe('Rental Service', () => {
    const direcaoUser = { IdUtilizador: 'dir-1', Permissoes: PERMISSOES.DIRECAO };
    const regularUser = { IdUtilizador: 'user-1', Permissoes: PERMISSOES.ENCARREGADO };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Criar Aluguer', () => {
        it('deve emitir erro 400 quando a data de entrega é anterior à data de levantamento', async () => {
            // Arrange
            const dadosAluguerInvalido = {
                IdUtilizador: 1,
                DataLevantamento: '2026-05-10',
                DataEntrega: '2026-05-09', // Data trocada
                ListaArtigos: [{ IdTamanhoArtigo: 101, Quantidade: 1 }]
            };

            // Act & Assert
            await expect(rentalService.criarAluguer(dadosAluguerInvalido, direcaoUser))
                .rejects
                .toThrow('A DataEntrega nao pode ser anterior a DataLevantamento.');

            expect(rentalRepository.criarComTransacao).not.toHaveBeenCalled();
        });

        it('deve emitir erro 400 quando a quantidade pretendida excede o inventário disponível', async () => {
            // Arrange
            const dadosAluguerSemStock = {
                IdUtilizador: 1,
                DataLevantamento: '2026-05-10',
                DataEntrega: '2026-05-12',
                ListaArtigos: [{ IdTamanhoArtigo: 101, Quantidade: 5 }]
            };

            // O repositório só consegue procurar 2 unidades ativas no stock para este artigo
            rentalRepository.buscarStockArtigo.mockResolvedValue({
                IdTamanhoArtigo: 101,
                Quantidade: 2,
                Artigo: { DisponivelParaAluguer: true }
            });

            // Act & Assert
            await expect(rentalService.criarAluguer(dadosAluguerSemStock, direcaoUser))
                .rejects
                .toThrow('Stock insuficiente para o artigo 101.');

            expect(rentalRepository.criarComTransacao).not.toHaveBeenCalled();
        });

        it('deve criar o aluguer com sucesso quando os dados são válidos', async () => {
            // Arrange
            const dadosAluguerValidos = {
                IdUtilizador: 1,
                DataLevantamento: '2026-05-10',
                DataEntrega: '2026-05-12',
                ListaArtigos: [{ IdTamanhoArtigo: 101, Quantidade: 1 }]
            };

            rentalRepository.buscarStockArtigo.mockResolvedValue({
                IdTamanhoArtigo: 101,
                Quantidade: 10,
                Artigo: { DisponivelParaAluguer: true }
            });
            rentalRepository.criarComTransacao.mockResolvedValue({
                IdAluguer: 'aluguer-1',
                EstadoAluguer: 'Pendente'
            });

            // Act
            const resultado = await rentalService.criarAluguer(dadosAluguerValidos, direcaoUser);

            // Assert
            expect(resultado).toBeDefined();
            expect(rentalRepository.criarComTransacao).toHaveBeenCalledTimes(1);
        });

        it('não deve finalizar o aluguer se a transação na base de dados falhar (Ex: Prisma Deadlock)', async () => {
            // Arrange
            const dadosAluguerValidos = {
                IdUtilizador: 1, DataLevantamento: '2026-05-10', DataEntrega: '2026-05-12',
                ListaArtigos: [{ IdTamanhoArtigo: 101, Quantidade: 1 }]
            };

            rentalRepository.buscarStockArtigo.mockResolvedValue({
                IdTamanhoArtigo: 101,
                Quantidade: 10,
                Artigo: { DisponivelParaAluguer: true }
            });

            // Injeção do Problema Crítico no Prisma
            rentalRepository.criarComTransacao.mockRejectedValue(new Error('Prisma: Transaction Deadlock'));

            // Act & Assert
            await expect(rentalService.criarAluguer(dadosAluguerValidos, direcaoUser))
                .rejects
                .toThrow('Prisma: Transaction Deadlock');
        });

        it('deve rejeitar artigos que nao pertencam ao catalogo de aluguer', async () => {
            const dadosAluguerInvalidos = {
                IdUtilizador: 1,
                DataLevantamento: '2026-05-10',
                DataEntrega: '2026-05-12',
                ListaArtigos: [{ IdTamanhoArtigo: 101, Quantidade: 1 }]
            };

            rentalRepository.buscarStockArtigo.mockResolvedValue({
                IdTamanhoArtigo: 101,
                Quantidade: 10,
                Artigo: { DisponivelParaAluguer: false }
            });

            await expect(rentalService.criarAluguer(dadosAluguerInvalidos, direcaoUser))
                .rejects
                .toThrow('Artigo indisponivel para aluguer: 101.');

            expect(rentalRepository.criarComTransacao).not.toHaveBeenCalled();
        });
    });

    describe('Listar Alugueres', () => {
        it('deve devolver apenas os alugueres do utilizador quando nao for Direcao', async () => {
            rentalRepository.buscarTodos.mockResolvedValue([{ IdAluguer: 'rent-1' }]);

            const resultado = await rentalService.listarAlugueres({
                IdUtilizador: 'user-1',
                Permissoes: PERMISSOES.ENCARREGADO
            });

            expect(resultado).toEqual([{ IdAluguer: 'rent-1' }]);
            expect(rentalRepository.buscarTodos).toHaveBeenCalledWith({
                IdUtilizador: 'user-1'
            });
        });

        it('deve devolver todos os alugueres para a Direcao', async () => {
            rentalRepository.buscarTodos.mockResolvedValue([{ IdAluguer: 'rent-1' }, { IdAluguer: 'rent-2' }]);

            const resultado = await rentalService.listarAlugueres({
                IdUtilizador: 'dir-1',
                Permissoes: PERMISSOES.DIRECAO
            });

            expect(resultado).toHaveLength(2);
            expect(rentalRepository.buscarTodos).toHaveBeenCalledWith({
                IdUtilizador: undefined
            });
        });
    });

    describe('Avaliar Pedido de Extensão', () => {
        it('deve aprovar pedido, registar o ValorAdicional e atualizar a data do aluguer na BD', async () => {
            // Arrange
            const idPedido = 5;
            rentalRepository.getPedidoExtensaoById.mockResolvedValueOnce({
                IdPedido: 5,
                IdAluguer: 22,
                NovaDataProposta: '2026-05-20',
                EstadoAprovacao: 'Pendente'
            });

            // Na segunda invocação (no fim do serviço), devolvemos atualizado
            rentalRepository.getPedidoExtensaoById.mockResolvedValueOnce({
                IdPedido: 5,
                EstadoAprovacao: 'Aprovado'
            });

            rentalRepository.atualizarPedidoValorAdicional.mockResolvedValue();
            rentalRepository.atualizarEstadoPedido.mockResolvedValue();
            rentalRepository.atualizarAluguer.mockResolvedValue({ IdAluguer: 22, Atualizado: true });

            // Act
            const resultado = await rentalService.avaliarPedidoExtensao({
                IdPedido: idPedido,
                Aprovado: true,
                ValorAdicional: 10.50
            }, direcaoUser);

            // Assert
            expect(resultado.mensagem).toBe('Extensao aprovada e aluguer atualizado!');
            expect(rentalRepository.atualizarPedidoValorAdicional).toHaveBeenCalledWith(5, 10.50);
            expect(rentalRepository.atualizarEstadoPedido).toHaveBeenCalledWith(5, 'Aprovado');
            expect(rentalRepository.atualizarAluguer).toHaveBeenCalledWith(22, '2026-05-20');
        });
    });

    describe('Registar Devolucao', () => {
        it('deve permitir que o utilizador registe a devolucao do proprio aluguer sem multa', async () => {
            rentalRepository.getAluguerById.mockResolvedValue({
                IdAluguer: 'rent-1',
                IdUtilizador: 'user-1',
                EstadoAluguer: 'Ativo'
            });
            rentalRepository.registarDevolucao.mockResolvedValue({
                IdAluguer: 'rent-1',
                EstadoAluguer: 'Entregue'
            });

            const resultado = await rentalService.registarDevolucao({
                IdAluguer: 'rent-1',
                EstadoEntrega: 'Em boas condicoes',
                Multa: 0
            }, regularUser);

            expect(resultado.aluguer.EstadoAluguer).toBe('Entregue');
            expect(rentalRepository.registarDevolucao).toHaveBeenCalledWith('rent-1', 'Em boas condicoes', 0);
        });

        it('deve impedir que um utilizador registe devolucao de outro utilizador', async () => {
            rentalRepository.getAluguerById.mockResolvedValue({
                IdAluguer: 'rent-2',
                IdUtilizador: 'other-user',
                EstadoAluguer: 'Ativo'
            });

            await expect(rentalService.registarDevolucao({
                IdAluguer: 'rent-2',
                EstadoEntrega: 'Em boas condicoes',
                Multa: 0
            }, regularUser)).rejects.toThrow('Nao tem permissao para alterar este aluguer.');

            expect(rentalRepository.registarDevolucao).not.toHaveBeenCalled();
        });

        it('deve impedir multa registada por utilizador sem permissao de Direcao', async () => {
            rentalRepository.getAluguerById.mockResolvedValue({
                IdAluguer: 'rent-1',
                IdUtilizador: 'user-1',
                EstadoAluguer: 'Ativo'
            });

            await expect(rentalService.registarDevolucao({
                IdAluguer: 'rent-1',
                EstadoEntrega: 'Danificado',
                Multa: 5
            }, regularUser)).rejects.toThrow('Apenas a Direcao pode aplicar multa na devolucao.');
        });
    });
});
