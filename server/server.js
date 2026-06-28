// server/server.js
// Why this file exists: This is the entry point — the file you run with
// "node server.js" or "npm start". It starts the HTTP server.
// How it connects: Imports app.js (Express app) and connectDB (MongoDB).
// Key concept: We connect to the DB BEFORE starting the server so we
// never serve requests without a database connection.

const dotenv = require("dotenv");

// Load environment variables first — before anything else
dotenv.config({ path: "./.env" });

const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 5000;

// Connect to MongoDB then start the server
const startServer = async () => {
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(
      `Server running in ${process.env.NODE_ENV} mode on port ${PORT}`
    );
    console.log(`Health check: http://localhost:${PORT}/api/health`);
  });

  // Handle unhandled promise rejections (e.g. async errors outside try/catch)
  process.on("unhandledRejection", (err) => {
    console.error(`Unhandled Rejection: ${err.message}`);
    // Gracefully shut down the server before exiting
    server.close(() => process.exit(1));
  });

  // Handle SIGTERM (e.g. when deployment platform sends a shutdown signal)
  process.on("SIGTERM", () => {
    console.log("SIGTERM received. Shutting down gracefully...");
    server.close(() => {
      console.log("Server closed.");
      process.exit(0);
    });
  });
};

startServer();