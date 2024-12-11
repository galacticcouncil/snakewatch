import express from 'express';
import { createServer } from 'http';
import {port} from "./config.js";

class EndpointRegistry {
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.registeredEndpoints = new Map();

    this.app.use(express.json());

    this.app.use((err, req, res, next) => {
      console.error(err.stack);
      res.status(500).json({ error: 'Internal Server Error' });
    });
  }

  registerEndpoint(namespace, routes, middleware = []) {
    if (this.registeredEndpoints.has(namespace)) {
      throw new Error(`Endpoint namespace '${namespace}' is already registered`);
    }

    const router = express.Router();

    middleware.forEach(mw => router.use(mw));

    Object.entries(routes).forEach(([path, handlers]) => {
      Object.entries(handlers).forEach(([method, handler]) => {
        router[method.toLowerCase()](path, async (req, res, next) => {
          try {
            await handler(req, res, next);
          } catch (error) {
            next(error);
          }
        });
      });
    });

    this.app.use(`/api/${namespace}`, router);
    this.registeredEndpoints.set(namespace, { routes, middleware });
  }

  start() {
    return new Promise((resolve) => {
      this.server.listen(port, () => {
        console.log(`listening on port ${port}`);
        resolve();
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      this.server.close(resolve);
    });
  }

  getRegisteredEndpoints() {
    return Array.from(this.registeredEndpoints.keys());
  }
}

export const endpoints = new EndpointRegistry();
