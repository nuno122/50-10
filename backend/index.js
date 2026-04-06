const express = require('express');
const cors = require('cors');

// Importar as rotas
const inventarioRoutes = require('./src/routes/inventarioRoutes');
const utilizadorRoutes = require('./src/routes/utilizadorRoutes'); 
const aulaRoutes = require('./src/routes/aulaRoutes');
const marcacaoRoutes = require('./src/routes/marcacaoRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/status', (req, res) => {
    res.json({ sucesso: true, mensagem: "O servidor da Ent'Artes está online! 🚀" });
});

// Ligar as rotas aos URLs
app.use('/api/inventario', inventarioRoutes);
app.use('/api/utilizadores', utilizadorRoutes); 
app.use('/api/aulas', aulaRoutes);
app.use('/api/marcacoes', marcacaoRoutes);

app.listen(PORT, () => {
    console.log(`Servidor a correr em http://localhost:${PORT}`);
});