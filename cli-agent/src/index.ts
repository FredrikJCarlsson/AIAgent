#!/usr/bin/env node

import { program } from "commander";
import { ChatResponse, Ollama } from "ollama";
import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";
import { join } from "path";
import { AIInteraction } from "./ai-interaction.js";
import { MCPInteraction, MCPServer } from "./mcp-interaction.js";


class AICLIAgent {
  private ollama: Ollama;
  private currentModel: string = "llama3.2";
  private aiInteraction: AIInteraction;
  private mcpServers: MCPServer[] = [];
  private mcpInteraction: MCPInteraction;

  constructor() {
    this.ollama = new Ollama({
      host: "http://localhost:11434",
    });

    this.mcpInteraction = new MCPInteraction(this.mcpServers);
    this.aiInteraction = new AIInteraction(this.ollama, this.mcpInteraction, this.currentModel);
  }

  async initialize() {
    console.log(chalk.blue.bold("🤖 AI CLI Agent"));
    console.log(chalk.gray("Connecting to Ollama and MCP servers...\n"));

    // Check Ollama connection
    const spinner = ora("Checking Ollama connection...").start();
    try {
      await this.ollama.list();
      spinner.succeed("Connected to Ollama");
    } catch (error) {
      spinner.fail(
        "Failed to connect to Ollama. Make sure it's running on localhost:11434"
      );
      process.exit(1);
    }

    // Start MCP servers
    await this.startMCPServers();

    console.log(chalk.green("\n✅ Initialization complete!\n"));
  }

  private async startMCPServers() {
    const spinner = ora("Starting MCP servers...").start();

    try {
      // Create client
      const client = new Client({
        name: "ai-cli-agent",
        version: "1.0.0",
      });

      // Create transport that will spawn the MCP server process
      const transport = new StdioClientTransport({
        command: "node",
        args: [join(process.cwd(), "..", "mcp-server", "dist", "index.js")],
      });

      // Connect to the server (start() is called automatically by connect())
      await client.connect(transport);

      // Add server to our list
      this.mcpServers.push({
        name: "filesystem-server",
        process: transport, // Store transport instead of process
        client: client,
      });
      
      // Update AI interaction with new MCP servers
      this.mcpInteraction.updateMCPServers(this.mcpServers);

      spinner.succeed("MCP servers started successfully");
    } catch (error) {
      spinner.fail("Failed to start MCP servers");
      console.error(error);
    }
  }

  async listAvailableModels() {
    try {
      const models = await this.ollama.list();
      return models.models.map((model) => model.name);
    } catch (error) {
      console.error("Error fetching models:", error);
      return [];
    }
  }

  async changeModel() {
    const models = await this.listAvailableModels();
    if (models.length === 0) {
      console.log(
        chalk.yellow("No models available. Please pull a model first.")
      );
      return;
    }

    const { model } = await inquirer.prompt([
      {
        type: "list",
        name: "model",
        message: "Select a model:",
        choices: models,
        default: this.currentModel,
      },
    ]);

    this.currentModel = model;
    this.aiInteraction.updateModel(model);
    console.log(chalk.green(`Model changed to: ${model}`));
  }

  async runInteractiveMode() {
    while (true) {
      const { action } = await inquirer.prompt([
        {
          type: "list",
          name: "action",
          message: "What would you like to do?",
          choices: [
            { name: "💬 Chat with AI", value: "chat" },
            { name: "🔧 Use MCP Tool", value: "mcp" },
            { name: "🔄 Change Model", value: "model" },
            { name: "📋 List Available Tools", value: "tools" },
            { name: "❌ Exit", value: "exit" },
          ],
        },
      ]);

      switch (action) {
        case "chat":
          const { message } = await inquirer.prompt([
            {
              type: "input",
              name: "message",
              message: "Enter your message:",
            },
          ]);
          await this.aiInteraction.chatWithAI(message);
          break;

        case "mcp":
          await this.runMCPTool();
          break;

        case "model":
          await this.changeModel();
          break;

        case "tools":
          await this.mcpInteraction.getMCPTools();
          break;

        case "exit":
          console.log(chalk.blue("Goodbye! 👋"));
          process.exit(0);
      }

      console.log(); // Add spacing
    }
  }

  async runMCPTool() {
    const tools = await this.mcpInteraction.getMCPTools();
    if (tools.length === 0) {
      console.log(chalk.yellow("No MCP tools available"));
      return;
    }

    const { toolName } = await inquirer.prompt([
      {
        type: "list",
        name: "toolName",
        message: "Select a tool:",
        choices: tools.map((tool) => ({
          name: `${tool.function.name} - ${tool.function.description}`,
          value: tool.function.name,
        })),
      },
    ]);

    const tool = tools.find((t) => t.function.name === toolName);
    if (!tool) return;

    // Get tool arguments
    const args: any = {};
    if (tool.function.parameters?.properties) {
      for (const [key, prop] of Object.entries(
        tool.function.parameters.properties
      )) {
        const propTyped = prop as any;
        const { value } = await inquirer.prompt([
          {
            type: "input",
            name: "value",
            message: `Enter ${key}${
              propTyped.description ? ` (${propTyped.description})` : ""
            }:`,
            default: propTyped.default || "",
          },
        ]);
        if (value) args[key] = value;
      }
    }

    const spinner = ora("Executing tool...").start();
    try {
      const result = await this.mcpInteraction.callMCPTool(toolName, args);
      spinner.succeed("Tool executed successfully");
      console.log(chalk.green("\n📄 Result:"));
      console.log((result as any).content[0].text);
    } catch (error) {
      spinner.fail("Tool execution failed");
      console.error(error);
    }
  }

  async cleanup() {
    for (const server of this.mcpServers) {
      try {
        await server.client.close();
        await server.process.close();
      } catch (error) {
        console.error("Error cleaning up MCP server:", error);
      }
    }
  }
}

// CLI interface
program
  .name("ai-cli-agent")
  .description("AI CLI Agent with MCP server integration")
  .version("1.0.0")
  .option("-m, --model <model>", "Ollama model to use", "llama3.2")
  .option("--chat <message>", "Send a direct message to the AI")
  .action(async (options) => {
    const agent = new AICLIAgent();

    // Handle cleanup on exit
    process.on("SIGINT", async () => {
      console.log(chalk.yellow("\n\nShutting down..."));
      await agent.cleanup();
      process.exit(0);
    });

    try {
      await agent.initialize();
      await agent.runInteractiveMode();
    } catch (error) {
      console.error("Error:", error);
      await agent.cleanup();
      process.exit(1);
    }
  });

program.parse();
