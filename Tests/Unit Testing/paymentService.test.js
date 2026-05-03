const paymentService = require('../../backend/src/services/paymentService');
const paymentRepository = require('../../backend/src/repositories/paymentRepository');

jest.mock('../../backend/src/repositories/paymentRepository');

describe('Payment Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GerarPagamento', () => {
        it('1️⃣ Deve calcular a data limite como 5 dias após a criação', async () => {
            const mockPagamento = { IdPagamento: 1, Valor: 50 };
            paymentRepository.create.mockResolvedValue(mockPagamento);

            await paymentService.GerarPagamentoIndividual(1, 50, 'Mensalidade');

            const callData = paymentRepository.create.mock.calls[0][0];
            
            const hoje = new Date();
            const dataEsperada = new Date();
            dataEsperada.setDate(hoje.getDate() + 5);

            // Verifica se a diferença é mínima (mesmo dia/hora aproximada)
            expect(callData.DataLimite.toDateString()).toBe(dataEsperada.toDateString());
            expect(callData.Valor).toBe(50);
        });
    });

    describe('GerarPagamentosMassa', () => {
        it('2️⃣ Deve gerar pagamentos para múltiplos alunos corretamente', async () => {
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
