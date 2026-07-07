const express = require('express')
const dotenv = require('dotenv')
const cors = require('cors')
const connectDB = require('./config/db')

dotenv.config()

connectDB()

const app = express()

app.use(cors({
  origin: ['http://localhost:5173', 'https://localhost:5173'],
  credentials: true
}))
app.use(express.json())

app.use('/api/auth', require('./routes/authRoutes'))

app.get('/', (req, res) => {
  res.send('API Running')
})

const PORT = process.env.PORT || 5600

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})