const express = require('express');
const cors = require('cors');
const path = require('path');

// Importar as rotas
const inventoryRoutes = require('./src/routes/inventoryRoutes');
const userRoutes = require('./src/routes/userRoutes'); 
const classRoutes = require('./src/routes/classRoutes');
const bookingRoutes = require('./src/routes/bookingRoutes');
const authenticationRoutes = require('./src/routes/authenticationRoutes');
const rentalRoutes = require('./src/routes/rentalRoutes');
const availabilityRoutes = require('./src/routes/availabilityRoutes');
const masterRoutes = require('./src/routes/masterRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/images', express.static(path.join(__dirname, '..', 'frontend', 'Images')));

app.get('/api/status', (req, res) => {
    res.json({ sucesso: true, mensagem: "O servidor da Ent'Artes está online! 🚀" });
});

// Ligar as rotas aos URLs
app.use('/api/inventario', inventoryRoutes);
app.use('/api/utilizadores', userRoutes); 
app.use('/api/aulas', classRoutes);
app.use('/api/pagamentos', require('./src/routes/paymentRoutes'));

app.use('/api/marcacoes', bookingRoutes);
app.use('/api/autenticacao', authenticationRoutes);
app.use('/api/alugueres', rentalRoutes);
app.use('/api/disponibilidades', availabilityRoutes);

app.use('/api/master', masterRoutes);

app.listen(PORT, () => {
    console.log(`Servidor a correr em http://localhost:${PORT}`);
});
