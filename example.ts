// Gemini Sculptor Configuration Example
// Copy this file to config.ts and fill in your actual values

export const config = {
  // Your Google AI Studio API key (required)
  // Get one from: https://makersuite.google.com/app/apikey
  apiKey: "your-api-key-here",

  // Optional: Override default model
  // model: "imagen-4.0-generate-001",

  // Optional: Override default output directory
  // outputDir: "./output",

  // Optional: Default image generation settings
  defaultSettings: {
    aspectRatio: "1:1",
    quality: "high",
    size: "1024x1024",
  },
};

// Usage in your code:
// import { config } from "./config.ts";
// const agent = new ClaySculptorAgent(config.apiKey);
