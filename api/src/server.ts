import Fastify from 'fastify';
import fastifySensible from 'fastify-sensible';
import cors from 'fastify-cors';
import sse from './sse';
import routes from './routes/jobs';
import notebookRoutes from './routes/notebook';
import dotenv from 'dotenv';
dotenv.config();

const server = Fastify({ logger: true });

server.register(fastifySensible);
server.register(cors, { origin: '*' });
server.register(sse); // Register custom SSE plugin

server.register(routes, { prefix: '/api' });
server.register(notebookRoutes, { prefix: '/api/notebook' });

const start = async () => {
  try {
    await server.listen({ port: Number(process.env.PORT || 3000), host: '0.0.0.0' });
    server.log.info('API listening');
  } catch (err) {
    server.log.error(err);
    (process as any).exit(1);
  }
};

start();