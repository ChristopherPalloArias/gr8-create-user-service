import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import amqp from 'amqplib';
import swaggerUi from 'swagger-ui-express';
import swaggerJsDoc from 'swagger-jsdoc';
import AWS from 'aws-sdk';

// AWS region and Lambda function configuration
const region = "us-east-2";
const lambdaFunctionName = "fetchSecretsFunction_gr8";

// Function to invoke Lambda and fetch secrets
async function getSecretFromLambda() {
  const lambda = new AWS.Lambda({ region: region });
  const params = {
    FunctionName: lambdaFunctionName,
  };

  try {
    const response = await lambda.invoke(params).promise();
    const payload = JSON.parse(response.Payload);
    if (payload.errorMessage) {
      throw new Error(payload.errorMessage);
    }
    const body = JSON.parse(payload.body);
    return JSON.parse(body.secret);
  } catch (error) {
    console.error('Error invoking Lambda function:', error);
    throw error;
  }
}

// Function to start the service
async function startService() {
  let secrets;
  try {
    secrets = await getSecretFromLambda();
  } catch (error) {
    console.error(`Error starting service: ${error}`);
    return;
  }

  const app = express();
  const port = 8082;

  app.use(cors());
  app.use(express.json());

  // Configure AWS DynamoDB
  AWS.config.update({
    region: region,
    accessKeyId: secrets.AWS_ACCESS_KEY_ID,
    secretAccessKey: secrets.AWS_SECRET_ACCESS_KEY,
  });

  const dynamoDB = new AWS.DynamoDB.DocumentClient();

  // Swagger setup
  const swaggerOptions = {
    swaggerDefinition: {
      info: {
        title: 'Create User Service API',
        version: '1.0.0',
        description: 'API for creating users',
      },
    },
    apis: ['./src/index.js'],
  };

  const swaggerDocs = swaggerJsDoc(swaggerOptions);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

  // Connect to RabbitMQ
  let channel;
  async function connectRabbitMQ() {
    try {
      const connection = await amqp.connect('amqp://3.136.72.14:5672/');
      channel = await connection.createChannel();
      await channel.assertQueue('user-events', { durable: true });
      console.log('Connected to RabbitMQ');
    } catch (error) {
      console.error('Error connecting to RabbitMQ:', error);
    }
  }

  await connectRabbitMQ();

  app.post('/users', async (req, res) => {
    const { firstName, lastName, email, username, password } = req.body;
    console.log('Received request to create user:', req.body);

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      console.log('Password hashed successfully:', hashedPassword);

      // Save user to DynamoDB
      const params = {
        TableName: 'Users_gr8', // Update the table name accordingly
        Item: {
          firstName,
          lastName,
          email,
          username,
          password: hashedPassword,
        },
      };

      dynamoDB.put(params, (err, data) => {
        if (err) {
          console.error('Error saving user to DynamoDB:', err);
          res.status(500).send({ message: 'Error saving user to DynamoDB', error: err });
        } else {
          console.log('User saved to DynamoDB:', data);
          
          // Publish user created event to RabbitMQ
          const event = {
            eventType: 'UserCreated',
            data: { firstName, lastName, email, username, password: hashedPassword },
          };
          channel.sendToQueue('user-events', Buffer.from(JSON.stringify(event)));
          console.log('Event published to RabbitMQ:', event);

          res.status(201).send({ firstName, lastName, email, username });
        }
      });
    } catch (error) {
      console.error('Error hashing password:', error);
      res.status(500).send({ message: 'Error hashing password', error: error });
    }
  });

  app.get('/', (req, res) => {
    res.send('Create User Service Running');
  });

  app.listen(port, () => {
    console.log(`Create User service listening at http://localhost:${port}`);
  });
}

startService();
