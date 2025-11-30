const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const connectDB = require('./config/database');
const didRoutes = require('./routes/did.routes');
const feedbackRoutes = require('./routes/feedback.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to DID Wallet API',
    documentation: '/api-docs',
    version: '1.0.0',
    endpoints: {
      did: '/api/did',
      feedback: '/api/feedback'
    }
  });
});

// Swagger documentation
const swaggerPath = path.join(__dirname, 'swagger.yaml');
const swaggerDocument = YAML.load(swaggerPath);

// Update Swagger server URL dynamically for Cloud Run
if (process.env.API_GATEWAY_URL) {
  // Use API Gateway URL if provided
  swaggerDocument.servers = [
    { url: `${process.env.API_GATEWAY_URL}/api`, description: 'Production API Gateway' },
    { url: 'http://localhost:3000/api', description: 'Local development' }
  ];
} else if (process.env.K_SERVICE) {
  // Running on Cloud Run without API Gateway
  swaggerDocument.servers = [
    { url: 'https://did-wallet-gateway-3vipohlg.ew.gateway.dev/api', description: 'Production API Gateway' },
    { url: 'http://localhost:3000/api', description: 'Local development' }
  ];
}

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Routes
app.use('/api/did', didRoutes);
app.use('/api/feedback', feedbackRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`API Documentation available at http://localhost:${PORT}/api-docs`);
});