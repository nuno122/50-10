const jwt = require('jsonwebtoken');
const PERMISSOES = require('./config/permissoes');

const JWT_SECRET = process.env.JWT_SECRET || "ChaveSuperSecretaDaEntArtes_2026";

const verificarToken = (req, res, next) => {
    const cabecalhoAuth = req.headers.authorization;

    if (!cabecalhoAuth || !cabecalhoAuth.startsWith('Bearer ')) {
        return res.status(401).json({ erro: "Acesso negado! Inicie sessão para continuar." });
    }

    const token = cabecalhoAuth.split(' ')[1];

    try {
        const utilizadorDecodificado = jwt.verify(token, JWT_SECRET);
        req.utilizador = utilizadorDecodificado;
        next();
    } catch (erro) {
        return res.status(401).json({ erro: "Sessão expirada ou inválida. Por favor, faça login novamente." });
    }
};

// Aceita uma ou mais permissões
// Ex: verificarPermissao(PERMISSOES.DIRECAO)
// Ex: verificarPermissao(PERMISSOES.PROFESSOR, PERMISSOES.DIRECAO)
const verificarPermissao = (...permissoesPermitidas) => {
    return (req, res, next) => {
        if (!req.utilizador) {
            return res.status(401).json({ erro: "Não autenticado." });
        }

        if (!permissoesPermitidas.includes(req.utilizador.Permissoes)) {
            return res.status(403).json({ erro: "Acesso negado. Permissões insuficientes." });
        }

        next();
    };
};

module.exports = { verificarToken, verificarPermissao };