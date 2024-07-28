import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import amqp from 'amqplib';
import swaggerUi from 'swagger-ui-express';
import swaggerJsDoc from 'swagger-jsdoc';
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import AWS from 'aws-sdk';

const secret_name = "myServiceSecrets_gr8";
const region = "us-east-2";

const client = new SecretsManagerClient({
  region: region,
});

async function getSecret() {
  try {
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: secret_name,
        VersionStage: "AWSCURRENT", // VersionStage defaults to AWSCURRENT if unspecified
      })
    );
    return JSON.parse(response.SecretString);
  } catch (error) {
    throw new Error(`Error fetching secret: ${error}`);
  }
}

async function startService() {
  let secrets;
  try {
    secrets = await getSecret();
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
        description: 'API for creating users'
      }
    },
    apis: ['./src/index.js']
  };

  const swaggerDocs = swaggerJsDoc(swaggerOptions);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

  // Connect to RabbitMQ
  let channel;
  async function connectRabbitMQ() {
    try {
      const connection = await amqp.connect('amqp://localhost');
      channel = await connection.createChannel();
      await channel.assertQueue('user-events', { durable: true });
      console.log('Connected to RabbitMQ');
    } catch (error) {
      console.error('Error connecting to RabbitMQ:', error);
    }
  }

  connectRabbitMQ();

  /**
   * @swagger
   * /users:
   *   post:
   *     description: Create a new user
   *     parameters:
   *       - name: firstName
   *         description: First name of the user
   *         in: body
   *         required: true
   *         type: string
   *       - name: lastName
   *         description: Last name of the user
   *         in: body
   *         required: true
   *         type: string
   *       - name: email
   *         description: Email of the user
   *         in: body
   *         required: true
   *         type: string
   *       - name: username
   *         description: Username of the user
   *         in: body
   *         required: true
   *         type: string
   *       - name: password
   *         description: Password of the user
   *         in: body
   *         required: true
   *         type: string
   *     responses:
   *       201:
   *         description: User created
   */
  app.post('/users', async (req, res) => {
    const { firstName, lastName, email, username, password } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);

      // Publish user created event to RabbitMQ
      const event = {
        eventType: 'UserCreated',
        data: { firstName, lastName, email, username, password: hashedPassword }
      };
      channel.sendToQueue('user-events', Buffer.from(JSON.stringify(event)));

      // Save user to DynamoDB
      const params = {
        TableName: 'Users_gr8', // Update the table name accordingly
        Item: {
          firstName,
          lastName,
          email,
          username,
          password: hashedPassword
        }
      };

      dynamoDB.put(params, (err, data) => {
        if (err) {
          console.error('Error saving user to DynamoDB:', err);
          res.status(500).send({ message: 'Error saving user to DynamoDB', error: err });
        } else {
          res.status(201).send({ firstName, lastName, email, username });
        }
      });
    } catch (error) {
      console.error('Error hashing password:', error);
      res.status(500).send({ message: 'Error hashing password', error: error });
    }
  });

  // Root route to check if the server is running
  app.get('/', (req, res) => {
    res.send('Create User Service Running');
  });

  app.listen(port, () => {
    console.log(`Create User service listening at http://localhost:${port}`);
  });
}

startService();
