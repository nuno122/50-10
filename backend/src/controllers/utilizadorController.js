const utilizadorRepo = require('../repositories/utilizadorRepository');

const getUtilizadores = async (req, res) => {
    try {
        const utilizadores = await utilizadorRepo.findAll();
        res.json(utilizadores);
    } catch (erro) {
        res.status(500).json({ erro: "Erro ao carregar utilizadores." });
    }
};

const criarUtilizador = async (req, res) => {
    try {
        const novoUtilizador = await utilizadorRepo.create(req.body);
        res.status(201).json(novoUtilizador);
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: "Erro ao criar utilizador. Verifica se o Código Postal existe." });
    }
};

const login = async (req, res) => {
    try {
        const { Email, PalavraPasseHash } = req.body;

        // 1. Pedir ao Repo para procurar o utilizador
        const utilizador = await utilizadorRepo.findByEmail(Email);

        // 2. Validações de segurança (Responsabilidade do Controller)
        if (!utilizador) {
            return res.status(401).json({ erro: "Utilizador não encontrado." });
        }

        if (utilizador.PalavraPasseHash !== PalavraPasseHash) {
            return res.status(401).json({ erro: "Palavra-passe incorreta." });
        }

        // 3. Limpar dados sensíveis antes de enviar para o Frontend
        const { PalavraPasseHash: _, ...dadosSeguros } = utilizador;

        res.json({ 
            mensagem: "Login efetuado com sucesso!", 
            utilizador: dadosSeguros 
        });

    } catch (erro) {
        res.status(500).json({ erro: "Erro no processo de login." });
    }
};

module.exports = { getUtilizadores, criarUtilizador, login };