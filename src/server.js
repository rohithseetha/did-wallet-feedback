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
if (process.env.K_SERVICE) {
  // Running on Cloud Run
  const serviceUrl = `https://${process.env.K_SERVICE}-${process.env.K_REVISION?.split('-')[0] || ''}.run.app`;
  swaggerDocument.servers = [{ url: `${serviceUrl}/api`, description: 'Cloud Run' }];
} else if (process.env.CLOUD_RUN_URL) {
  // Custom Cloud Run URL provided
  swaggerDocument.servers = [{ url: `${process.env.CLOUD_RUN_URL}/api`, description: 'Production' }];
}

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Routes
app.use('/api/did', didRoutes);
app.use('/api/feedback', feedbackRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`API Documentation available at http://localhost:${PORT}/api-docs`);
});