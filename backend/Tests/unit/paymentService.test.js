const paymentService = require('../../src/services/paymentService');
const paymentRepository = require('../../src/repositories/paymentRepository');

jest.mock('../../src/repositories/paymentRepository');

describe('Payment Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GerarPagamentoIndividual', () => {
        it('deve calcular a data limite como 5 dias após a criação', async () => {
            // Arrange
            const mockPagamento = { IdPagamento: 1, Valor: 50 };
            paymentRepository.create.mockResolvedValue(mockPagamento);

            // Act
            await paymentService.GerarPagamentoIndividual(1, 50, 'Mensalidade');

            // Assert
            const callData = paymentRepository.create.mock.calls[0][0];
            const hoje = new Date();
            const dataEsperada = new Date();
            dataEsperada.setDate(hoje.getDate() + 5);

            expect(callData.DataLimite.toDateString()).toBe(dataEsperada.toDateString());
            expect(callData.Valor).toBe(50);
            expect(callData.IdAluno).toBe(1);
        });
    });

    describe('GerarPagamento', () => {
        it('deve ignorar marcações que já tenham pagamento ativo', async () => {
            // Arrange
            paymentRepository.create.mockResolvedValue({ IdPagamento: 2, Valor: 30 });

            // Act
            const resultado = await paymentService.GerarPagamento([
                {
                    IdMarcacao: 10,
                    Pagamento: [{ IdPagamento: 91, EstadoPagamento: 'Pendente' }]
                },
                {
                    IdMarcacao: 11,
                    Pagamento: [{ IdPagamento: 92, EstadoPagamento: 'Cancelado' }]
                }
            ], 30);

            // Assert
            expect(paymentRepository.create).toHaveBeenCalledTimes(1);
            expect(paymentRepository.create).toHaveBeenCalledWith(expect.objectContaining({
                Valor: 30,
                IdMarcacao: 11
            }));
            expect(resultado.pagamentos).toHaveLength(1);
        });

        it('não deve gerar nenhum pagamento quando todas as marcações já têm pagamento ativo', async () => {
            // Act
            const resultado = await paymentService.GerarPagamento([
                {
                    IdMarcacao: 10,
                    Pagamento: [{ IdPagamento: 91, EstadoPagamento: 'Pendente' }]
                }
            ], 30);

            // Assert
            expect(paymentRepository.create).not.toHaveBeenCalled();
            expect(resultado.pagamentos).toHaveLength(0);
        });
    });

    describe('GerarPagamentosMassa', () => {
        it('deve gerar pagamentos para múltiplos alunos corretamente', async () => {
            // Arrange
            const alunosIds = [1, 2, 3];
            const valor = 40;
            const descricao = 'Quota';

            paymentRepository.create.mockResolvedValue({ success: true });

            // Act
            const resultados = await paymentService.GerarPagamentosMassa(alunosIds, valor, descricao);

            // Assert
            expect(resultados.gerados).toBe(3);
            expect(paymentRepository.create).toHaveBeenCalledTimes(3);
        });
    });
});
