const classService = require('../../src/services/classService');
const classRepo = require('../../src/repositories/classRepository');
const paymentService = require('../../src/services/paymentService');

jest.mock('../../src/repositories/classRepository');
jest.mock('../../src/services/paymentService');

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
            Capacidade: 30,
            EstudioEstilo: [{ IdEstiloDanca: 3 }]
        });
        classRepo.findProfessorClassesByDate.mockResolvedValue([]);
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
                .toThrow('Conflito de horário: estúdio ocupado.');
            
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
                Capacidade: 30,
                EstudioEstilo: [{ IdEstiloDanca: 9 }]
            });

            await expect(classService.criarAula(payload))
                .rejects
                .toThrow('O estúdio selecionado não suporta o estilo escolhido.');
            
            expect(classRepo.create).not.toHaveBeenCalled();
        });

        it('deve emitir erro 400 quando o professor nao tiver disponibilidade nesse horario', async () => {
            const payload = buildValidClassPayload({ TipoAula: 'Particular' });
            classRepo.findProfessorAvailabilityByDate.mockResolvedValue([
                {
                    HoraInicio: `${amanhaData}T08:00:00.000Z`,
                    HoraFim: `${amanhaData}T09:30:00.000Z`
                }
            ]);

            await expect(classService.criarAula(payload))
                .rejects
                .toThrow('O professor não tem disponibilidade registada para este horário.');
            
            expect(classRepo.create).not.toHaveBeenCalled();
        });

        it('deve criar uma aula regular mesmo sem disponibilidade registada do professor', async () => {
            const dadosValidos = {
                Data: '2026-05-01',
                HoraInicio: '2026-05-01T10:00:00.000Z',
                HoraFim: '2026-05-01T11:00:00.000Z',
                CapacidadeMaxima: 20,
                Preco: 15,
                IdProfessor: 1,
                IdEstudio: 2,
                IdEstiloDanca: 3,
                TipoAula: 'Regular'
            };

            classRepo.findOverlapping.mockResolvedValue([]);
            classRepo.findProfessorClassesByDate.mockResolvedValue([]);
            classRepo.findProfessorAvailabilityByDate.mockResolvedValue([]);
            classRepo.create.mockResolvedValue({ IdAula: 11, ...dadosValidos });

            const resultado = await classService.criarAula(dadosValidos);

            expect(resultado.aula.IdAula).toBe(11);
            expect(classRepo.findProfessorAvailabilityByDate).not.toHaveBeenCalled();
        });

        it('deve criar a aula com sucesso quando todos os dados estiverem preenchidos e nao houver sobreposicoes', async () => {
            const payload = buildValidClassPayload();
            classRepo.create.mockResolvedValue({ IdAula: 10, ...payload });

            const resultado = await classService.criarAula(payload);
            expect(resultado.mensagem).toBe('Aula agendada!');
            expect(resultado.aula.IdAula).toBe(10);
            expect(classRepo.create).toHaveBeenCalledWith({
                ...payload,
                TipoAula: 'Regular',
                OrigemAula: 'Direcao'
            });
        });

        it('deve falhar a criacao da aula se ocorrer uma quebra inesperada na base de dados', async () => {
            const payload = buildValidClassPayload();            classRepo.create.mockRejectedValue(new Error('Prisma: Database connection timeout'));

            await expect(classService.criarAula(payload))
                .rejects
                .toThrow('Prisma: Database connection timeout');
        });

        it('deve emitir erro 400 quando o professor ja tiver outra aula no mesmo horario', async () => {
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
            classRepo.findProfessorClassesByDate.mockResolvedValue([
                {
                    HoraInicio: '2026-05-01T10:30:00.000Z',
                    HoraFim: '2026-05-01T11:30:00.000Z'
                }
            ]);

            await expect(classService.criarAula(dadosPreenchidos))
                .rejects
                .toThrow('Conflito de horário: professor ocupado.');
        });

        it('deve emitir erro 400 quando a capacidade exceder a do estudio', async () => {
            const dadosPreenchidos = {
                Data: '2026-05-01',
                HoraInicio: '2026-05-01T10:00:00.000Z',
                HoraFim: '2026-05-01T11:00:00.000Z',
                CapacidadeMaxima: 40,
                Preco: 15,
                IdProfessor: 1,
                IdEstudio: 2,
                IdEstiloDanca: 3
            };

            await expect(classService.criarAula(dadosPreenchidos))
                .rejects
                .toThrow('A capacidade da aula excede a capacidade do estúdio selecionado.');
        });

        it('deve permitir um professor alternativo numa aula regular quando a Direcao o desbloquear', async () => {
            const dadosValidos = {
                Data: '2026-05-01',
                HoraInicio: '2026-05-01T10:00:00.000Z',
                HoraFim: '2026-05-01T11:00:00.000Z',
                CapacidadeMaxima: 20,
                Preco: 15,
                IdProfessor: 1,
                IdEstudio: 2,
                IdEstiloDanca: 3,
                TipoAula: 'Regular',
                PermitirProfessorAlternativo: true
            };

            classRepo.findProfessorById.mockResolvedValue({
                IdProfessor: 1,
                EstiloProfessor: [{ IdEstiloDanca: 9 }]
            });
            classRepo.findOverlapping.mockResolvedValue([]);
            classRepo.findProfessorClassesByDate.mockResolvedValue([]);
            classRepo.create.mockResolvedValue({ IdAula: 12, ...dadosValidos });

            const resultado = await classService.criarAula(dadosValidos);

            expect(resultado.aula.IdAula).toBe(12);
            expect(classRepo.create).toHaveBeenCalledWith({
                ...dadosValidos,
                TipoAula: 'Regular',
                OrigemAula: 'Direcao'
            });
        });

        it('deve permitir um estudio alternativo quando a Direcao o desbloquear e nao existir nenhum estudio compativel disponivel', async () => {
            const dadosValidos = {
                Data: '2026-05-01',
                HoraInicio: '2026-05-01T10:00:00.000Z',
                HoraFim: '2026-05-01T11:00:00.000Z',
                CapacidadeMaxima: 20,
                Preco: 15,
                IdProfessor: 1,
                IdEstudio: 2,
                IdEstiloDanca: 3,
                TipoAula: 'Regular',
                OrigemAula: 'Direcao',
                PermitirEstudioAlternativo: true
            };

            classRepo.findEstudioById.mockResolvedValue({
                IdEstudio: 2,
                Capacidade: 30,
                EstudioEstilo: [{ IdEstiloDanca: 9 }]
            });
            classRepo.findAllStudios.mockResolvedValue([
                {
                    IdEstudio: 2,
                    Capacidade: 30,
                    EstudioEstilo: [{ IdEstiloDanca: 9 }]
                },
                {
                    IdEstudio: 5,
                    Capacidade: 25,
                    EstudioEstilo: [{ IdEstiloDanca: 3 }]
                }
            ]);
            classRepo.findClassesByDate.mockResolvedValue([
                {
                    IdEstudio: 5,
                    HoraInicio: '2026-05-01T10:00:00.000Z',
                    HoraFim: '2026-05-01T11:30:00.000Z'
                }
            ]);
            classRepo.findOverlapping.mockResolvedValue([]);
            classRepo.findProfessorClassesByDate.mockResolvedValue([]);
            classRepo.create.mockResolvedValue({ IdAula: 10, ...dadosValidos });

            const resultado = await classService.criarAula(dadosValidos);

            expect(resultado.aula.IdAula).toBe(10);
            expect(classRepo.create).toHaveBeenCalledWith(dadosValidos);
        });

        it('deve bloquear um estudio alternativo quando existir estudio compativel disponivel', async () => {
            const dadosValidos = {
                Data: '2026-05-01',
                HoraInicio: '2026-05-01T10:00:00.000Z',
                HoraFim: '2026-05-01T11:00:00.000Z',
                CapacidadeMaxima: 20,
                Preco: 15,
                IdProfessor: 1,
                IdEstudio: 2,
                IdEstiloDanca: 3,
                TipoAula: 'Particular',
                OrigemAula: 'PedidoEncarregado',
                PermitirEstudioAlternativo: true
            };

            classRepo.findEstudioById.mockResolvedValue({
                IdEstudio: 2,
                Capacidade: 30,
                EstudioEstilo: [{ IdEstiloDanca: 9 }]
            });
            classRepo.findAllStudios.mockResolvedValue([
                {
                    IdEstudio: 2,
                    Capacidade: 30,
                    EstudioEstilo: [{ IdEstiloDanca: 9 }]
                },
                {
                    IdEstudio: 5,
                    Capacidade: 25,
                    EstudioEstilo: [{ IdEstiloDanca: 3 }]
                }
            ]);
            classRepo.findClassesByDate.mockResolvedValue([]);

            await expect(classService.criarAula(dadosValidos))
                .rejects
                .toThrow('Existem estúdios compatíveis disponíveis para este horário. Escolha primeiro um estúdio associado ao estilo.');
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
            expect(resultado.erros[0].mensagem).toBe('Conflito de horário: estúdio ocupado.');
            expect(classRepo.create).toHaveBeenCalledTimes(1);
        });
    });

    describe('Validar Aula', () => {
        it('deve gerar pagamentos apenas na conclusao da Direcao depois da confirmacao do professor', async () => {
            classRepo.findByIdComAlunos.mockResolvedValue({
                IdAula: 77,
                EstaAtivo: true,
                ConfirmacaoProfessor: true,
                Marcacao: [
                    { IdMarcacao: 10, Pagamento: [] },
                    { IdMarcacao: 11, Pagamento: [] }
                ],
                Preco: 18
            });
            classRepo.atualizarValidacaoDirecao.mockResolvedValue({ IdAula: 77, ValidacaoDirecao: true });
            paymentService.GerarPagamento.mockResolvedValue({
                pagamentos: [{ IdPagamento: 1 }, { IdPagamento: 2 }]
            });

            const resultado = await classService.validarAula(77);

            expect(classRepo.atualizarValidacaoDirecao).toHaveBeenCalledWith(77);
            expect(paymentService.GerarPagamento).toHaveBeenCalledWith([
                { IdMarcacao: 10, Pagamento: [] },
                { IdMarcacao: 11, Pagamento: [] }
            ], 18);
            expect(resultado.pagamentos).toHaveLength(2);
        });

        it('deve bloquear a conclusao da Direcao quando o professor ainda nao confirmou a aula', async () => {
            classRepo.findByIdComAlunos.mockResolvedValue({
                IdAula: 88,
                EstaAtivo: true,
                ConfirmacaoProfessor: false,
                Marcacao: [{ IdMarcacao: 12, Pagamento: [] }],
                Preco: 20
            });

            await expect(classService.validarAula(88))
                .rejects
                .toThrow('A aula tem de ser confirmada pelo professor antes da validação da Direção.');

            expect(classRepo.atualizarValidacaoDirecao).not.toHaveBeenCalled();
            expect(paymentService.GerarPagamento).not.toHaveBeenCalled();
        });

        it('deve permitir a conclusao por excecao da Direcao quando o professor nao confirmou mas a aula ja terminou', async () => {
            classRepo.findByIdComAlunos.mockResolvedValue({
                IdAula: 89,
                EstaAtivo: true,
                ConfirmacaoProfessor: false,
                Data: '2020-01-01T00:00:00.000Z',
                HoraFim: '1970-01-01T10:00:00.000Z',
                Marcacao: [{ IdMarcacao: 13, Pagamento: [] }],
                Preco: 22
            });
            classRepo.atualizarValidacaoDirecao.mockResolvedValue({ IdAula: 89, ValidacaoDirecao: true });
            paymentService.GerarPagamento.mockResolvedValue({
                pagamentos: [{ IdPagamento: 5 }]
            });

            const resultado = await classService.validarAula(89, { ConcluirPorExcecao: true });

            expect(classRepo.atualizarValidacaoDirecao).toHaveBeenCalledWith(89);
            expect(paymentService.GerarPagamento).toHaveBeenCalledWith([
                { IdMarcacao: 13, Pagamento: [] }
            ], 22);
            expect(resultado.concluidaPorExcecao).toBe(true);
            expect(resultado.mensagem).toBe('Aula concluída por exceção pela Direção e 1 pagamento gerado.');
        });

        it('deve bloquear a conclusao por excecao se a aula ainda nao terminou', async () => {
            classRepo.findByIdComAlunos.mockResolvedValue({
                IdAula: 90,
                EstaAtivo: true,
                ConfirmacaoProfessor: false,
                Data: '2999-01-01T00:00:00.000Z',
                HoraFim: '1970-01-01T10:00:00.000Z',
                Marcacao: [{ IdMarcacao: 14, Pagamento: [] }],
                Preco: 22
            });

            await expect(classService.validarAula(90, { ConcluirPorExcecao: true }))
                .rejects
                .toThrow('A Direção só pode concluir por exceção depois de a aula terminar.');

            expect(classRepo.atualizarValidacaoDirecao).not.toHaveBeenCalled();
            expect(paymentService.GerarPagamento).not.toHaveBeenCalled();
        });
    });
});
