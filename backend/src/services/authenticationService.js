const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');

const JWT_SECRET = process.env.JWT_SECRET || 'ChaveSuperSecretaDaEntArtes_2026';

const criarErro = (mensagem, statusCode) => {
    const erro = new Error(mensagem);
    erro.statusCode = statusCode;
    return erro;
};

const login = async (email, password) => {
    if (!email || !password) {
        throw criarErro('Por favor, introduza o email e a palavra-passe.', 400);
    }

    const utilizador = await userRepository.findByEmail(email);

    if (!utilizador) {
        throw criarErro('Credenciais invalidas.', 401);
    }

    const passwordValida = utilizador.PalavraPasseHash === password;

    if (!passwordValida) {
        throw criarErro('Credenciais invalidas.', 401);
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
