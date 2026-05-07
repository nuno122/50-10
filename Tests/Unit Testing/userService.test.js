const userService = require('../../backend/src/services/userService');
const userRepository = require('../../backend/src/repositories/userRepository');
const PERMISSOES = require('../../backend/src/config/permissions');

jest.mock('../../backend/src/repositories/userRepository');

describe('User Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('criarUtilizador', () => {
        it('rejects when NomeCompleto is missing', async () => {
            await expect(userService.criarUtilizador({ Email: 'teste@teste.com', Permissoes: PERMISSOES.DIRECAO }))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'NomeCompleto e obrigatorio.' });
        });

        it('rejects when permission is not managed in the portal', async () => {
            const dados = {
                NomeCompleto: 'Perfil Invalido',
                NomeUtilizador: 'perfil.invalido',
                Email: 'perfil@invalido.pt',
                Nif: '123456789',
                CodigoPostal: '1000-100',
                Morada: 'Rua X',
                Permissoes: 99,
                PalavraPasse: 'secret'
            };

            await expect(userService.criarUtilizador(dados))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'So e permitido criar Encarregados, Professores e membros da Direcao.' });
        });

        it('rejects when professor does not define styles', async () => {
            const dados = {
                NomeCompleto: 'Prof Sem Estilo',
                NomeUtilizador: 'prof.sem.estilo',
                Email: 'prof@estilo.pt',
                Nif: '123456789',
                CodigoPostal: '1000-100',
                Morada: 'Rua Y',
                Permissoes: PERMISSOES.PROFESSOR,
                Iban: 'PT50000201231234567890154',
                PalavraPasse: 'secret',
                IdsEstiloDanca: []
            };

            await expect(userService.criarUtilizador(dados))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'Define pelo menos um estilo para o professor.' });
        });

        it('creates professor with hashed password and style ids', async () => {
            const dados = {
                NomeCompleto: 'Professor OK',
                NomeUtilizador: 'prof.ok',
                Email: 'ok@a.com',
                Nif: '123456789',
                CodigoPostal: '1000-100',
                Morada: 'Rua Central',
                Permissoes: PERMISSOES.PROFESSOR,
                Iban: 'PT50000201231234567890154',
                PalavraPasse: '123456',
                IdsEstiloDanca: ['estilo-1', 'estilo-2']
            };

            userRepository.create.mockResolvedValue({ IdUtilizador: 'u-1', ...dados });

            const resultado = await userService.criarUtilizador(dados);

            expect(resultado.IdUtilizador).toBe('u-1');
            expect(userRepository.create).toHaveBeenCalledTimes(1);

            const payload = userRepository.create.mock.calls[0][0];
            expect(payload.PalavraPasseHash).toBeDefined();
            expect(payload.PalavraPasseHash).not.toBe('123456');
            expect(payload.IdsEstiloDanca).toEqual(['estilo-1', 'estilo-2']);
        });

        it('creates Direcao without professor fields', async () => {
            const dados = {
                NomeCompleto: 'Admin',
                NomeUtilizador: 'admin',
                Email: 'admin@a.com',
                Nif: '123456789',
                CodigoPostal: '1000-100',
                Morada: 'Rua da Direcao',
                Permissoes: PERMISSOES.DIRECAO,
                PalavraPasse: 'secret'
            };

            userRepository.create.mockResolvedValue({ IdUtilizador: 'dir-1', ...dados });

            const resultado = await userService.criarUtilizador(dados);
            expect(resultado.IdUtilizador).toBe('dir-1');
        });

        it('translates duplicate username errors', async () => {
            const dados = {
                NomeCompleto: 'Admin',
                NomeUtilizador: 'admin',
                Email: 'admin@a.com',
                Nif: '123456789',
                CodigoPostal: '1000-100',
                Morada: 'Rua da Direcao',
                Permissoes: PERMISSOES.DIRECAO,
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
    });
});
