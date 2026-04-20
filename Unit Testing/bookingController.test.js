const bookingController = require('../backend/src/controllers/bookingController');
const bookingService = require('../backend/src/services/bookingService');

jest.mock('../backend/src/services/bookingService');

describe('Booking Controller', () => {
    let req, res;

    beforeEach(() => {
        jest.clearAllMocks();
        req = {
            body: {},
            params: {},
            utilizador: null
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
    });

    describe('criarMarcacao', () => {
        it('deve retornar 201 em caso de sucesso', async () => {
            req.body = { IdAluno: 1, IdAula: 1 };
            bookingService.criarMarcacao.mockResolvedValue({ mensagem: 'Sucesso' });

            await bookingController.criarMarcacao(req, res);

            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({ mensagem: 'Sucesso' });
        });

        it('deve retornar erro 400 se faltarem parâmetros', async () => {
            req.body = {};
            const mockErro = new Error('Erro mock');
            mockErro.statusCode = 400;
            bookingService.criarMarcacao.mockRejectedValue(mockErro);

            await bookingController.criarMarcacao(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ erro: 'Erro mock' });
        });
    });

    describe('cancelarMarcacao', () => {
        it('deve retornar 200 ao cancelar com sucesso', async () => {
            req.params.idMarcacao = 1;
            req.body = { Motivo: 'Gripe' };
            req.utilizador = { IdUtilizador: 2 };

            bookingService.cancelarMarcacao.mockResolvedValue({ sucesso: true });

            await bookingController.cancelarMarcacao(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(bookingService.cancelarMarcacao).toHaveBeenCalledWith(1, 2, 'Gripe');
            expect(res.json).toHaveBeenCalledWith({ 
                mensagem: 'Marcação cancelada com sucesso.',
                marcacao: { sucesso: true }
            });
        });

        it('deve retornar erro (ex 403) quando não autorizado', async () => {
            req.params.idMarcacao = 1;
            req.utilizador = { IdUtilizador: 2 };
            const erroMock = new Error('Não tens permissão');
            erroMock.statusCode = 403;
            bookingService.cancelarMarcacao.mockRejectedValue(erroMock);

            await bookingController.cancelarMarcacao(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({ erro: 'Não tens permissão' });
        });
    });
});
