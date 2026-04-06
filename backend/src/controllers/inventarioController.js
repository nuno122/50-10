const inventarioRepo = require('../repositories/inventarioRepository');

const getInventario = async (req, res) => {
    try {
        const artigos = await inventarioRepo.findAll(); 
        res.json(artigos);
    } catch (erro) {
        res.status(500).json({ erro: "Não foi possível carregar os artigos." });
    }
};

const criarArtigo = async (req, res) => {
    try {
        const { Nome, CustoPorDia } = req.body; 

        // Validação básica continua no Controller (Responsabilidade de input)
        if (!Nome || CustoPorDia === undefined) {
            return res.status(400).json({ erro: "O Nome e o CustoPorDia são obrigatórios." });
        }

        const novoArtigo = await inventarioRepo.create({ Nome, CustoPorDia });
        res.status(201).json(novoArtigo);
    } catch (erro) {
        res.status(500).json({ erro: "Não foi possível gravar o artigo." });
    }
};

const editarArtigo = async (req, res) => {
    try {
        const { id } = req.params; 
        const artigoAtualizado = await inventarioRepo.update(id, req.body);
        res.json(artigoAtualizado);
    } catch (erro) {
        res.status(500).json({ erro: "Não foi possível atualizar o artigo." });
    }
};

const removerArtigo = async (req, res) => {
    try {
        const { id } = req.params; 
        await inventarioRepo.delete(id);
        res.json({ mensagem: "Artigo removido com sucesso do catálogo!" });
    } catch (erro) {
        res.status(500).json({ erro: "Não foi possível remover o artigo." });
    }
};

module.exports = {
    getInventario,
    criarArtigo,
    editarArtigo, 
    removerArtigo
};