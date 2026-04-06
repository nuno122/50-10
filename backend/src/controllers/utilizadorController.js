const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();


const getUtilizadores = async (req, res) => {
    try {
        const utilizadores = await prisma.utilizador.findMany();
        res.json(utilizadores);
    } catch (erro) {
        console.error("Erro ao procurar utilizadores:", erro);
        res.status(500).json({ erro: "Não foi possível carregar os utilizadores." });
    }
};


const criarUtilizador = async (req, res) => {
    try {
        // Adicionámos a Morada e o CodigoPostal à lista de dados recebidos
        const { NomeCompleto, NomeUtilizador, Email, PalavraPasseHash, Permissoes, Nif, Morada, CodigoPostal } = req.body;

        const novoUtilizador = await prisma.utilizador.create({
            data: {
                NomeCompleto,
                NomeUtilizador,
                Email,
                PalavraPasseHash, 
                Permissoes,       
                Nif,
                EstaAtivo: true,
                Morada, // Campo obrigatório
                // Ligação obrigatória à tabela de Códigos Postais
                CodigoPostal_Utilizador_CodigoPostalToCodigoPostal: {
                    connect: { CodigoPostal: CodigoPostal }
                }
            }
        });

        res.status(201).json(novoUtilizador);
    } catch (erro) {
        console.error("Erro ao criar utilizador:", erro);
        res.status(500).json({ erro: "Não foi possível criar o utilizador." });
    }
};


// Função de Login
const login = async (req, res) => {
    try {
        const { Email, PalavraPasseHash } = req.body;

        const utilizador = await prisma.utilizador.findUnique({
            where: { Email: Email }
        });

        if (!utilizador) {
            return res.status(401).json({ erro: "Utilizador não encontrado." });
        }

        if (utilizador.PalavraPasseHash !== PalavraPasseHash) {
            return res.status(401).json({ erro: "Palavra-passe incorreta." });
        }

        const { PalavraPasseHash: passwordRemovida, ...dadosSeguros } = utilizador;

        res.json({ 
            mensagem: "Login efetuado com sucesso!", 
            utilizador: dadosSeguros 
        });

    } catch (erro) {
        console.error("Erro no login:", erro);
        res.status(500).json({ erro: "Não foi possível processar o login." });
    }
};

module.exports = {
    getUtilizadores,
    criarUtilizador,
    login
};