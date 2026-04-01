const express = require('express')
const app = express()

app.use(express.json())

// rota de teste
app.get('/', (req, res) => {
  res.send('API a funcionar 🚀')
})

app.listen(3000, () => {
  console.log('Servidor a correr em http://localhost:3000')
})