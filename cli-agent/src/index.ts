#!/usr/bin/env node

import { program } from "commander";
import { Ollama } from "ollama";
import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";
import { join } from "path";

interface MCPServer {
  name: string;
  process: any;
  client: Client;
}

class AICLIAgent {
  private ollama: Ollama;
  private mcpServers: MCPServer[] = [];
  private currentModel: string = "llama3.2";

  constructor() {
    this.ollama = new Ollama({
      host: "http://localhost:11434",
    });
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
    console.log(chalk.green(`Model changed to: ${model}`));
  }

  async getMCPTools() {
    const allTools: {
      type: "function";
      function: {
        name: string;
        description?: string;
        parameters: {
          type: "object";
          required?: string[];
          properties?: {
            [key: string]: {
              type?: string | string[];
              description?: string;
              enum?: any[];
            };
          };
        };
      };
    }[] = [];

    for (const server of this.mcpServers) {
      try {
        const response = await server.client.listTools();

        // Convert MCP tool → Ollama tool format
        const mapped = response.tools.map((t: any) => ({
          type: "function" as const,
          function: {
            name: t.name,
            description: t.description,
            parameters: (t.inputSchema ?? {
              type: "object",
              properties: {},
            }) as {
              type: "object";
              required?: string[];
              properties?: {
                [key: string]: {
                  type?: string | string[];
                  description?: string;
                  enum?: any[];
                };
              };
            },
          },
        }));

        allTools.push(...mapped);

        console.log(chalk.green(`Tools from ${server.name}:`), mapped);
      } catch (error) {
        console.error(`Error getting tools from ${server.name}:`, error);
      }
    }

    if (allTools.length === 0) {
      console.log(chalk.yellow("No MCP tools available"));
    }

    return allTools;
  }

  async callMCPTool(toolName: string, args: any) {
    for (const server of this.mcpServers) {
      try {
        const response = await server.client.callTool({
          name: toolName,
          arguments: args,
        });
        return response;
      } catch (error) {
        // Try next server
        continue;
      }
    }

    throw new Error(`Tool ${toolName} not found on any MCP server`);
  }

  async chatWithAI(message: string) {
    const spinner = ora("Thinking...").start();

    try {
      const tools = await this.getMCPTools();

      const response = await this.ollama.chat({
        model: this.currentModel,
        messages: [
          {
            role: "system",
            content: "You are a helpful AI assistant with access to tools.",
          },
          { role: "user", content: message },
        ],
        // tools: tools.length > 0 ? tools : undefined,
        stream: false,
      });

      spinner.stop();
      console.log(chalk.cyan("\n🤖 AI Response:"));
      
      // Check if the AI wants to use tools
      if (response.message.tool_calls && response.message.tool_calls.length > 0) {
        console.log(chalk.yellow("AI wants to use tools:"));
        for (const toolCall of response.message.tool_calls) {
          console.log(chalk.gray(`- ${toolCall.function.name}: ${JSON.stringify(toolCall.function.arguments)}`));
          
          // Execute the tool call
          try {
            const toolResult = await this.callMCPTool(toolCall.function.name, toolCall.function.arguments);
            console.log(chalk.green("Tool result:"));
            console.log(chalk.white((toolResult as any).content[0].text));
          } catch (error) {
            console.log(chalk.red("Tool execution failed:"), error);
          }
        }
      } else {
        console.log(chalk.white(response.message.content));
      }

      // Check if the AI wants to use any tools
      if (
        message.toLowerCase().includes("list") ||
        message.toLowerCase().includes("file") ||
        message.toLowerCase().includes("directory")
      ) {
        console.log(
          chalk.yellow(
            "\n💡 Tip: You can use MCP tools directly with commands like:"
          )
        );
        console.log(chalk.gray("  - list_files [path]"));
        console.log(chalk.gray("  - list_directories [path]"));
        console.log(chalk.gray("  - get_file_content <file_path>"));
      }
    } catch (error) {
      spinner.fail("Error communicating with AI");
      console.error(error);
    }
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
          await this.chatWithAI(message);
          break;

        case "mcp":
          await this.runMCPTool();
          break;

        case "model":
          await this.changeModel();
          break;

        case "tools":
          await this.listTools();
          break;

        case "exit":
          console.log(chalk.blue("Goodbye! 👋"));
          process.exit(0);
      }

      console.log(); // Add spacing
    }
  }

  async runMCPTool() {
    const tools = await this.getMCPTools();
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
      for (const [key, prop] of Object.entries(tool.function.parameters.properties)) {
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
      const result = await this.callMCPTool(toolName, args);
      spinner.succeed("Tool executed successfully");
      console.log(chalk.green("\n📄 Result:"));
      console.log((result as any).content[0].text);
    } catch (error) {
      spinner.fail("Tool execution failed");
      console.error(error);
    }
  }

  async listTools() {
    const tools = await this.getMCPTools();
    if (tools.length === 0) {
      console.log(chalk.yellow("No MCP tools available"));
      return;
    }

    console.log(chalk.blue("\n🔧 Available MCP Tools:"));
    tools.forEach((tool) => {
      console.log(chalk.white(`  • ${tool.function.name}: ${tool.function.description}`));
    });
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

      if (options.chat) {
        await agent.chatWithAI(options.chat);
      } else {
        await agent.runInteractiveMode();
      }
    } catch (error) {
      console.error("Error:", error);
      await agent.cleanup();
      process.exit(1);
    }
  });

program.parse();
