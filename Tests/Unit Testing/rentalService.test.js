const rentalService = require('../../backend/src/services/rentalService');
const rentalRepository = require('../../backend/src/repositories/rentalRepository');
const PERMISSOES = require('../../backend/src/config/permissions');

jest.mock('../../backend/src/repositories/rentalRepository');

describe('Rental Service', () => {
    const anunciante = { IdUtilizador: 'user-1', Permissoes: PERMISSOES.ENCARREGADO };
    const outroUtilizador = { IdUtilizador: 'user-2', Permissoes: PERMISSOES.ENCARREGADO };
    const direcao = { IdUtilizador: 'dir-1', Permissoes: PERMISSOES.DIRECAO };

    beforeEach(() => {
        // Arrange (Comum)
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
            await expect(rentalService.criarAluguer(dadosAluguerInvalido))
                .rejects
                .toThrow('A DataEntrega nao pode ser anterior a DataLevantamento.');
        });

        it('deve emitir erro 400 quando a quantidade pretendida excede o inventário bloqueado/disponível', async () => {
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
                Quantidade: 2
            });

            // Act & Assert
            await expect(rentalService.criarAluguer(dadosAluguerSemStock))
                .rejects
                .toThrow('Stock insuficiente para o artigo 101.');
        });

        it('não deve finalizar o aluguer se a transação commit na base de dados explodir (Ex: Prisma Deadlock)', async () => {
            // Arrange
            const dadosAluguerValidos = {
                IdUtilizador: 1, DataLevantamento: '2026-05-10', DataEntrega: '2026-05-12',
                ListaArtigos: [{ IdTamanhoArtigo: 101, Quantidade: 1 }]
            };

            rentalRepository.buscarStockArtigo.mockResolvedValue({ IdTamanhoArtigo: 101, Quantidade: 10 });

            // Injeção do Problema Crítico no Prisma
            rentalRepository.criarComTransacao.mockRejectedValue(new Error('Prisma: Transaction Deadlock'));

            // Act & Assert
            await expect(rentalService.criarAluguer(dadosAluguerValidos))
                .rejects
                .toThrow('Prisma: Transaction Deadlock');
        });

        it('deve bloquear artigo inativo quando o utilizador nao e proprietario', async () => {
            const dadosAluguer = {
                IdUtilizador: 'user-2',
                DataLevantamento: '2026-05-10',
                DataEntrega: '2026-05-12',
                ListaArtigos: [{ IdTamanhoArtigo: 'size-1', Quantidade: 1 }]
            };

            rentalRepository.buscarStockArtigo.mockResolvedValue({
                IdTamanhoArtigo: 'size-1',
                Quantidade: 1,
                Artigo: {
                    EstadoArtigo: false,
                    IdUtilizadorCriador: 'user-1'
                }
            });

            await expect(rentalService.criarAluguer(dadosAluguer, outroUtilizador))
                .rejects
                .toMatchObject({ statusCode: 403, message: 'Artigo indisponivel para aluguer: size-1.' });
        });

        it('deve permitir artigo inativo ao proprietario', async () => {
            const dadosAluguer = {
                IdUtilizador: 'user-1',
                DataLevantamento: '2026-05-10',
                DataEntrega: '2026-05-12',
                ListaArtigos: [{ IdTamanhoArtigo: 'size-1', Quantidade: 1 }]
            };

            rentalRepository.buscarStockArtigo.mockResolvedValue({
                IdTamanhoArtigo: 'size-1',
                Quantidade: 1,
                Artigo: {
                    EstadoArtigo: false,
                    IdUtilizadorCriador: 'user-1'
                }
            });
            rentalRepository.criarComTransacao.mockResolvedValue({ IdAluguer: 'rent-1' });

            const resultado = await rentalService.criarAluguer(dadosAluguer, anunciante);

            expect(resultado.aluguer).toEqual({ IdAluguer: 'rent-1' });
        });

        it('deve bloquear artigo inativo para direcao quando nao e proprietaria', async () => {
            const dadosAluguer = {
                IdUtilizador: 'dir-1',
                DataLevantamento: '2026-05-10',
                DataEntrega: '2026-05-12',
                ListaArtigos: [{ IdTamanhoArtigo: 'size-1', Quantidade: 1 }]
            };

            rentalRepository.buscarStockArtigo.mockResolvedValue({
                IdTamanhoArtigo: 'size-1',
                Quantidade: 1,
                Artigo: {
                    EstadoArtigo: false,
                    IdUtilizadorCriador: 'user-1'
                }
            });

            await expect(rentalService.criarAluguer(dadosAluguer, direcao))
                .rejects
                .toMatchObject({ statusCode: 403, message: 'Artigo indisponivel para aluguer: size-1.' });
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
            });

            // Assert
            expect(resultado.mensagem).toBe('Extensao aprovada e aluguer atualizado!');
            expect(rentalRepository.atualizarPedidoValorAdicional).toHaveBeenCalledWith(5, 10.50);
            expect(rentalRepository.atualizarEstadoPedido).toHaveBeenCalledWith(5, 'Aprovado');
            expect(rentalRepository.atualizarAluguer).toHaveBeenCalledWith(22, '2026-05-20');
        });
    });
});
