const bookingService = require('../backend/src/services/bookingService');
const bookingRepo = require('../backend/src/repositories/bookingRepository');

jest.mock('../backend/src/repositories/bookingRepository');

describe('Booking Service', () => {
    beforeEach(() => {
        // Arrange (Comum): Limpar mocks para evitar efeitos colaterais entre testes
        jest.clearAllMocks();
    });

    describe('Criar Marcação', () => {
        it('deve rejeitar com erro 400 quando o aluno ou a aula não forem fornecidos', async () => {
            // Arrange
            const idAluno = null;
            const idAula = 1;

            // Act & Assert
            await expect(bookingService.criarMarcacao(idAluno, idAula))
                .rejects
                .toThrow('IdAluno e IdAula são obrigatórios.');
        });

        it('deve rejeitar com erro 404 quando o aluno não for encontrado', async () => {
            // Arrange
            bookingRepo.findAlunoById.mockResolvedValue(null);
            
            // Act & Assert
            await expect(bookingService.criarMarcacao(1, 1))
                .rejects
                .toThrow('Aluno não encontrado.');
        });

        it('deve rejeitar com erro 400 quando a aula estiver totalmente lotada', async () => {
            // Arrange
            bookingRepo.findAlunoById.mockResolvedValue({ IdUtilizador: 1 });
            bookingRepo.findAulaWithMarcacoes.mockResolvedValue({
                IdAula: 1, 
                EstaAtivo: true, 
                Data: new Date(Date.now() + 86400000), 
                CapacidadeMaxima: 1,
                Marcacao: [{ EstaAtivo: true }] // 1 marcação ativa para capacidade 1
            });

            // Act & Assert
            await expect(bookingService.criarMarcacao(1, 1))
                .rejects
                .toThrow('Aula lotada.');
        });

        it('deve criar uma marcação com sucesso e devolver a mensagem de confirmação quando os dados forems válidos', async () => {
            // Arrange
            bookingRepo.findAlunoById.mockResolvedValue({ IdUtilizador: 1 });
            bookingRepo.findAulaWithMarcacoes.mockResolvedValue({
                 IdAula: 1, 
                 EstaAtivo: true, 
                 Data: new Date(Date.now() + 86400000), // Aula amanhã
                 CapacidadeMaxima: 10,
                 Preco: 15,
                 Marcacao: []
            });
            bookingRepo.findExisting.mockResolvedValue(null);
            bookingRepo.create.mockResolvedValue({ IdMarcacao: 1, IdAluno: 1, IdAula: 1 });
            bookingRepo.criarPagamento.mockResolvedValue({});

            // Act
            const resultado = await bookingService.criarMarcacao(1, 1);
            
            // Assert
            expect(resultado.mensagem).toBe('Lugar reservado!');
            expect(resultado.marcacao).toBeDefined();
            expect(bookingRepo.create).toHaveBeenCalledWith(1, 1);
            expect(bookingRepo.criarPagamento).toHaveBeenCalled();
        });

        it('deve propagar a falha se o registo da transação falhar por um erro grave na base de dados (Ex: Unique Constraint)', async () => {
             // Arrange
             bookingRepo.findAlunoById.mockResolvedValue({ IdUtilizador: 1 });
             bookingRepo.findAulaWithMarcacoes.mockResolvedValue({
                 IdAula: 1, EstaAtivo: true, Data: new Date(Date.now() + 86400000), CapacidadeMaxima: 10, Preco: 15, Marcacao: []
             });
             bookingRepo.findExisting.mockResolvedValue(null);
             
             // Injeção de Falha Grave da BD
             bookingRepo.create.mockRejectedValue(new Error('Prisma: Unique constraint failed'));

             // Act & Assert
             await expect(bookingService.criarMarcacao(1, 1))
                 .rejects
                 .toThrow('Prisma: Unique constraint failed');
        });
    });

    describe('Cancelar Marcação', () => {
         it('deve rejeitar com erro 404 quando a marcação não for encontrada', async () => {
             // Arrange
             bookingRepo.findByIdComAula.mockResolvedValue(null);
             
             // Act & Assert
             await expect(bookingService.cancelarMarcacao(1, 1, 'Motivo'))
                .rejects
                .toThrow('Marcação não encontrada.');
         });

         it('deve aprovar o cancelamento imediatamente quando a antecedência for igual ou superior a 24 horas', async () => {
             // Arrange
             const dataAulaLonga = new Date(Date.now() + 86400000 * 2); // daqui a 48h
             bookingRepo.findByIdComAula.mockResolvedValue({
                 IdMarcacao: 1,
                 IdAluno: 1,
                 EstaAtivo: true,
                 Aula: {
                     Data: dataAulaLonga,
                     HoraInicio: new Date(dataAulaLonga.setHours(10, 0, 0, 0))
                 }
             });
             bookingRepo.cancelar.mockResolvedValue({});

             // Act
             const resultado = await bookingService.cancelarMarcacao(1, 1, 'Doente');
             
             // Assert
             expect(resultado.sucesso).toBe(true);
             expect(resultado.mensagem).toBe('Cancelamento aprovado automaticamente.');
             expect(bookingRepo.cancelar).toHaveBeenCalledWith(1, 'Doente');
         });

         it('deve classificar o pedido como pendente quando a antecedência for inferior a 24 horas', async () => {
             // Arrange
            const dataAulaCurta = new Date(Date.now() + 3600000 * 2); // daqui a 2h
            bookingRepo.findByIdComAula.mockResolvedValue({
                IdMarcacao: 1,
                IdAluno: 1,
                EstaAtivo: true,
                Aula: {
                    Data: dataAulaCurta,
                    HoraInicio: new Date(dataAulaCurta.setHours(10, 0, 0, 0))
                }
            });
            bookingRepo.cancelar.mockResolvedValue({});

            // Act
            const resultado = await bookingService.cancelarMarcacao(1, 1, 'Imprevisto');
            
            // Assert
            expect(resultado.sucesso).toBe(false);
            expect(resultado.mensagem).toMatch(/Prazo de 24h expirou/);
            expect(bookingRepo.cancelar).toHaveBeenCalledWith(1, 'Pendente_Cancelamento');
        });
    });
});
