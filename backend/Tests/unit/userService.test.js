const userService = require('../../src/services/userService');
const userRepository = require('../../src/repositories/userRepository');
const PERMISSOES = require('../../src/config/permissions');

jest.mock('../../src/repositories/userRepository');

describe('User Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('criarUtilizador', () => {
        it('deve rejeitar quando o NomeCompleto não é fornecido', async () => {
            // Act & Assert
            await expect(userService.criarUtilizador({ Email: 'teste@teste.com', Permissoes: PERMISSOES.DIRECAO }))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'NomeCompleto e obrigatorio.' });

            expect(userRepository.create).not.toHaveBeenCalled();
        });

        it('deve rejeitar quando a permissão não é gerida no portal', async () => {
            // Arrange
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

            // Act & Assert
            await expect(userService.criarUtilizador(dados))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'So e permitido criar Encarregados, Professores e membros da Direcao.' });

            expect(userRepository.create).not.toHaveBeenCalled();
        });

        it('deve rejeitar quando o professor não define estilos de dança', async () => {
            // Arrange
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

            // Act & Assert
            await expect(userService.criarUtilizador(dados))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'Define pelo menos um estilo para o professor.' });

            expect(userRepository.create).not.toHaveBeenCalled();
        });

        it('deve criar o professor com password encriptada e IDs de estilos', async () => {
            // Arrange
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

            // Act
            const resultado = await userService.criarUtilizador(dados);

            // Assert
            expect(resultado.IdUtilizador).toBe('u-1');
            expect(userRepository.create).toHaveBeenCalledTimes(1);

            const payload = userRepository.create.mock.calls[0][0];
            expect(payload.PalavraPasseHash).toBeDefined();
            expect(payload.PalavraPasseHash).not.toBe('123456');
            expect(payload.IdsEstiloDanca).toEqual(['estilo-1', 'estilo-2']);
        });

        it('deve criar utilizador da Direção sem campos de professor', async () => {
            // Arrange
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

            // Act
            const resultado = await userService.criarUtilizador(dados);

            // Assert
            expect(resultado.IdUtilizador).toBe('dir-1');
        });

        it('deve traduzir erros de nome de utilizador duplicado do Prisma', async () => {
            // Arrange
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

            // Act & Assert
            await expect(userService.criarUtilizador(dados))
                .rejects
                .toMatchObject({ statusCode: 400, message: 'Ja existe um utilizador com esse nome de utilizador.' });
        });
    });
});
