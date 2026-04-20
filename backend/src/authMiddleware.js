const jwt = require('jsonwebtoken');

// Tem de ser a MESMA chave secreta que usaste no authController
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

const verificarPermissao = (permissaoNecessaria) => {
    return (req, res, next) => {
        if (!req.utilizador || req.utilizador.permissao < permissaoNecessaria) {
            return res.status(403).json({ 
                erro: "Acesso negado. Permissões insuficientes." 
            });
        }
        next();
    };
};

module.exports = {
    verificarToken,
    verificarPermissao
};
