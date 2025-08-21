#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read --allow-write

import { ClaySculptorAgent } from "./main.ts";

// Test script for ClaySculptorAgent
async function testAgent(): Promise<void> {
  console.log("🧪 Testing Gemini Sculptor Agent...\n");

  // Get API key from environment
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    console.error("❌ Error: GEMINI_API_KEY environment variable is required");
    console.log("💡 Set it with: export GEMINI_API_KEY='your-api-key-here'");
    Deno.exit(1);
  }

  try {
    const agent = new ClaySculptorAgent(apiKey, false); // Pass shadows parameter

    // Test 1: Generate a simple clay image
    console.log("🎯 Test 1: Generating a simple clay image...");
    const result1 = await agent.generateClayImage({
      userInput: "cute robot",
      outputPath: "./output/test_robot.png",
      model: "imagen-4.0-generate-001",
      outputDir: "./output",
      shadows: false,
    });
    console.log(`✅ Test 1 passed: ${result1}\n`);

    // Test 2: Generate multiple variations
    console.log("🎯 Test 2: Generating multiple variations...");
    const results2 = await agent.generateMultipleVariations("magical cat", 2);
    console.log(`✅ Test 2 passed: Generated ${results2.length} variations\n`);

    // Test 3: Test with custom model (if available)
    console.log("🎯 Test 3: Testing with custom configuration...");
    const result3 = await agent.generateClayImage({
      userInput: "friendly dragon",
      outputPath: "./output/test_dragon.png",
      model: "imagen-4.0-generate-001",
      outputDir: "./output",
      shadows: false,
    });
    console.log(`✅ Test 3 passed: ${result3}\n`);

    console.log("🎉 All tests passed successfully!");
    console.log("📁 Check the ./output/ directory for generated images");
  } catch (error) {
    console.error("💥 Test failed:", error);
    Deno.exit(1);
  }
}

// Run tests if this is the main module
if (import.meta.main) {
  await testAgent();
}

export { testAgent };
