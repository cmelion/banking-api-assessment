import { createApp } from './app';
import { serverConfig } from './config';
import { disconnectDatabase } from './db/connection';

async function start() {
  try {
    const app = await createApp();

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      app.log.info(`Received ${signal}, shutting down gracefully`);

      try {
        // Stop accepting new connections
        await app.close();

        // Disconnect from database
        await disconnectDatabase();

        app.log.info('Server shutdown complete');
        process.exit(0);
      } catch (error) {
        app.log.error('Error during shutdown:', error as any);
        process.exit(1);
      }
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Start server
    await app.listen({
      port: serverConfig.port,
      host: serverConfig.host,
    });

    app.log.info(`🚀 Banking API server started on http://${serverConfig.host}:${serverConfig.port}`);
    app.log.info(`📚 API documentation available at http://localhost:${serverConfig.port}/docs`);

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

start();