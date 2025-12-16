const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const didRoutes = require('./routes/did.routes');
const feedbackRoutes = require('./routes/feedback.routes');
const tokenRoutes = require('./routes/token.routes');
const stakingRoutes = require('./routes/staking.routes');
const personaRoutes = require('./routes/persona.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to DID Wallet API',
    documentation: '/api-docs',
    version: '2.0.0',
    endpoints: {
      did: '/api/did',
      feedback: '/api/feedback',
      token: '/api/token',
      staking: '/api/staking',
      persona: '/api/persona'
    }
  });
});

// Swagger documentation
const swaggerPath = path.join(__dirname, 'swagger.yaml');
const swaggerDocument = YAML.load(swaggerPath);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Routes
// Note: DID routes may fail to load due to dependency issues, but other routes will work
try {
  app.use('/api/did', didRoutes);
  console.log('✓ DID routes loaded');
} catch (error) {
  console.warn('⚠️  DID routes failed to load:', error.message);
  console.warn('   Other API endpoints are still available');
}

app.use('/api/feedback', feedbackRoutes);
app.use('/api/token', tokenRoutes);
app.use('/api/staking', stakingRoutes);
app.use('/api/persona', personaRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`API Documentation available at http://localhost:${PORT}/api-docs`);
});