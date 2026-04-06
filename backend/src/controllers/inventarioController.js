const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getInventario = async (req, res) => {
    try {
        const artigos = await prisma.artigo.findMany(); 
        res.json(artigos);
    } catch (erro) {
        console.error("Erro ao carregar o inventário:", erro);
        res.status(500).json({ erro: "Não foi possível carregar os artigos." });
    }
};

const criarArtigo = async (req, res) => {
    try {

        const { Nome, CustoPorDia } = req.body; 

        if (!Nome || CustoPorDia === undefined) {
            return res.status(400).json({ erro: "O Nome e o CustoPorDia são obrigatórios." });
        }

        const novoArtigo = await prisma.artigo.create({
            data: {
                Nome: Nome,
                CustoPorDia: CustoPorDia
            }
        });

        res.status(201).json(novoArtigo);
    } catch (erro) {
        console.error("Erro ao criar artigo:", erro);
        res.status(500).json({ erro: "Não foi possível gravar o artigo." });
    }
};

const editarArtigo = async (req, res) => {
    try {
        const { id } = req.params; 
        const { Nome, CustoPorDia, EstadoArtigo } = req.body;

        const artigoAtualizado = await prisma.artigo.update({
            where: { IdArtigo: id },
            data: { Nome, CustoPorDia, EstadoArtigo }
        });

        res.json(artigoAtualizado);
    } catch (erro) {
        console.error("Erro ao editar artigo:", erro);
        res.status(500).json({ erro: "Não foi possível atualizar o artigo." });
    }
};

const removerArtigo = async (req, res) => {
    try {
        const { id } = req.params; 

        await prisma.artigo.delete({
            where: { IdArtigo: id }
        });

        res.json({ mensagem: "Artigo removido com sucesso do catálogo!" });
    } catch (erro) {
        console.error("Erro ao remover artigo:", erro);
        res.status(500).json({ erro: "Não foi possível remover o artigo." });
    }
};

module.exports = {
    getInventario,
    criarArtigo,
    editarArtigo, 
    removerArtigo
};
