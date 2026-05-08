const jwt = require('jsonwebtoken');
const PERMISSOES = require('./config/permissions');
const userRepository = require('./repositories/userRepository');

const JWT_SECRET = process.env.JWT_SECRET || "ChaveSuperSecretaDaEntArtes_2026";

const responderTokenInvalido = (res) => (
    res.status(401).json({ erro: "Sessao expirada ou invalida. Por favor, faca login novamente." })
);

const verificarToken = async (req, res, next) => {
    const cabecalhoAuth = req.headers.authorization;

    if (!cabecalhoAuth || !cabecalhoAuth.startsWith('Bearer ')) {
        return res.status(401).json({ erro: "Acesso negado! Inicie sessao para continuar." });
    }

    const token = cabecalhoAuth.split(' ')[1];

    try {
        const utilizadorDecodificado = jwt.verify(token, JWT_SECRET);
        const idUtilizador = utilizadorDecodificado.IdUtilizador || utilizadorDecodificado.id;
        const permissaoDoToken = utilizadorDecodificado.Permissoes;

        if (!idUtilizador) {
            return responderTokenInvalido(res);
        }

        const utilizadorAtual = await userRepository.findAuthById(idUtilizador);

        if (!utilizadorAtual || utilizadorAtual.EstaAtivo === false) {
            return responderTokenInvalido(res);
        }

        if (
            permissaoDoToken !== undefined
            && permissaoDoToken !== null
            && utilizadorAtual.Permissoes !== permissaoDoToken
        ) {
            return responderTokenInvalido(res);
        }

        req.utilizador = {
            ...utilizadorDecodificado,
            IdUtilizador: utilizadorAtual.IdUtilizador,
            Email: utilizadorAtual.Email,
            NomeCompleto: utilizadorAtual.NomeCompleto,
            Permissoes: utilizadorAtual.Permissoes,
            EstaAtivo: utilizadorAtual.EstaAtivo
        };
        next();
    } catch (erro) {
        return responderTokenInvalido(res);
    }
};

// Aceita uma ou mais permissoes
// Ex: verificarPermissao(PERMISSOES.DIRECAO)
// Ex: verificarPermissao(PERMISSOES.PROFESSOR, PERMISSOES.DIRECAO)
const verificarPermissao = (...permissoesPermitidas) => {
    return (req, res, next) => {
        if (!req.utilizador) {
            return res.status(401).json({ erro: "Nao autenticado." });
        }

        if (!permissoesPermitidas.includes(req.utilizador.Permissoes)) {
            return res.status(403).json({ erro: "Acesso negado. Permissoes insuficientes." });
        }

        next();
    };
};

module.exports = { verificarToken, verificarPermissao };
