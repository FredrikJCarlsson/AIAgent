import { ChatResponse, Ollama } from "ollama";
import chalk from "chalk";
import ora from "ora";

export interface MCPServer {
  name: string;
  process: any;
  client: any;
}

export class AIInteraction {
  private ollama: Ollama;
  private mcpServers: MCPServer[];
  private currentModel: string;

  constructor(ollama: Ollama, mcpServers: MCPServer[], currentModel: string) {
    this.ollama = ollama;
    this.mcpServers = mcpServers;
    this.currentModel = currentModel;
  }

  async sendAIRequest(
    userPrompt: string,
    systemPrompt: string,
    history: string[],
    useTools: boolean
  ): Promise<ChatResponse | null> {
    try {
      const tools = await this.getMCPTools();

      const response = await this.ollama.chat({
        model: this.currentModel,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          ...history.map((h) => ({ role: "user", content: h })),
          { role: "user", content: userPrompt },
        ],
        tools: useTools ? (tools.length > 0 ? tools : undefined) : undefined,
        stream: false,
      });
      return response;
    } catch (error) {
      console.error("Error sending AI request:", error);
      return null;
    }
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

        // console.log(chalk.green(`Tools from ${server.name}:`), mapped);
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
    console.log(
      chalk.cyan(
        "\nCalling tool: " + toolName + " with args: " + JSON.stringify(args)
      )
    );
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
      const systemPrompt = `You are an AI assistant that works step-by-step to accomplish user requests. Your job is to determine the NEXT SINGLE ACTION to take.

                            Available tools: ${tools
                              .map((t) => t.function.name)
                              .join(", ")}

                            Rules:
                            1. Analyze the user request and determine what the very next step should be
                            2. Create a very short reasoning for the next action to take
                            3. Choose ONE specific action to take right now
                            4. If you need to use a tool, specify exactly which tool and what parameters
                            5. Be specific and actionable - don't plan ahead, just do the next thing
                            6. Respond with ONLY the next action in this format:
                            7. If you don't need to use a tool, respond with "NO TOOLS NEEDED"

                            NEXT ACTION: [Specific action to take now]

                            Examples:
                            NEXT ACTION: Use list_directories to explore the current directory
                            NEXT ACTION: Use get_file_content to read the package.json file
                            NEXT ACTION: Use list_files to see what files are in the src folder`;

      const history: string[] = [];
      let useTools = false;
      // Send initial ai request
      while (true) {
        const response = await this.sendAIRequest(
          message,
          systemPrompt,
          history,
          useTools
        );
        if (
          response === null ||
          response.message.content.includes("NO TOOLS NEEDED")
        ) {
          console.error(chalk.red("No response from AI."));
          break;
        }
        console.log(chalk.cyan("\n🤖 AI Response:"));
        console.log(chalk.white(response.message.content));

        history.push(
          "System Prompt:\n" +
            systemPrompt +
            "\n\nUser Prompt:\n" +
            message +
            "\n\nAI Response:\n" +
            response.message.content
        );

        useTools = true;
        const nextResponse = await this.sendAIRequest(
          response.message.content,
          systemPrompt,
          history,
          useTools
        );
        if (nextResponse === null) {
          console.error(chalk.red("No response from AI."));
          break;
        }

        if (nextResponse.message.tool_calls) {
          let result = await this.callMCPTool(
            nextResponse.message.tool_calls[0].function.name,
            nextResponse.message.tool_calls[0].function.arguments
          );
          console.log(chalk.cyan("\n🤖 AI Response:"));
          console.log(chalk.white(result.content[0].text));
        }
        break;
      }
      spinner.stop();
      return;
    } catch (error) {
      spinner.fail("Error communicating with AI");
      console.error(error);
    }
  }

  // Method to update the current model
  updateModel(newModel: string) {
    this.currentModel = newModel;
  }

  // Method to update MCP servers
  updateMCPServers(mcpServers: MCPServer[]) {
    this.mcpServers = mcpServers;
  }
}
