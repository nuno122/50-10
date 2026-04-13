const authenticationService = require('../services/authenticationService');

const login = async (req, res) => {
    try {
        const { Email, Password } = req.body;
        const resultado = await authenticationService.login(Email, Password);
        res.json(resultado);
    } catch (erro) {
        console.error('Erro no login:', erro);
        res.status(erro.statusCode || 500).json({
            erro: erro.message || 'Ocorreu um erro interno ao tentar fazer login.'
        });
    }
};

module.exports = { login };
