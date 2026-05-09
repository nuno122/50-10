const authenticationService = require('../services/authenticationService');
const { handleControllerError } = require('./controllerError');

const login = async (req, res) => {
    try {
        const { Email, Password } = req.body;
        const resultado = await authenticationService.login(Email, Password);
        res.json(resultado);
    } catch (erro) {
        handleControllerError(res, erro, 'Ocorreu um erro interno ao tentar fazer login.', 'authenticationController.login');
    }
};

module.exports = { login };
