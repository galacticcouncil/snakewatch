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

  /**
   * Register a new endpoint
   * @param {string} namespace - The namespace for this endpoint
   * @param {Object} routes - Object containing route definitions
   * @param {Object} options - Registration options
   * @param {boolean} options.prefix - Whether to prefix with /api/ (default: true)
   * @param {Array} options.middleware - Middleware to apply to the routes
   */
  registerEndpoint(namespace, routes, options = {}) {
    const { prefix = true, middleware = [] } = options;

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

    const path = prefix ? `/api/${namespace}` : `/${namespace}`;
    this.app.use(path, router);
    this.registeredEndpoints.set(namespace, { routes, options });
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
