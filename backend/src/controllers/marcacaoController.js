const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const criarMarcacao = async (req, res) => {
    try {
        const { IdAluno, IdAula } = req.body; 

     
        if (!IdAluno || !IdAula) {
            return res.status(400).json({ 
                erro: "Dados incompletos! É obrigatório enviar o IdAluno e o IdAula." 
            });
        }

     
        const alunoExiste = await prisma.aluno.findUnique({
            where: { IdUtilizador: IdAluno }
        });
        if (!alunoExiste) {
            return res.status(404).json({ erro: "Aluno não encontrado no sistema." });
        }

        const aula = await prisma.aula.findUnique({
            where: { IdAula: IdAula },
            include: { Marcacao: true } 
        });
        if (!aula) {
            return res.status(404).json({ erro: "Aula não encontrada no sistema." });
        }

    
        const dataDaAula = new Date(aula.Data);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        if (dataDaAula < hoje) {
            return res.status(400).json({ 
                erro: "Não é possível fazer marcações para aulas que já começaram ou já passaram." 
            });
        }

     
        if (aula.Marcacao.length >= aula.CapacidadeMaxima) {
            return res.status(400).json({ 
                erro: "Turma cheia! Já não há vagas para esta aula." 
            });
        }
        
       
        const jaInscrito = await prisma.marcacao.findFirst({
            where: {
                Aluno: { IdUtilizador: IdAluno }, 
                Aula: { IdAula: IdAula }     
            }
        });

        if (jaInscrito) {
            return res.status(400).json({ 
                erro: "Já tens uma inscrição ativa para esta aula!" 
            });
        }

      
        const novaMarcacao = await prisma.marcacao.create({
            data: {
                Aluno: { connect: { IdUtilizador: IdAluno } }, 
                Aula: { connect: { IdAula: IdAula } },    
                EstaAtivo: true,
                PresencaConfirmada: false
            }
        });

        res.status(201).json({ mensagem: "Lugar reservado com sucesso!", marcacao: novaMarcacao });

    } catch (erro) {
        console.error("Erro ao fazer marcação:", erro);
        res.status(500).json({ erro: "Ocorreu um erro interno ao processar a marcação." });
    }
};

const getMarcacoes = async (req, res) => {
    try {
        const marcacoes = await prisma.marcacao.findMany({
            include: { Aluno: true, Aula: true }
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