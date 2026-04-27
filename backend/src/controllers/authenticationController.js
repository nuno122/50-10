const userService = require('../services/userService');

const login = async (req, res) => {
    try {
        const { Email, PalavraPasseHash } = req.body;
        const resultado = await userService.autenticarUtilizador(Email, PalavraPasseHash);
        res.json(resultado);
    } catch (erro) {
        console.error('Erro no login:', erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Ocorreu um erro interno ao tentar fazer login.'
        });
    }
};

module.exports = { login };