const authenticationService = require('../../backend/src/services/authenticationService');
const userRepository = require('../../backend/src/repositories/userRepository');
const jwt = require('jsonwebtoken');

jest.mock('../../backend/src/repositories/userRepository');
jest.mock('jsonwebtoken');

describe('Authentication Service', () => {
    beforeEach(() => {
        // Arrange (Comum)
        jest.clearAllMocks();
    });

    describe('Login', () => {
        it('deve emitir erro 400 quando o email ou senha não são providenciados', async () => {
            // Arrange
            const emailInvalido = null;
            const passwordValida = '123456';

            // Act & Assert
            await expect(authenticationService.login(emailInvalido, passwordValida))
                .rejects
                .toThrow('Por favor, introduza o email e a palavra-passe.');
        });

        it('deve emitir erro 401 quando o utilizador não é encontrado na base de dados', async () => {
            // Arrange
            const emailInexistente = 'naoexiste@teste.com';
            userRepository.findByEmail.mockResolvedValue(null);

            // Act & Assert
            await expect(authenticationService.login(emailInexistente, 'senha123'))
                .rejects
                .toThrow('Credenciais invalidas.');
        });

        it('deve emitir erro 401 quando a palavra-passe introduzida está errada', async () => {
            // Arrange
            const emailValido = 'aluno@teste.com';
            userRepository.findByEmail.mockResolvedValue({
                IdUtilizador: 1,
                Email: emailValido,
                PalavraPasseHash: 'senhaCerta123'
            });

            // Act & Assert
            await expect(authenticationService.login(emailValido, 'senhaErrada'))
                .rejects
                .toThrow('Credenciais invalidas.');
        });

        it('deve processar o login e devolver um token de 8h quando as credenciais estiverem corretas', async () => {
            // Arrange
            const emailValido = 'aluno@teste.com';
            const passwordCerta = 'senhaCerta123';
            
            userRepository.findByEmail.mockResolvedValue({
                IdUtilizador: 99,
                Email: emailValido,
                NomeCompleto: 'Aluno Teste',
                PalavraPasseHash: passwordCerta,
                Permissoes: 'User'
            });

            const fakeToken = 'ey.fake-token-gerado-com-sucesso';
            jwt.sign.mockReturnValue(fakeToken);

            // Act
            const resultado = await authenticationService.login(emailValido, passwordCerta);

            // Assert
            expect(resultado.mensagem).toBe('Login efetuado com sucesso!');
            expect(resultado.token).toBe(fakeToken);
            expect(resultado.utilizador.Id).toBe(99);
            
            // Garantir que a assinatura leva as permissões e o Id
            expect(jwt.sign).toHaveBeenCalledWith(
                { IdUtilizador: 99, Permissoes: 'User' },
                expect.any(String),
                { expiresIn: '8h' }
            );
        });
    });
});
