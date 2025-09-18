import { ChatResponse, Ollama } from "ollama";
import chalk from "chalk";
import ora from "ora";
import { MCPServer, MCPInteraction } from "./mcp-interaction";

export class AIInteraction {
  private ollama: Ollama;
  private currentModel: string;
  private mcpInteraction: MCPInteraction;

  constructor(ollama: Ollama, mcpInteraction: MCPInteraction, currentModel: string) {
    this.ollama = ollama;
    this.mcpInteraction = mcpInteraction;
    this.currentModel = currentModel;
  }

  async sendAIRequest(
    messages: { role: "system" | "user" | "assistant"; content: string }[],
    useTools: boolean
  ): Promise<ChatResponse | null> {
    try {
      const tools = await this.mcpInteraction.getMCPTools();

      // Debug: Show what tools are being passed to the AI
      if (useTools) {
        if (tools.length > 0) {
          console.log(
            chalk.gray(
              `\n🔧 Passing ${tools.length} tools to AI: ${tools
                .map((t) => t.function.name)
                .join(", ")}`
            )
          );
        } else {
          console.log(chalk.gray("\n⚠️  No tools available to pass to AI"));
        }
      } else {
        console.log(chalk.gray("\n🚫 Tools disabled for this request"));
      }

      const response = await this.ollama.chat({
        model: this.currentModel,
        messages: messages,
        tools: useTools ? (tools.length > 0 ? tools : undefined) : undefined,
        stream: false,
      });
      return response;
    } catch (error) {
      console.error("Error sending AI request:", error);
      return null;
    }
  }


  async chatWithAI(message: string) {
    const spinner = ora("Thinking...").start();
    let messages: { role: "system" | "user" | "assistant"; content: string }[] =
      [];

    try {
      const tools = await this.mcpInteraction.getMCPTools();

      // Debug: Show available tools
      if (tools.length > 0) {
        console.log(
          chalk.green(
            `\n🔧 Available tools: ${tools
              .map((t) => t.function.name)
              .join(", ")}`
          )
        );
      } else {
        console.log(chalk.yellow("\n⚠️  No tools available"));
      }

      const systemPrompt = `You are an AI assistant that helps users accomplish tasks. You have access to powerful tools that you should use whenever they would be helpful.

Available tools: ${tools
        .map(
          (t) =>
            `${t.function.name}: ${t.function.description || "No description"}`
        )
        .join("\n")}

Guidelines:
1. Use tools whenever they would help answer the user's question or complete their request
2. If you need to explore files, directories, or get information, use the appropriate tools
3. Be proactive in using tools - don't just provide general advice when you can get specific information
4. If you use a tool, explain what you found and how it helps answer the question
5. If no tools are needed, provide a helpful response directly

Remember: You have these tools available, so use them when they would be helpful!`;

      messages.push({ role: "system", content: systemPrompt });
      messages.push({ role: "user", content: message });

      let iterations = 0;

      while (true) {
        console.log(chalk.blue(`\n--- Iteration ${iterations + 1} ---`));

        // Send request with tools enabled
        const response = await this.sendAIRequest(
          messages,
          true // Always enable tools
        );

        if (response === null) {
          console.error(chalk.red("No response from AI."));
          break;
        }

        // Add the AI's response to the conversation
        messages.push({
          role: "assistant",
          content: response.message.content || "",
        });

        // Execute tools if the AI decided to use them
        if (
          response.message.tool_calls &&
          response.message.tool_calls.length > 0
        ) {
          console.log(chalk.yellow("\n🔧 Executing tools..."));

          for (const toolCall of response.message.tool_calls) {
            try {
              console.log(chalk.cyan(`\nCalling: ${toolCall.function.name}`));
              const result = await this.mcpInteraction.callMCPTool(
                toolCall.function.name,
                toolCall.function.arguments
              );

              console.log(chalk.green("\n📄 Tool Result:"));
              console.log(chalk.white((result as any).content[0].text));

              // Add tool result to conversation
              messages.push({
                role: "assistant",
                content: (result as any).content[0].text,
              });
            } catch (error) {
              console.log(chalk.red("Tool execution failed:"), error);
              messages.push({
                role: "assistant",
                content: `Tool execution failed: ${error}`,
              });
            }
          }
        } else {
          console.log(chalk.blue("\n💭 AI Response:"));
          console.log(chalk.white(response.message.content));

          // If AI provided a complete response without tools, we're done
          break;
        }

        iterations++;
        if (iterations > 10) {
          console.error(chalk.red("Maximum iterations reached"));
          break;
        }
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
}
