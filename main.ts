#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read --allow-write

import { GoogleGenAI } from "@google/genai";
import { Spinner } from "@std/cli/unstable-spinner";
import { parseArgs } from "@std/cli/parse-args";
import { retry } from "@std/async/retry";

interface ClaySculptorOptions {
  model?: string;
  outputDir?: string;
  variations?: number;
  shadows?: boolean;
}

interface ClayGenerationConfig extends ClaySculptorOptions {
  userInput: string;
  outputPath?: string;
}

interface CliArgs {
  interactive?: boolean;
  variations?: number;
  output?: string;
  "output-dir"?: string;
  model?: string;
  help?: boolean;
  version?: boolean;
  shadows?: boolean;
  _: string[];
}

class ClaySculptorAgent {
  private ai: GoogleGenAI;
  private readonly defaultModel = "imagen-4.0-generate-001";
  private readonly defaultOutputDir = "./output";
  private readonly shadows: boolean;
  private spinner: Spinner;

  constructor(apiKey: string, shadows: boolean = false) {
    this.ai = new GoogleGenAI({ apiKey });
    this.shadows = shadows;
    this.spinner = new Spinner({
      message: "Initializing...",
      color: "cyan",
    });
  }

  private async ensureOutputDirectory(dir: string): Promise<void> {
    try {
      await Deno.mkdir(dir, { recursive: true });
    } catch (error) {
      if (!(error instanceof Deno.errors.AlreadyExists)) {
        throw error;
      }
    }
  }

  private generatePrompt(userInput: string, shadows?: boolean): string {
    return `Stylized 3D cartoon prop of ${userInput}, playful clay-like texture, smooth surface finish, modern and creative design — white background${
      !shadows ? ", no shadows" : ""
    } — soft studio lighting — 1:1 aspect ratio — 1024x1024`;
  }

  private generateFilename(
    userInput: string,
    isVariation: boolean = false,
    variationIndex?: number,
  ): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const sanitizedInput = userInput.replace(/[^a-zA-Z0-9]/g, "_");

    if (isVariation && variationIndex !== undefined) {
      return `clay_${sanitizedInput}_variation_${
        variationIndex + 1
      }_${timestamp}.png`;
    }

    return `clay_${sanitizedInput}_${timestamp}.png`;
  }

  async generateClayImage(config: ClayGenerationConfig): Promise<string> {
    const {
      userInput,
      outputPath,
      model = this.defaultModel,
      shadows = this.shadows,
      outputDir = this.defaultOutputDir,
    } = config;

    this.spinner.message = `🎨 Generating clay image for: "${userInput}"`;
    this.spinner.start();

    try {
      await this.ensureOutputDirectory(outputDir);

      // https://googleapis.github.io/js-genai/release_docs/classes/models.Models.html#generateimages
      const response = await retry(() =>
        this.ai.models.generateImages({
          model,
          prompt: this.generatePrompt(userInput, shadows),
          config: {
            numberOfImages: 1,
            includeRaiReason: false,
          },
        })
      );

      // Access the generated image using the correct response structure
      if (!response?.generatedImages || response.generatedImages.length === 0) {
        throw new Error("No images generated");
      }

      const image = response.generatedImages[0];
      if (!image?.image?.imageBytes) {
        throw new Error("Generated image has no bytes");
      }

      const filename = this.generateFilename(userInput);
      const finalOutputPath = outputPath ||
        `${outputDir}/${filename}`;

      // Save the image bytes to file - ensure it's a Uint8Array
      const imageBytes = image.image.imageBytes;
      if (typeof imageBytes === "string") {
        // Convert base64 string to Uint8Array if needed
        const binaryString = atob(imageBytes);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        await Deno.writeFile(finalOutputPath, bytes);
      } else {
        // Assume it's already a Uint8Array
        await Deno.writeFile(finalOutputPath, imageBytes);
      }

      this.spinner.stop();
      console.log(`✅ Clay image saved to: ${finalOutputPath}`);
      return finalOutputPath;
    } catch (error) {
      this.spinner.stop();
      console.error("❌ Error generating clay image:", error);
      throw error;
    }
  }

  async generateMultipleVariations(
    userInput: string,
    count: number = 3,
  ): Promise<string[]> {
    this.spinner.message =
      `🔄 Generating ${count} variations of: "${userInput}"`;
    this.spinner.start();

    const promises = Array.from(
      { length: count },
      (_, index) =>
        this.generateClayImage({
          userInput,
          outputPath: `${this.defaultOutputDir}/${
            this.generateFilename(userInput, true, index)
          }`,
          model: this.defaultModel,
          outputDir: this.defaultOutputDir,
          shadows: this.shadows,
        }),
    );

    try {
      const results = await Promise.all(promises);
      this.spinner.stop();
      console.log(`✅ Generated ${results.length} variations successfully`);
      return results;
    } catch (error) {
      this.spinner.stop();
      console.error("❌ Error generating variations:", error);
      throw error;
    }
  }
}

class InteractiveClaySculptor {
  private agent: ClaySculptorAgent;
  private options: ClaySculptorOptions;
  private spinner: Spinner;

  constructor(apiKey: string, options: ClaySculptorOptions = {}) {
    this.agent = new ClaySculptorAgent(apiKey, options.shadows);
    this.options = {
      model: options.model || "imagen-4.0-generate-001",
      outputDir: options.outputDir || "./output",
      variations: options.variations || 3,
      shadows: options.shadows || false,
    };
    this.spinner = new Spinner({
      message: "Starting interactive session...",
      color: "yellow",
    });
  }

  async startInteractiveSession(): Promise<void> {
    this.spinner.stop();
    this.showWelcomeMessage();

    while (true) {
      try {
        const input = prompt("🎨 Describe your clay creation: ");
        if (!input?.trim()) continue;

        if (await this.handleCommand(input.trim())) break;
      } catch (error) {
        console.error("💥 Error:", error);
        console.log("");
      }
    }
  }

  private showWelcomeMessage(): void {
    console.log(`
🎭 Gemini Sculptor - Interactive Mode
=====================================

Welcome to the interactive clay generation session!
Type your descriptions and watch the magic happen.

Commands:
  • Type any description to generate a clay image
  • Type "variations <count> <description>" for multiple versions
  • Type "help" for available commands
  • Type "quit" or "exit" to end the session

Examples:
  • "cute robot with big eyes"
  • "variations 3 magical unicorn"
  • "friendly dragon with rainbow scales"

Current settings:
  • Output directory: ${this.options.outputDir || "./output"}
  • Default variations: ${this.options.variations || 3}

Let's start creating! 🎨
`);
  }

  private async handleCommand(input: string): Promise<boolean> {
    const lowerInput = input.toLowerCase();

    // Exit commands
    if (lowerInput === "quit" || lowerInput === "exit") {
      console.log(
        "\n👋 Thanks for creating with Gemini Sculptor! Happy sculpting! 🎨✨",
      );
      return true;
    }

    // Help commands
    if (lowerInput === "help") {
      this.showHelp();
      return false;
    }

    if (lowerInput === "clear") {
      console.clear();
      return false;
    }

    // Variations command
    if (await this.handleVariationsCommand(input)) {
      return false;
    }

    // Generate single image
    await this.generateSingleImage(input);
    console.log("");
    return false;
  }

  private async handleVariationsCommand(input: string): Promise<boolean> {
    const variationsMatch = input.match(/^variations\s+(\d+)\s+(.+)$/i);
    if (!variationsMatch) return false;

    const count = parseInt(variationsMatch[1]);
    const description = variationsMatch[2].trim();

    if (count < 1 || count > 10) {
      console.log("⚠️  Please specify 1-10 variations");
      return true;
    }

    console.log(`🔄 Generating ${count} variations of: "${description}"`);
    await this.agent.generateMultipleVariations(description, count);
    return true;
  }

  private async generateSingleImage(description: string): Promise<void> {
    await this.agent.generateClayImage({
      userInput: description,
      model: this.options.model,
      outputDir: this.options.outputDir,
      shadows: this.options.shadows,
    });
  }

  private showHelp(): void {
    console.log(`
📚 Available Commands:
====================

Basic Usage:
  • <description> - Generate a single clay image
  • variations <count> <description> - Generate multiple variations

Session Commands:
  • help - Show this help message
  • clear - Clear the terminal
  • quit/exit - End the session

Examples:
  • "cute robot with big eyes"
  • "variations 3 magical unicorn"
  • "friendly dragon with rainbow scales"
  • "space rocket with glowing engines"

Tips:
  • Be descriptive for better results
  • Use "variations" for multiple options
  • Images are saved to the output directory
`);
  }
}

// CLI interface with proper argument parsing
async function main(): Promise<void> {
  const args = parseArgs(Deno.args, {
    boolean: ["interactive", "help", "version", "shadows"],
    string: ["variations", "output", "output-dir", "model"],
    alias: {
      "i": "interactive",
      "v": "variations",
      "o": "output",
      "h": "help",
      "V": "version",
      "s": "shadows",
    },
    default: {
      "output-dir": "./output",
    },
  }) as CliArgs;

  // Show help
  if (args.help) {
    showHelp();
    return;
  }

  // Show version
  if (args.version) {
    console.log("🎭 Gemini Sculptor v1.0.0");
    return;
  }

  // Check for interactive mode
  if (args.interactive) {
    await runInteractiveMode(args);
    return;
  }

  if (args._.length === 0) {
    showHelp();
    return;
  }

  await runSingleCommandMode(args);
}

async function runSingleCommandMode(args: CliArgs): Promise<void> {
  const userInput = args._[0];
  const variations = args.variations ? parseInt(args.variations.toString()) : 1;
  const outputPath = args.output;

  const apiKey = getApiKey();
  const agent = new ClaySculptorAgent(apiKey, args.shadows || false);

  try {
    if (variations > 1) {
      await agent.generateMultipleVariations(userInput, variations);
    } else {
      await agent.generateClayImage({
        userInput,
        outputPath: outputPath ||
          `./output/${userInput.replace(/[^a-zA-Z0-9]/g, "_")}.png`,
        model: args.model || "imagen-4.0-generate-001",
        outputDir: args["output-dir"] || "./output",
        shadows: args.shadows || false,
      });
    }

    console.log("🎉 Clay generation completed successfully!");
  } catch (error) {
    console.error("💥 Fatal error:", error);
    Deno.exit(1);
  }
}

async function runInteractiveMode(args: CliArgs): Promise<void> {
  const options: ClaySculptorOptions = {
    model: args.model || "imagen-4.0-generate-001",
    outputDir: args["output-dir"] || "./output",
    variations: 3,
    shadows: args.shadows || false,
  };

  const apiKey = getApiKey();

  try {
    const interactiveAgent = new InteractiveClaySculptor(apiKey, options);
    await interactiveAgent.startInteractiveSession();
  } catch (error) {
    console.error("💥 Fatal error:", error);
    Deno.exit(1);
  }
}

function getApiKey(): string {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    console.error("❌ Error: GEMINI_API_KEY environment variable is required");
    console.log("💡 Set it with: export GEMINI_API_KEY='your-api-key-here'");
    Deno.exit(1);
  }
  return apiKey;
}

function showHelp(): void {
  console.log(`
🎭 Gemini Sculptor - Text-to-Clay Agent

Usage:
  # Single command mode
  deno task start "your description here"
  deno task start "cute robot" --variations 3
  deno task start "magical castle" --output ./custom/path.png

  # Interactive mode
  deno task start --interactive
  deno task start -i --output-dir ./my_creations

Options:
  -i, --interactive          Start interactive mode
  -v, --variations <count>   Number of variations to generate
  -o, --output <path>        Custom output path for single image
  --output-dir <dir>         Output directory for images
  --model <model>            Gemini model to use
  -s, --shadows              Enable shadows in generated images
  -h, --help                 Show this help message
  -V, --version              Show version information

Examples:
  deno task start "friendly dragon"
  deno task start "space rocket" --variations 5
  deno task start "enchanted tree" --output ./my_creation.png
  deno task start "cute robot" --shadows
  deno task start --interactive
  deno task start -i --output-dir ./my_creations --model imagen-4.0-generate-001

The agent will generate stylized 3D cartoon props with:
• Playful clay-like texture
• Smooth surface finish  
• Modern and creative design
• White background with no shadows
• Soft studio lighting
• 1:1 aspect ratio

Interactive Mode Commands:
• Type descriptions to generate clay images
• "variations 3 magical unicorn" for multiple versions
• "help" for available commands
• "clear" to clear terminal
• "quit" or "exit" to end session
`);
}

// Run the main function if this is the main module
if (import.meta.main) {
  await main();
}

export { ClaySculptorAgent, InteractiveClaySculptor };
export type { ClayGenerationConfig, ClaySculptorOptions, CliArgs };
