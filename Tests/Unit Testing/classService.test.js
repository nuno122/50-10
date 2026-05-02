const classService = require('../../backend/src/services/classService');
const classRepo = require('../../backend/src/repositories/classRepository');

jest.mock('../../backend/src/repositories/classRepository');

describe('Class Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Criar Aula', () => {
        beforeEach(() => {
            classRepo.findProfessorById.mockResolvedValue({
                IdProfessor: 1,
                EstiloProfessor: [{ IdEstiloDanca: 3 }]
            });
            classRepo.findEstudioById.mockResolvedValue({
                IdEstudio: 2,
                EstudioEstilo: [{ IdEstiloDanca: 3 }]
            });
            classRepo.findEstiloById.mockResolvedValue({ IdEstiloDanca: 3 });
            classRepo.findProfessorAvailabilityByDate.mockResolvedValue([
                {
                    HoraInicio: '2026-05-01T08:00:00.000Z',
                    HoraFim: '2026-05-01T18:00:00.000Z'
                }
            ]);
        });

        it('deve emitir erro 400 quando nao forem enviados todos os dados obrigatorios', async () => {
            const dadosIncompletos = {
                Data: '2026-05-01'
            };

            await expect(classService.criarAula(dadosIncompletos))
                .rejects
                .toThrow(/Campos obrigatorios em falta/);
        });

        it('deve emitir erro 400 quando houver sobreposicao de horarios no mesmo estudio', async () => {
            const dadosPreenchidos = {
                Data: '2026-05-01',
                HoraInicio: '2026-05-01T10:00:00.000Z',
                HoraFim: '2026-05-01T11:00:00.000Z',
                CapacidadeMaxima: 20,
                Preco: 15,
                IdProfessor: 1,
                IdEstudio: 2,
                IdEstiloDanca: 3
            };

            classRepo.findOverlapping.mockResolvedValue([
                {
                    HoraInicio: '2026-05-01T09:30:00.000Z',
                    HoraFim: '2026-05-01T10:30:00.000Z'
                }
            ]);

            await expect(classService.criarAula(dadosPreenchidos))
                .rejects
                .toThrow('Conflito de horario! Estudio ocupado.');
        });

        it('deve emitir erro 400 quando o professor nao der o estilo escolhido', async () => {
            const dadosPreenchidos = {
                Data: '2026-05-01',
                HoraInicio: '2026-05-01T10:00:00.000Z',
                HoraFim: '2026-05-01T11:00:00.000Z',
                CapacidadeMaxima: 20,
                Preco: 15,
                IdProfessor: 1,
                IdEstudio: 2,
                IdEstiloDanca: 3
            };

            classRepo.findProfessorById.mockResolvedValue({
                IdProfessor: 1,
                EstiloProfessor: [{ IdEstiloDanca: 9 }]
            });

            await expect(classService.criarAula(dadosPreenchidos))
                .rejects
                .toThrow('O professor selecionado nao esta associado ao estilo escolhido.');
        });

        it('deve emitir erro 400 quando o estudio nao suportar o estilo escolhido', async () => {
            const dadosPreenchidos = {
                Data: '2026-05-01',
                HoraInicio: '2026-05-01T10:00:00.000Z',
                HoraFim: '2026-05-01T11:00:00.000Z',
                CapacidadeMaxima: 20,
                Preco: 15,
                IdProfessor: 1,
                IdEstudio: 2,
                IdEstiloDanca: 3
            };

            classRepo.findEstudioById.mockResolvedValue({
                IdEstudio: 2,
                EstudioEstilo: [{ IdEstiloDanca: 9 }]
            });

            await expect(classService.criarAula(dadosPreenchidos))
                .rejects
                .toThrow('O estudio selecionado nao suporta o estilo escolhido.');
        });

        it('deve emitir erro 400 quando o professor nao tiver disponibilidade nesse horario', async () => {
            const dadosPreenchidos = {
                Data: '2026-05-01',
                HoraInicio: '2026-05-01T10:00:00.000Z',
                HoraFim: '2026-05-01T11:00:00.000Z',
                CapacidadeMaxima: 20,
                Preco: 15,
                IdProfessor: 1,
                IdEstudio: 2,
                IdEstiloDanca: 3
            };

            classRepo.findOverlapping.mockResolvedValue([]);
            classRepo.findProfessorAvailabilityByDate.mockResolvedValue([
                {
                    HoraInicio: '2026-05-01T08:00:00.000Z',
                    HoraFim: '2026-05-01T09:30:00.000Z'
                }
            ]);

            await expect(classService.criarAula(dadosPreenchidos))
                .rejects
                .toThrow('O professor nao tem disponibilidade registada para este horario.');
        });

        it('deve criar a aula com sucesso quando todos os dados estiverem preenchidos e nao houver sobreposicoes', async () => {
            const dadosValidos = {
                Data: '2026-05-01',
                HoraInicio: '2026-05-01T10:00:00.000Z',
                HoraFim: '2026-05-01T11:00:00.000Z',
                CapacidadeMaxima: 20,
                Preco: 15,
                IdProfessor: 1,
                IdEstudio: 2,
                IdEstiloDanca: 3
            };

            classRepo.findOverlapping.mockResolvedValue([]);
            classRepo.create.mockResolvedValue({ IdAula: 10, ...dadosValidos });

            const resultado = await classService.criarAula(dadosValidos);

            expect(resultado.mensagem).toBe('Aula agendada!');
            expect(resultado.aula.IdAula).toBe(10);
            expect(classRepo.create).toHaveBeenCalledWith({
                ...dadosValidos,
                TipoAula: 'Regular'
            });
        });

        it('deve falhar a criacao da aula se ocorrer uma quebra inesperada na base de dados', async () => {
            const dadosValidos = {
                Data: '2026-05-01',
                HoraInicio: '2026-05-01T10:00:00.000Z',
                HoraFim: '2026-05-01T11:00:00.000Z',
                CapacidadeMaxima: 20,
                Preco: 15,
                IdProfessor: 1,
                IdEstudio: 2,
                IdEstiloDanca: 3
            };

            classRepo.findOverlapping.mockResolvedValue([]);
            classRepo.create.mockRejectedValue(new Error('Prisma: Database connection timeout'));

            await expect(classService.criarAula(dadosValidos))
                .rejects
                .toThrow('Prisma: Database connection timeout');
        });
    });

    describe('Criar Aulas Em Lote', () => {
        beforeEach(() => {
            classRepo.findProfessorById.mockResolvedValue({
                IdProfessor: 1,
                EstiloProfessor: [{ IdEstiloDanca: 3 }]
            });
            classRepo.findEstudioById.mockResolvedValue({
                IdEstudio: 2,
                EstudioEstilo: [{ IdEstiloDanca: 3 }]
            });
            classRepo.findEstiloById.mockResolvedValue({ IdEstiloDanca: 3 });
            classRepo.findProfessorAvailabilityByDate.mockResolvedValue([
                {
                    HoraInicio: '2026-05-01T08:00:00.000Z',
                    HoraFim: '2026-05-01T18:00:00.000Z'
                }
            ]);
        });

        it('deve devolver erro 400 quando nao existirem aulas para criar', async () => {
            await expect(classService.criarAulasEmLote({ Aulas: [] }))
                .rejects
                .toThrow('Envia pelo menos uma aula para criar.');
        });

        it('deve criar em lote e devolver o resumo com sucesso e falhas', async () => {
            const primeiraAula = {
                Data: '2026-05-01',
                HoraInicio: '2026-05-01T10:00:00.000Z',
                HoraFim: '2026-05-01T11:00:00.000Z',
                CapacidadeMaxima: 20,
                Preco: 15,
                IdProfessor: 1,
                IdEstudio: 2,
                IdEstiloDanca: 3,
                Referencia: 'Linha 2'
            };

            const segundaAula = {
                Data: '2026-05-01',
                HoraInicio: '2026-05-01T10:30:00.000Z',
                HoraFim: '2026-05-01T11:30:00.000Z',
                CapacidadeMaxima: 20,
                Preco: 15,
                IdProfessor: 1,
                IdEstudio: 2,
                IdEstiloDanca: 3,
                Referencia: 'Linha 3'
            };

            classRepo.findOverlapping
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([
                    {
                        HoraInicio: '2026-05-01T10:00:00.000Z',
                        HoraFim: '2026-05-01T11:00:00.000Z'
                    }
                ]);

            classRepo.create.mockResolvedValueOnce({ IdAula: 10, ...primeiraAula });

            const resultado = await classService.criarAulasEmLote({
                Aulas: [primeiraAula, segundaAula]
            });

            expect(resultado.totalRecebidas).toBe(2);
            expect(resultado.totalCriadas).toBe(1);
            expect(resultado.totalFalhas).toBe(1);
            expect(resultado.aulas[0].IdAula).toBe(10);
            expect(resultado.erros[0].referencia).toBe('Linha 3');
            expect(resultado.erros[0].mensagem).toBe('Conflito de horario! Estudio ocupado.');
        });
    });
});
