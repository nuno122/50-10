const classService = require('../../backend/src/services/classService');
const classRepo = require('../../backend/src/repositories/classRepository');

jest.mock('../../backend/src/repositories/classRepository');

describe('Class Service', () => {
    beforeEach(() => {
        // Arrange (Comum)
        jest.clearAllMocks();
    });

    describe('Criar Aula', () => {
        beforeEach(() => {
            classRepo.findProfessorById.mockResolvedValue({ IdProfessor: 1 });
            classRepo.findEstudioById.mockResolvedValue({ IdEstudio: 2 });
            classRepo.findEstiloById.mockResolvedValue({ IdEstiloDanca: 3 });
        });

        it('deve emitir erro 400 quando não forem enviados todos os dados obrigatórios', async () => {
            // Arrange
            const dadosIncompletos = {
                Data: '2026-05-01',
                // Faltam campos (HoraInicio, Preco, ...)
            };

            // Act & Assert
            await expect(classService.criarAula(dadosIncompletos))
                .rejects
                .toThrow(/Campos obrigatorios em falta/);
        });

        it('deve emitir erro 400 quando houver sobreposição de horários no mesmo estúdio', async () => {
            // Arrange
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

            // Simulamos uma aula já existente que interseta o horário sugerido
            classRepo.findOverlapping.mockResolvedValue([
                {
                    HoraInicio: '2026-05-01T09:30:00.000Z',
                    HoraFim: '2026-05-01T10:30:00.000Z'
                }
            ]);

            // Act & Assert
            await expect(classService.criarAula(dadosPreenchidos))
                .rejects
                .toThrow('Conflito de horario! Estudio ocupado.');
        });

        it('deve criar a aula com sucesso quando todos os dados estiverem preenchidos e não houver sobreposições', async () => {
            // Arrange
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

            classRepo.findOverlapping.mockResolvedValue([]); // Estúdio livre
            classRepo.create.mockResolvedValue({ IdAula: 10, ...dadosValidos });

            // Act
            const resultado = await classService.criarAula(dadosValidos);

            // Assert
            expect(resultado.mensagem).toBe('Aula agendada!');
            expect(resultado.aula.IdAula).toBe(10);
            expect(classRepo.create).toHaveBeenCalledWith(dadosValidos);
        });

        it('deve falhar a criação da aula se ocorrer uma quebra inesperada na base de dados (Ex: Prisma Timeout)', async () => {
            // Arrange
            const dadosValidos = {
                Data: '2026-05-01', HoraInicio: '2026-05-01T10:00:00.000Z', HoraFim: '2026-05-01T11:00:00.000Z', 
                CapacidadeMaxima: 20, Preco: 15, IdProfessor: 1, IdEstudio: 2, IdEstiloDanca: 3
            };
            classRepo.findOverlapping.mockResolvedValue([]); // Passa validações
            classRepo.create.mockRejectedValue(new Error('Prisma: Database connection timeout'));

            // Act & Assert
            await expect(classService.criarAula(dadosValidos))
                .rejects
                .toThrow('Prisma: Database connection timeout');
        });
    });
});
