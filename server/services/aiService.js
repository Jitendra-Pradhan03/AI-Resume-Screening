// server/services/aiService.js
// Why this file exists: Encapsulates all Node.js ↔ Python communication.
// Controllers call this service without knowing how the Python process
// is spawned or how data is exchanged — they just await the result.
// How it connects: Called by resume and match controllers whenever
// AI processing is needed.
// Key concept: child_process.spawn() creates a new Python process.
// We write JSON to its stdin and listen to stdout for the result.
// stderr captures Python logs without mixing them with the JSON output.

const { spawn } = require("child_process");
const path = require("path");
const { get_logger } = require("../utils/logger");

const logger = get_logger("aiService");

// Absolute path to the Python interpreter inside the virtual environment
const getPythonPath = () => {
  const isWindows = process.platform === "win32";
  const venvPath = path.join(__dirname, "../../ai/venv");
  return isWindows
    ? path.join(venvPath, "Scripts", "python.exe")
    : path.join(venvPath, "bin", "python");
};

// Absolute path to main.py
const MAIN_PY = path.join(__dirname, "../../ai/main.py");

/**
 * Calls the Python AI module with a given action and payload.
 * @param {string} action - One of: analyze_resume | match_resume | generate_questions | full_pipeline
 * @param {object} payload - Data to pass to Python (file paths, text, etc.)
 * @param {number} timeout - Max ms to wait before killing the process (default 120s)
 * @returns {Promise<object>} - Parsed JSON result from Python
 */
const callPythonAI = (action, payload = {}, timeout = 120000) => {
  return new Promise((resolve, reject) => {
    const pythonPath = getPythonPath();
    const inputData = JSON.stringify({ action, ...payload });

    logger.info(`Spawning Python — action: ${action}`);

    // Spawn the Python process
    const pythonProcess = spawn(pythonPath, [MAIN_PY], {
      env: { ...process.env },
    });

    let stdoutData = "";
    let stderrData = "";

    // Collect stdout (the JSON result)
    pythonProcess.stdout.on("data", (chunk) => {
      stdoutData += chunk.toString();
    });

    // Collect stderr (Python logs — useful for debugging)
    pythonProcess.stderr.on("data", (chunk) => {
      stderrData += chunk.toString();
    });

    // Set a timeout to kill the process if it takes too long
    const timer = setTimeout(() => {
      pythonProcess.kill("SIGTERM");
      reject(new Error(`Python AI process timed out after ${timeout / 1000}s`));
    }, timeout);

    // When the Python process exits
    pythonProcess.on("close", (exitCode) => {
      clearTimeout(timer);

      // Log any Python-side messages for debugging
      if (stderrData) {
        logger.debug(`Python stderr:\n${stderrData}`);
      }

      if (exitCode !== 0 && !stdoutData) {
        logger.error(`Python process exited with code ${exitCode}`);
        return reject(
          new Error(`Python process failed (exit ${exitCode}): ${stderrData}`)
        );
      }

      // Parse the JSON result from stdout
      try {
        const result = JSON.parse(stdoutData.trim());
        logger.info(`Python action "${action}" completed successfully`);
        resolve(result);
      } catch (parseError) {
        logger.error(`Failed to parse Python output: ${stdoutData}`);
        reject(new Error(`Invalid JSON from Python: ${parseError.message}`));
      }
    });

    pythonProcess.on("error", (err) => {
      clearTimeout(timer);
      logger.error(`Failed to spawn Python process: ${err.message}`);
      reject(new Error(`Could not start Python AI module: ${err.message}`));
    });

    // Send the input JSON to Python's stdin and close the stream
    pythonProcess.stdin.write(inputData);
    pythonProcess.stdin.end();
  });
};

/**
 * Analyze a resume PDF — extract text, entities, skills.
 */
const analyzeResume = (filePath) => {
  return callPythonAI("analyze_resume", {
    filePath: path.resolve(filePath),
  });
};

/**
 * Match a resume against a job description.
 */
const matchResume = (filePath, jobDescriptionText, parsedResume = null) => {
  return callPythonAI("match_resume", {
    filePath: path.resolve(filePath),
    jobDescription: jobDescriptionText,
    parsedResume,
  });
};

/**
 * Generate interview questions from parsed resume data.
 */
const generateInterviewQuestions = (parsedResume, jobDescription = "") => {
  return callPythonAI("generate_questions", {
    parsedResume,
    jobDescription,
  });
};

/**
 * Run the complete pipeline in one call:
 * analyze → match → generate questions.
 */
const runFullPipeline = (filePath, jobDescriptionText) => {
  return callPythonAI(
    "full_pipeline",
    {
      filePath: path.resolve(filePath),
      jobDescription: jobDescriptionText,
    },
    180000 // 3-minute timeout for the full pipeline
  );
};

module.exports = {
  analyzeResume,
  matchResume,
  generateInterviewQuestions,
  runFullPipeline,
};