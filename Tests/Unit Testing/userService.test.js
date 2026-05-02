const userService = require('../../backend/src/services/userService');
const userRepository = require('../../backend/src/repositories/userRepository');

jest.mock('../../backend/src/repositories/userRepository');

describe('User Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('criarUtilizador - Validacao de campos obrigatorios', () => {
        it('deve rejeitar com 400 quando NomeCompleto esta em falta', async () => {
            const dados = { Email: 'teste@teste.com', Permissoes: 1 };
            await expect(userService.criarUtilizador(dados))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'NomeCompleto é obrigatório.' });
        });

        it('deve rejeitar com 400 quando Email esta em falta', async () => {
            const dados = { NomeCompleto: 'Sr. Teste', Permissoes: 1 };
            await expect(userService.criarUtilizador(dados))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'Email é obrigatório.' });
        });

        it('deve rejeitar com 400 quando NomeUtilizador esta em falta', async () => {
            const dados = { NomeCompleto: 'Sr. Teste', Email: 't@t.com', Permissoes: 3 };
            await expect(userService.criarUtilizador(dados))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'NomeUtilizador é obrigatório.' });
        });

        it('deve rejeitar com 400 quando CodigoPostal esta em falta', async () => {
            const dados = {
                NomeCompleto: 'Sr. Teste',
                NomeUtilizador: 'teste',
                Email: 't@t.com',
                Nif: '123456789',
                Morada: 'Rua X',
                Permissoes: 3
            };

            await expect(userService.criarUtilizador(dados))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'CodigoPostal é obrigatório.' });
        });

        it('deve rejeitar com 400 quando Morada esta em falta', async () => {
            const dados = {
                NomeCompleto: 'Sr. Teste',
                NomeUtilizador: 'teste',
                Email: 't@t.com',
                Nif: '123456789',
                CodigoPostal: '1000-100',
                Permissoes: 3
            };

            await expect(userService.criarUtilizador(dados))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'Morada é obrigatória.' });
        });

        it('deve rejeitar com 400 quando NIF esta em falta', async () => {
            const dados = {
                NomeCompleto: 'Sr. Teste',
                NomeUtilizador: 'teste',
                Email: 't@t.com',
                CodigoPostal: '1000-100',
                Morada: 'Rua X',
                Permissoes: 3
            };

            await expect(userService.criarUtilizador(dados))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'NIF é obrigatório.' });
        });

        it('deve rejeitar com 400 quando Permissoes e um valor invalido', async () => {
            const dados = {
                NomeCompleto: 'Sr. Teste',
                NomeUtilizador: 'teste',
                Email: 't@t.com',
                Nif: '123456789',
                CodigoPostal: '1000-100',
                Morada: 'Rua X',
                Permissoes: 99
            };

            await expect(userService.criarUtilizador(dados))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'Nível de permissão inválido.' });
        });

        it('deve rejeitar com 400 quando Professor nao tem IBAN', async () => {
            const dados = {
                NomeCompleto: 'Prof',
                NomeUtilizador: 'prof',
                Email: 'p@p.com',
                Nif: '123456789',
                CodigoPostal: '1000-100',
                Morada: 'Rua Y',
                Permissoes: 2,
                PalavraPasse: 'secret'
            };

            await expect(userService.criarUtilizador(dados))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'IBAN é obrigatório para professores.' });
        });

        it('deve rejeitar com 400 quando PalavraPasse esta em falta', async () => {
            const dados = {
                NomeCompleto: 'Admin',
                NomeUtilizador: 'admin',
                Email: 'admin@a.com',
                Nif: '123456789',
                CodigoPostal: '1000-100',
                Morada: 'Rua Z',
                Permissoes: 3
            };

            await expect(userService.criarUtilizador(dados))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'PalavraPasse é obrigatória.' });
        });
    });

    describe('criarUtilizador - Criacao com sucesso', () => {
        it('deve criar Professor e chamar o repositorio com password hasheada', async () => {
            const dados = {
                NomeCompleto: 'Professor OK',
                NomeUtilizador: 'prof.ok',
                Email: 'ok@a.com',
                Nif: '123456789',
                CodigoPostal: '1000-100',
                Morada: 'Rua Central',
                Permissoes: 2,
                Iban: 'PT50000201231234567890154',
                PalavraPasse: '123456'
            };

            userRepository.create.mockResolvedValue({ id: 123, ...dados });

            const resultado = await userService.criarUtilizador(dados);

            expect(resultado.id).toBe(123);
            expect(userRepository.create).toHaveBeenCalled();

            const callData = userRepository.create.mock.calls[0][0];
            expect(callData.PalavraPasseHash).toBeDefined();
            expect(callData.PalavraPasseHash).not.toBe('123456');
        });

        it('deve criar Direcao sem campos extra obrigatorios', async () => {
            const dados = {
                NomeCompleto: 'Admin',
                NomeUtilizador: 'admin',
                Email: 'admin@a.com',
                Nif: '123456789',
                CodigoPostal: '1000-100',
                Morada: 'Rua da Direcao',
                Permissoes: 3,
                PalavraPasse: 'secret'
            };

            userRepository.create.mockResolvedValue({ id: 1, ...dados });

            const resultado = await userService.criarUtilizador(dados);
            expect(resultado.id).toBe(1);
        });

        it('deve traduzir erro de username duplicado para uma mensagem legivel', async () => {
            const dados = {
                NomeCompleto: 'Admin',
                NomeUtilizador: 'admin',
                Email: 'admin@a.com',
                Nif: '123456789',
                CodigoPostal: '1000-100',
                Morada: 'Rua da Direcao',
                Permissoes: 3,
                PalavraPasse: 'secret'
            };

            userRepository.create.mockRejectedValue({
                code: 'P2002',
                meta: { target: ['NomeUtilizador'] }
            });

            await expect(userService.criarUtilizador(dados))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'Ja existe um utilizador com esse nome de utilizador.' });
        });

        it('deve traduzir erro de email duplicado para uma mensagem legivel', async () => {
            const dados = {
                NomeCompleto: 'Admin',
                NomeUtilizador: 'admin',
                Email: 'admin@a.com',
                Nif: '123456789',
                CodigoPostal: '1000-100',
                Morada: 'Rua da Direcao',
                Permissoes: 3,
                PalavraPasse: 'secret'
            };

            userRepository.create.mockRejectedValue({
                code: 'P2002',
                meta: { target: ['Email'] }
            });

            await expect(userService.criarUtilizador(dados))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'Ja existe um utilizador com esse email.' });
        });
    });
});
