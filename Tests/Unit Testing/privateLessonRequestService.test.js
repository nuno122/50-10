const bookingService = require('../../backend/src/services/bookingService');
const classRepo = require('../../backend/src/repositories/classRepository');
const classService = require('../../backend/src/services/classService');
const privateLessonRequestRepo = require('../../backend/src/repositories/privateLessonRequestRepository');
const privateLessonRequestService = require('../../backend/src/services/privateLessonRequestService');

jest.mock('../../backend/src/services/bookingService');
jest.mock('../../backend/src/repositories/classRepository');
jest.mock('../../backend/src/services/classService');
jest.mock('../../backend/src/repositories/privateLessonRequestRepository');

describe('Private Lesson Request Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        bookingService.listarAlunosDoEncarregado.mockResolvedValue([
            { IdAluno: 'aluno-1', Nome: 'Educando Teste' }
        ]);
        classRepo.findEstiloById.mockResolvedValue({ IdEstiloDanca: 'estilo-1' });
    });

    describe('criarPedido', () => {
        it('deve criar o pedido quando os dados sao validos', async () => {
            privateLessonRequestRepo.create.mockResolvedValue({ IdPedidoAulaPrivada: 'pedido-1' });

            const resultado = await privateLessonRequestService.criarPedido({
                IdAluno: 'aluno-1',
                IdEstiloDanca: 'estilo-1',
                DataPretendida: '2028-01-15',
                HoraPretendida: '10:30',
                DuracaoMinutos: 60,
                CapacidadePretendida: 1,
                Observacoes: 'Preferencia por horario da manha'
            }, 'enc-1');

            expect(resultado.IdPedidoAulaPrivada).toBe('pedido-1');
            expect(privateLessonRequestRepo.create).toHaveBeenCalled();
        });

        it('deve falhar se o aluno nao estiver associado ao encarregado', async () => {
            bookingService.listarAlunosDoEncarregado.mockResolvedValue([]);

            await expect(privateLessonRequestService.criarPedido({
                IdAluno: 'aluno-2',
                IdEstiloDanca: 'estilo-1',
                DataPretendida: '2028-01-15',
                HoraPretendida: '10:30',
                DuracaoMinutos: 60
            }, 'enc-1')).rejects.toThrow('O aluno selecionado nao esta associado a este encarregado.');
        });
    });

    describe('aprovarPedido', () => {
        it('deve aprovar o pedido e converter em aula particular', async () => {
            privateLessonRequestRepo.findById.mockResolvedValue({
                IdPedidoAulaPrivada: 'pedido-1',
                IdAluno: 'aluno-1',
                IdEstiloDanca: 'estilo-1',
                EstadoPedido: 'Pendente',
                DataPretendida: new Date('2028-01-15T00:00:00.000Z'),
                HoraPretendida: new Date('1970-01-01T10:30:00.000Z'),
                DuracaoMinutos: 60,
                CapacidadePretendida: 1
            });
            classService.criarAula.mockResolvedValue({
                aula: { IdAula: 'aula-1' }
            });
            bookingService.FazerMarcacao.mockResolvedValue({
                marcacao: { IdMarcacao: 'marc-1' }
            });
            privateLessonRequestRepo.update.mockResolvedValue({
                IdPedidoAulaPrivada: 'pedido-1',
                EstadoPedido: 'Aprovado'
            });

            const resultado = await privateLessonRequestService.aprovarPedido('pedido-1', {
                IdProfessor: 'prof-1',
                IdEstudio: 'est-1',
                Preco: 25,
                ObservacaoDirecao: 'Aprovado com professor disponivel'
            }, 'dir-1');

            expect(classService.criarAula).toHaveBeenCalledWith(expect.objectContaining({
                TipoAula: 'Particular',
                OrigemAula: 'PedidoEncarregado',
                IdProfessor: 'prof-1',
                IdEstudio: 'est-1',
                IdEstiloDanca: 'estilo-1'
            }));
            expect(bookingService.FazerMarcacao).toHaveBeenCalledWith('aula-1', 'aluno-1');
            expect(resultado.pedido.EstadoPedido).toBe('Aprovado');
        });

        it('deve falhar se o pedido ja nao estiver pendente', async () => {
            privateLessonRequestRepo.findById.mockResolvedValue({
                IdPedidoAulaPrivada: 'pedido-1',
                EstadoPedido: 'Aprovado'
            });

            await expect(privateLessonRequestService.aprovarPedido('pedido-1', {}, 'dir-1'))
                .rejects
                .toThrow('Apenas pedidos pendentes podem ser aprovados.');
        });
    });

    describe('rejeitarPedido', () => {
        it('deve rejeitar um pedido pendente', async () => {
            privateLessonRequestRepo.findById.mockResolvedValue({
                IdPedidoAulaPrivada: 'pedido-1',
                EstadoPedido: 'Pendente'
            });
            privateLessonRequestRepo.update.mockResolvedValue({
                IdPedidoAulaPrivada: 'pedido-1',
                EstadoPedido: 'Rejeitado'
            });

            const resultado = await privateLessonRequestService.rejeitarPedido('pedido-1', 'Sem vaga neste horario', 'dir-1');

            expect(resultado.pedido.EstadoPedido).toBe('Rejeitado');
            expect(privateLessonRequestRepo.update).toHaveBeenCalled();
        });
    });
});
