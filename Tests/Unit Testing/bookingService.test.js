const bookingService = require('../../backend/src/services/bookingService');
const bookingRepo = require('../../backend/src/repositories/bookingRepository');
const classRepo = require('../../backend/src/repositories/classRepository');

jest.mock('../../backend/src/repositories/bookingRepository');
jest.mock('../../backend/src/repositories/classRepository');

describe('Booking Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        classRepo.findProfessorAvailabilityByDate.mockResolvedValue([
            {
                HoraInicio: '2026-05-03T08:00:00.000Z',
                HoraFim: '2026-05-03T18:00:00.000Z'
            }
        ]);
    });

    describe('Criar Marcacao', () => {
        it('deve rejeitar com erro 400 quando o aluno ou a aula nao forem fornecidos', async () => {
            await expect(bookingService.criarMarcacao(null, 1))
                .rejects
                .toThrow('IdAluno e IdAula sao obrigatorios.');
        });

        it('deve rejeitar com erro 404 quando o aluno nao for encontrado', async () => {
            bookingRepo.findAlunoById.mockResolvedValue(null);

            await expect(bookingService.criarMarcacao(1, 1))
                .rejects
                .toThrow('Aluno nao encontrado.');
        });

        it('deve rejeitar quando a aula estiver fora da disponibilidade do professor', async () => {
            bookingRepo.findAlunoById.mockResolvedValue({ IdUtilizador: 1 });
            bookingRepo.findAulaWithMarcacoes.mockResolvedValue({
                IdAula: 1,
                IdProfessor: 8,
                EstaAtivo: true,
                Data: new Date('2026-05-03T00:00:00.000Z'),
                HoraInicio: new Date('2026-05-03T19:00:00.000Z'),
                HoraFim: new Date('2026-05-03T20:00:00.000Z'),
                CapacidadeMaxima: 10,
                Preco: 15,
                Marcacao: []
            });
            classRepo.findProfessorAvailabilityByDate.mockResolvedValue([
                {
                    HoraInicio: '2026-05-03T08:00:00.000Z',
                    HoraFim: '2026-05-03T18:00:00.000Z'
                }
            ]);

            await expect(bookingService.criarMarcacao(1, 1))
                .rejects
                .toThrow('O professor nao tem disponibilidade registada para este horario.');
        });

        it('deve rejeitar com erro 400 quando a aula estiver totalmente lotada', async () => {
            bookingRepo.findAlunoById.mockResolvedValue({ IdUtilizador: 1 });
            bookingRepo.findAulaWithMarcacoes.mockResolvedValue({
                IdAula: 1,
                IdProfessor: 8,
                EstaAtivo: true,
                Data: new Date(Date.now() + 86400000),
                HoraInicio: new Date('2026-05-03T10:00:00.000Z'),
                HoraFim: new Date('2026-05-03T11:00:00.000Z'),
                CapacidadeMaxima: 1,
                Preco: 15,
                Marcacao: [{ EstaAtivo: true }]
            });

            await expect(bookingService.criarMarcacao(1, 1))
                .rejects
                .toThrow('Aula lotada.');
        });

        it('deve criar uma marcacao com sucesso quando os dados forem validos', async () => {
            bookingRepo.findAlunoById.mockResolvedValue({ IdUtilizador: 1 });
            bookingRepo.findAulaWithMarcacoes.mockResolvedValue({
                IdAula: 1,
                IdProfessor: 8,
                EstaAtivo: true,
                Data: new Date(Date.now() + 86400000),
                HoraInicio: new Date('2026-05-03T10:00:00.000Z'),
                HoraFim: new Date('2026-05-03T11:00:00.000Z'),
                CapacidadeMaxima: 10,
                Preco: 15,
                Marcacao: []
            });
            bookingRepo.findExisting.mockResolvedValue(null);
            bookingRepo.create.mockResolvedValue({ IdMarcacao: 1, IdAluno: 1, IdAula: 1 });
            bookingRepo.criarPagamento.mockResolvedValue({});

            const resultado = await bookingService.criarMarcacao(1, 1);

            expect(resultado.mensagem).toBe('Lugar reservado!');
            expect(resultado.marcacao).toBeDefined();
            expect(bookingRepo.create).toHaveBeenCalledWith(1, 1);
            expect(bookingRepo.criarPagamento).toHaveBeenCalled();
        });

        it('deve propagar a falha se o registo da transacao falhar na base de dados', async () => {
            bookingRepo.findAlunoById.mockResolvedValue({ IdUtilizador: 1 });
            bookingRepo.findAulaWithMarcacoes.mockResolvedValue({
                IdAula: 1,
                IdProfessor: 8,
                EstaAtivo: true,
                Data: new Date(Date.now() + 86400000),
                HoraInicio: new Date('2026-05-03T10:00:00.000Z'),
                HoraFim: new Date('2026-05-03T11:00:00.000Z'),
                CapacidadeMaxima: 10,
                Preco: 15,
                Marcacao: []
            });
            bookingRepo.findExisting.mockResolvedValue(null);
            bookingRepo.create.mockRejectedValue(new Error('Prisma: Unique constraint failed'));

            await expect(bookingService.criarMarcacao(1, 1))
                .rejects
                .toThrow('Prisma: Unique constraint failed');
        });
    });

    describe('Cancelar Marcacao', () => {
        it('deve rejeitar com erro 404 quando a marcacao nao for encontrada', async () => {
            bookingRepo.findByIdComAula.mockResolvedValue(null);

            await expect(bookingService.cancelarMarcacao(1, 1, 'Motivo'))
                .rejects
                .toThrow('Marcacao nao encontrada.');
        });

        it('deve aprovar o cancelamento imediatamente quando a antecedencia for igual ou superior a 24 horas', async () => {
            const dataAulaLonga = new Date(Date.now() + 86400000 * 2);
            bookingRepo.findByIdComAula.mockResolvedValue({
                IdMarcacao: 1,
                IdAluno: 1,
                EstaAtivo: true,
                EstadoCancelamento: 'SemPedido',
                Aula: {
                    Data: dataAulaLonga,
                    HoraInicio: new Date(dataAulaLonga.setHours(10, 0, 0, 0))
                }
            });
            bookingRepo.cancelar.mockResolvedValue({});

            const resultado = await bookingService.cancelarMarcacao(1, 1, 'Doente');

            expect(resultado.sucesso).toBe(true);
            expect(resultado.mensagem).toBe('Cancelamento aprovado automaticamente.');
            expect(bookingRepo.cancelar).toHaveBeenCalledWith(1, 'Doente');
        });

        it('deve classificar o pedido como pendente quando a antecedencia for inferior a 24 horas', async () => {
            const dataAulaCurta = new Date(Date.now() + 3600000 * 2);
            bookingRepo.findByIdComAula.mockResolvedValue({
                IdMarcacao: 1,
                IdAluno: 1,
                EstaAtivo: true,
                EstadoCancelamento: 'SemPedido',
                Aula: {
                    Data: dataAulaCurta,
                    HoraInicio: new Date(dataAulaCurta.setHours(10, 0, 0, 0))
                }
            });
            bookingRepo.RegistarPedidoCancelamento.mockResolvedValue({});

            const resultado = await bookingService.cancelarMarcacao(1, 1, 'Imprevisto');

            expect(resultado.sucesso).toBe(false);
            expect(resultado.mensagem).toMatch(/Prazo de 24h expirou/);
            expect(bookingRepo.RegistarPedidoCancelamento).toHaveBeenCalledWith(1, 'Imprevisto');
        });
    });
});
