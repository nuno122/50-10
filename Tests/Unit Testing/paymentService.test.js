const paymentService = require('../../backend/src/services/paymentService');
const paymentRepository = require('../../backend/src/repositories/paymentRepository');

jest.mock('../../backend/src/repositories/paymentRepository');

describe('Payment Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GerarPagamento', () => {
        it('deve calcular a data limite como 5 dias apos a criacao', async () => {
            const mockPagamento = { IdPagamento: 1, Valor: 50 };
            paymentRepository.create.mockResolvedValue(mockPagamento);

<<<<<<< HEAD
            await paymentService.GerarPagamentoIndividual(1, 50, 'Mensalidade');
=======
            await paymentService.GerarPagamento([{ IdMarcacao: 9, Pagamento: [] }], 50);
>>>>>>> 18118ca0d054dec66f49986c273baa96687f735c

            const callData = paymentRepository.create.mock.calls[0][0];
            const hoje = new Date();
            const dataEsperada = new Date();
            dataEsperada.setDate(hoje.getDate() + 5);

            expect(callData.DataLimite.toDateString()).toBe(dataEsperada.toDateString());
            expect(callData.Valor).toBe(50);
            expect(callData.IdMarcacao).toBe(9);
        });

        it('deve ignorar marcacoes que ja tenham pagamento ativo', async () => {
            paymentRepository.create.mockResolvedValue({ IdPagamento: 2, Valor: 30 });

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

            expect(paymentRepository.create).toHaveBeenCalledTimes(1);
            expect(paymentRepository.create).toHaveBeenCalledWith(expect.objectContaining({
                Valor: 30,
                IdMarcacao: 11
            }));
            expect(resultado.pagamentos).toHaveLength(1);
        });
    });

    describe('GerarPagamentosMassa', () => {
        it('deve gerar pagamentos para multiplos alunos corretamente', async () => {
            const alunosIds = [1, 2, 3];
            const valor = 40;
            const descricao = 'Quota';

            paymentRepository.create.mockResolvedValue({ success: true });

            const resultados = await paymentService.GerarPagamentosMassa(alunosIds, valor, descricao);

            expect(resultados.gerados).toBe(3);
            expect(paymentRepository.create).toHaveBeenCalledTimes(3);
        });
    });
});
