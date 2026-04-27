const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const authenticationService = require('../../backend/src/services/authenticationService');
const userRepository = require('../../backend/src/repositories/userRepository');

jest.mock('../../backend/src/repositories/userRepository');
jest.mock('jsonwebtoken');

const hashPassword = (value) => crypto.createHash('sha256').update(value).digest('hex');

describe('Authentication Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Login', () => {
        it('deve emitir erro 400 quando o email ou senha nao sao providenciados', async () => {
            await expect(authenticationService.login(null, '123456'))
                .rejects
                .toThrow('Por favor, introduza o email e a palavra-passe.');
        });

        it('deve emitir erro 401 quando o utilizador nao e encontrado na base de dados', async () => {
            userRepository.findByEmail.mockResolvedValue(null);

            await expect(authenticationService.login('naoexiste@teste.com', 'senha123'))
                .rejects
                .toThrow('Credenciais invalidas.');
        });

        it('deve emitir erro 401 quando a palavra-passe introduzida esta errada', async () => {
            userRepository.findByEmail.mockResolvedValue({
                IdUtilizador: 1,
                Email: 'aluno@teste.com',
                PalavraPasseHash: hashPassword('senhaCerta123')
            });

            await expect(authenticationService.login('aluno@teste.com', 'senhaErrada'))
                .rejects
                .toThrow('Credenciais invalidas.');
        });

        it('deve processar o login e devolver um token de 8h quando as credenciais estiverem corretas', async () => {
            const passwordCerta = 'senhaCerta123';

            userRepository.findByEmail.mockResolvedValue({
                IdUtilizador: 99,
                Email: 'aluno@teste.com',
                NomeCompleto: 'Aluno Teste',
                PalavraPasseHash: hashPassword(passwordCerta),
                Permissoes: 'User'
            });

            const fakeToken = 'ey.fake-token-gerado-com-sucesso';
            jwt.sign.mockReturnValue(fakeToken);

            const resultado = await authenticationService.login('aluno@teste.com', passwordCerta);

            expect(resultado.mensagem).toBe('Login efetuado com sucesso!');
            expect(resultado.token).toBe(fakeToken);
            expect(resultado.utilizador.Id).toBe(99);
            expect(jwt.sign).toHaveBeenCalledWith(
                { IdUtilizador: 99, Permissoes: 'User' },
                expect.any(String),
                { expiresIn: '8h' }
            );
        });

        it('deve migrar password antiga em plaintext para hash depois de login valido', async () => {
            const passwordCerta = 'senhaLegacy123';
            const expectedHash = hashPassword(passwordCerta);

            userRepository.findByEmail.mockResolvedValue({
                IdUtilizador: 7,
                Email: 'legacy@teste.com',
                NomeCompleto: 'Utilizador Legacy',
                PalavraPasseHash: passwordCerta,
                Permissoes: 'User'
            });

            jwt.sign.mockReturnValue('ey.fake-token-legacy');

            const resultado = await authenticationService.login('legacy@teste.com', passwordCerta);

            expect(resultado.token).toBe('ey.fake-token-legacy');
            expect(userRepository.updatePasswordHash).toHaveBeenCalledWith(7, expectedHash);
        });
    });
});
