require("dotenv").config({ quiet: true });

const { getOpenRouterConfig } = require("../config/openRouter");

try {
  const config = getOpenRouterConfig();
  console.log(`AI service configuration is valid. Model: ${config.model}`);
} catch (error) {
  console.error(error.message || "AI service configuration is invalid.");
  process.exitCode = 1;
}
