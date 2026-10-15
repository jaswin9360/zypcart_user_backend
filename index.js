const express = require('express')
const dotenv = require('dotenv')
const cors = require('cors')
const connectDB = require('./config/db')
const dns = require('dns')
dns.setServers(['1.1.1.1','8.8.8.8'])

dotenv.config()

connectDB()

const app = express()

const allowedOrigins = [
  'https://zypcart.wuaze.com',
  'https://localhost:5173'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests without an Origin header, such as server-to-server calls
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json())

app.use('/api/auth', require('./routes/authRoutes'))

app.get('/', (req, res) => {
  res.send('API Running')
})

const PORT = process.env.PORT || 5600

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})