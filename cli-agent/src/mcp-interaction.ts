import chalk from "chalk";


export interface MCPServer {
  name: string;
  process: any;
  client: any;
}

export class MCPInteraction {
  private mcpServers: MCPServer[] = [];

  constructor(mcpServers: MCPServer[]) {
    this.mcpServers = mcpServers;
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

  // Method to update MCP servers
  updateMCPServers(mcpServers: MCPServer[]) {
    this.mcpServers = mcpServers;
  }
}