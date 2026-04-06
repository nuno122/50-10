const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();


const criarMarcacao = async (req, res) => {
    try {
        
        const { IdUtilizador, IdAula } = req.body;


        const aula = await prisma.aula.findUnique({
            where: { IdAula: IdAula },
            include: { Marcacao: true } 
        });

        if (!aula) {
            return res.status(404).json({ erro: "Aula não encontrada." });
        }


        if (aula.Marcacao.length >= aula.CapacidadeMaxima) {
            return res.status(400).json({ 
                erro: "Turma cheia! Já não há vagas para esta aula." 
            });
        }

        
        const jaInscrito = aula.Marcacao.find(m => m.IdUtilizador === IdUtilizador);
        if (jaInscrito) {
            return res.status(400).json({ 
                erro: "Já tens uma inscrição ativa para esta aula!" 
            });
        }

        const novaMarcacao = await prisma.marcacao.create({
            data: {
                IdUtilizador,
                IdAula,
                DataMarcacao: new Date(), 
                Estado: "Confirmada" 
        });

        res.status(201).json({ mensagem: "Lugar reservado com sucesso!", marcacao: novaMarcacao });

    } catch (erro) {
        console.error("Erro ao fazer marcação:", erro);
        res.status(500).json({ erro: "Não foi possível realizar a marcação." });
    }
};


const getMarcacoes = async (req, res) => {
    try {
        const marcacoes = await prisma.marcacao.findMany({
            include: {
                Utilizador: true, 
                Aula: true       
            }
        });
        res.json(marcacoes);
    } catch (erro) {
        console.error("Erro ao carregar marcações:", erro);
        res.status(500).json({ erro: "Não foi possível carregar as marcações." });
    }
};

module.exports = {
    criarMarcacao,
    getMarcacoes
};