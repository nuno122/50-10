const classService = require('../../backend/src/services/classService');
const classRepo = require('../../backend/src/repositories/classRepository');

jest.mock('../../backend/src/repositories/classRepository');

describe('Class Service', () => {
    // Datas dinâmicas para evitar fragilidade
    const amanhaData = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const amanhaHoraInicio = `${amanhaData}T10:00:00.000Z`;
    const amanhaHoraFim = `${amanhaData}T11:00:00.000Z`;

    const buildValidClassPayload = (overrides = {}) => ({
        Data: amanhaData,
        HoraInicio: amanhaHoraInicio,
        HoraFim: amanhaHoraFim,
        CapacidadeMaxima: 20,
        Preco: 15,
        IdProfessor: 1,
        IdEstudio: 2,
        IdEstiloDanca: 3,
        ...overrides
    });

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Setup padrão válido
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
                HoraInicio: `${amanhaData}T08:00:00.000Z`,
                HoraFim: `${amanhaData}T18:00:00.000Z`
            }
        ]);
        classRepo.findOverlapping.mockResolvedValue([]);
    });

    describe('Criar Aula', () => {
        it('deve emitir erro 400 quando nao forem enviados todos os dados obrigatorios', async () => {
            const dadosIncompletos = { Data: amanhaData };

            await expect(classService.criarAula(dadosIncompletos))
                .rejects
                .toThrow(/Campos obrigatorios em falta/);
            
            expect(classRepo.create).not.toHaveBeenCalled();
        });

        it('deve emitir erro 400 quando houver sobreposicao de horarios no mesmo estudio', async () => {
            const payload = buildValidClassPayload();

            classRepo.findOverlapping.mockResolvedValue([
                {
                    HoraInicio: `${amanhaData}T09:30:00.000Z`,
                    HoraFim: `${amanhaData}T10:30:00.000Z`
                }
            ]);

            await expect(classService.criarAula(payload))
                .rejects
                .toThrow('Conflito de horario! Estudio ocupado.');
            
            expect(classRepo.create).not.toHaveBeenCalled();
        });

        it('deve emitir erro 400 quando o professor nao der o estilo escolhido', async () => {
            const payload = buildValidClassPayload();

            classRepo.findProfessorById.mockResolvedValue({
                IdProfessor: 1,
                EstiloProfessor: [{ IdEstiloDanca: 9 }]
            });

            await expect(classService.criarAula(payload))
                .rejects
                .toThrow('O professor selecionado nao esta associado ao estilo escolhido.');
            
            expect(classRepo.create).not.toHaveBeenCalled();
        });

        it('deve emitir erro 400 quando o estudio nao suportar o estilo escolhido', async () => {
            const payload = buildValidClassPayload();

            classRepo.findEstudioById.mockResolvedValue({
                IdEstudio: 2,
                EstudioEstilo: [{ IdEstiloDanca: 9 }]
            });

            await expect(classService.criarAula(payload))
                .rejects
                .toThrow('O estudio selecionado nao suporta o estilo escolhido.');
            
            expect(classRepo.create).not.toHaveBeenCalled();
        });

        it('deve emitir erro 400 quando o professor nao tiver disponibilidade nesse horario', async () => {
            const payload = buildValidClassPayload();

            classRepo.findProfessorAvailabilityByDate.mockResolvedValue([
                {
                    HoraInicio: `${amanhaData}T08:00:00.000Z`,
                    HoraFim: `${amanhaData}T09:30:00.000Z`
                }
            ]);

            await expect(classService.criarAula(payload))
                .rejects
                .toThrow('O professor nao tem disponibilidade registada para este horario.');
            
            expect(classRepo.create).not.toHaveBeenCalled();
        });

        it('deve criar a aula com sucesso quando todos os dados estiverem preenchidos e nao houver sobreposicoes', async () => {
            const payload = buildValidClassPayload();
            classRepo.create.mockResolvedValue({ IdAula: 10, ...payload });

            const resultado = await classService.criarAula(payload);

            expect(resultado.mensagem).toBe('Aula agendada!');
            expect(resultado.aula.IdAula).toBe(10);
            expect(classRepo.create).toHaveBeenCalledWith({
                ...payload,
                TipoAula: 'Regular'
            });
        });

        it('deve falhar a criacao da aula se ocorrer uma quebra inesperada na base de dados', async () => {
            const payload = buildValidClassPayload();
            classRepo.create.mockRejectedValue(new Error('Prisma: Database connection timeout'));

            await expect(classService.criarAula(payload))
                .rejects
                .toThrow('Prisma: Database connection timeout');
        });
    });

    describe('Criar Aulas Em Lote', () => {
        it('deve devolver erro 400 quando nao existirem aulas para criar', async () => {
            await expect(classService.criarAulasEmLote({ Aulas: [] }))
                .rejects
                .toThrow('Envia pelo menos uma aula para criar.');
            
            expect(classRepo.create).not.toHaveBeenCalled();
        });

        it('deve criar em lote e devolver o resumo com sucesso e falhas', async () => {
            const primeiraAula = buildValidClassPayload({ Referencia: 'Linha 2' });
            const segundaAula = buildValidClassPayload({ 
                HoraInicio: `${amanhaData}T10:30:00.000Z`,
                HoraFim: `${amanhaData}T11:30:00.000Z`,
                Referencia: 'Linha 3' 
            });

            classRepo.findOverlapping
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([
                    {
                        HoraInicio: amanhaHoraInicio,
                        HoraFim: amanhaHoraFim
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
            expect(classRepo.create).toHaveBeenCalledTimes(1);
        });
    });
});
