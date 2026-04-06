const marcacaoRepo = require('../repositories/marcacaoRepository');

const criarMarcacao = async (req, res) => {
    try {
        const { IdAluno, IdAula } = req.body;

        // 1. Validação de Input
        if (!IdAluno || !IdAula) {
            return res.status(400).json({ erro: "IdAluno e IdAula são obrigatórios." });
        }

        // 2. Verificar se Aluno existe
        const aluno = await marcacaoRepo.findAlunoById(IdAluno);
        if (!aluno) return res.status(404).json({ erro: "Aluno não encontrado." });

        // 3. Verificar se Aula existe e obter dados
        const aula = await marcacaoRepo.findAulaWithMarcacoes(IdAula);
        if (!aula) return res.status(404).json({ erro: "Aula não encontrada." });

        // 4. Regra de Negócio: Data da Aula
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        if (new Date(aula.Data) < hoje) {
            return res.status(400).json({ erro: "Não podes marcar aulas passadas." });
        }

        // 5. Regra de Negócio: Capacidade
        if (aula.Marcacao.length >= aula.CapacidadeMaxima) {
            return res.status(400).json({ erro: "Aula lotada!" });
        }

        // 6. Regra de Negócio: Duplicação
        const jaInscrito = await marcacaoRepo.findExisting(IdAluno, IdAula);
        if (jaInscrito) {
            return res.status(400).json({ erro: "Já estás inscrito nesta aula!" });
        }

        // 7. Sucesso: Criar
        const novaMarcacao = await marcacaoRepo.create(IdAluno, IdAula);
        res.status(201).json({ mensagem: "Lugar reservado!", marcacao: novaMarcacao });

    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: "Erro ao processar a marcação." });
    }
};

const getMarcacoes = async (req, res) => {
    try {
        const marcacoes = await marcacaoRepo.findAll();
        res.json(marcacoes);
    } catch (erro) {
        res.status(500).json({ erro: "Erro ao carregar marcações." });
    }
};

module.exports = { criarMarcacao, getMarcacoes };