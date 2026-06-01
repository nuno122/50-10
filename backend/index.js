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
const privateLessonRequestRoutes = require('./src/routes/privateLessonRequestRoutes');
const eventRoutes = require('./src/routes/eventRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const notificationService = require('./src/services/notificationService');

const app = express();
const PORT = process.env.PORT || 3000;
const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error('Origem nao permitida por CORS.'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false
}));
app.options(/.*/, cors());
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
app.use('/api/pedidos-aula-privada', privateLessonRequestRoutes);
app.use('/api/autenticacao', authenticationRoutes);
app.use('/api/alugueres', rentalRoutes);
app.use('/api/disponibilidades', availabilityRoutes);
app.use('/api/eventos', eventRoutes);
app.use('/api/notificacoes', notificationRoutes);

app.use('/api/master', masterRoutes);

const startServer = async () => {
    await notificationService.ensureStorage();

    app.listen(PORT, () => {
        console.log(`Servidor a correr na porta ${PORT}`);
    });
};

startServer().catch((error) => {
    console.error('Nao foi possivel iniciar o servidor.', error);
    process.exit(1);
});
