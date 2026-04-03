require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');
const { requestLogger } = require('./middlewares/requestLogger');
const { ENABLE_REQUEST_LOGS, LOG_REQUEST_BODY } = require('./config/appConfig');
const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
  ],
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
if (ENABLE_REQUEST_LOGS) {
  app.use(requestLogger({ logRequestBody: LOG_REQUEST_BODY }));
}

// Database connection
mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));


// Swagger setup
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Giggle API',
    version: '1.0.0',
    description: 'API documentation for Giggle MVP backend',
  },
  servers: [
    { url: 'http://localhost:' + PORT + '/api', description: 'Local server' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

const swaggerOptions = {
  swaggerDefinition,
  apis: [
    './src/routes/*.js',
    './src/controllers/*.js',
  ],
};
const swaggerSpec = swaggerJSDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
const squadRoutes = require("./routes/squadRoutes");
const authRoutes = require("./routes/authRoutes");
const agoraRoutes = require("./routes/agoraRoutes");
app.use("/api", squadRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", agoraRoutes);

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      ok: false,
      error: {
        code: "INVALID_JSON",
        message: "Malformed JSON body",
        hint: 'Use valid JSON like {"squadCode":"GIG-882","displayName":"Himanshu"}',
      },
    });
  }

  console.error(err.stack);
  res.status(500).json({
    ok: false,
    error: { code: "INTERNAL_ERROR", message: "Something broke" },
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
