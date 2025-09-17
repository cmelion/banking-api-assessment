const { createApp } = require('../dist/app.js');

let app;

module.exports = async (req, res) => {
  if (!app) {
    app = await createApp();
    await app.ready();
  }

  app.server.emit('request', req, res);
};