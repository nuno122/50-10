const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const userRepository = require('../repositories/userRepository');

const JWT_SECRET = process.env.JWT_SECRET || 'ChaveSuperSecretaDaEntArtes_2026';

const criarErro = (mensagem, statusCode) => {
    const erro = new Error(mensagem);
    erro.statusCode = statusCode;
    return erro;
};

const hashPassword = (password) => (
    crypto.createHash('sha256').update(String(password || '')).digest('hex')
);

const login = async (email, password) => {
    if (!email || !password) {
        throw criarErro('Por favor, introduza o email e a palavra-passe.', 400);
    }

    const utilizador = await userRepository.findByEmail(email);

    if (!utilizador) {
        throw criarErro('Credenciais invalidas.', 401);
    }

    const passwordHash = hashPassword(password);
    const storedPassword = String(utilizador.PalavraPasseHash || '');
    const passwordValida = storedPassword === passwordHash || storedPassword === password;

    if (!passwordValida) {
        throw criarErro('Credenciais invalidas.', 401);
    }

    // Migra automaticamente utilizadores antigos com password em plaintext.
    if (storedPassword === password && storedPassword !== passwordHash && utilizador.IdUtilizador) {
        await userRepository.updatePasswordHash(utilizador.IdUtilizador, passwordHash);
    }

    const token = jwt.sign(
        {
            IdUtilizador: utilizador.IdUtilizador,
            Permissoes: utilizador.Permissoes
        },
        JWT_SECRET,
        { expiresIn: '8h' }
    );

    return {
        mensagem: 'Login efetuado com sucesso!',
        token,
        utilizador: {
            Id: utilizador.IdUtilizador,
            Nome: utilizador.NomeCompleto,
            Permissoes: utilizador.Permissoes
        }
    };
};

module.exports = { login };
