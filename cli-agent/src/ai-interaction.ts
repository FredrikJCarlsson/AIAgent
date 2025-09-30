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


  async chatWithAI(userRequest: string) {
    const spinner = ora("Thinking...").start();

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

      let iterations = 0;
      let allToolResults: string[] = [];

      while (iterations < 10) {
        console.log(chalk.blue(`\n--- Iteration ${iterations + 1} ---`));

        // Phase 1: Reasoning
        console.log(chalk.magenta("\n🧠 Phase 1: Reasoning"));
        spinner.text = "Analyzing request and planning approach...";
        
        const reasoning: string = await this.Reason(userRequest, allToolResults.length > 0 ? `Previous tool results: ${allToolResults.join("\n\n")}` : undefined);
        
        console.log(chalk.blue("\n💭 Reasoning:"));
        console.log(chalk.white(reasoning));

        // Phase 2: Tool Execution
        console.log(chalk.magenta("\n🔧 Phase 2: Tool Execution"));
        spinner.text = "Executing planned tools...";
        
        const { results: toolResults, toolCalls } = await this.RunTools(reasoning, userRequest);
        allToolResults.push(...toolResults);

        // Phase 3: Evaluation
        console.log(chalk.magenta("\n📊 Phase 3: Evaluation"));
        spinner.text = "Evaluating if task is complete...";
        
        const { isComplete, finalResponse } = await this.Evaluate(userRequest, reasoning, toolResults);

        // Debug logging
        console.log(chalk.gray(`\n🔍 Debug - Main loop isComplete: ${isComplete}`));

        if (isComplete) {
          console.log(chalk.green("\n✅ Task Complete!"));
          console.log(chalk.blue("\n📝 Final Response:"));
          console.log(chalk.white(finalResponse));
          break;
        } else {
          console.log(chalk.yellow("\n🔄 Task not complete, continuing..."));
          console.log(chalk.blue("\n📝 Evaluation:"));
          console.log(chalk.white(finalResponse));
        }

        iterations++;
      }

      if (iterations >= 5) {
        console.error(chalk.red("Maximum iterations reached"));
        console.log(chalk.blue("\n📝 Final Response:"));
        console.log(chalk.white("I've reached the maximum number of iterations. Here's what I was able to accomplish with the available information."));
      }

      spinner.stop();
      return;
    } catch (error) {
      spinner.fail("Error communicating with AI");
      console.error(error);
    }
  }


  async Reason(message: string, context?: string): Promise<string> {
    const reasoningPrompt = `You are an AI assistant that needs to analyze a user request and create a plan to solve it.

User Request: ${message}
${context ? `\nContext: ${context}` : ''}

Your task is to:
1. Understand what the user is asking for
2. Identify what information or actions you need to take
3. Plan which tools (if any) would be helpful
4. Provide a clear reasoning of your approach

Available tools: ${(await this.mcpInteraction.getMCPTools())
  .map((t) => `${t.function.name}: ${t.function.description || "No description"}`)
  .join("\n")}

Respond with your reasoning and plan. Be specific about:
- What you understand the user wants
- What tools you would use and why
- What information you expect to gather
- Any potential challenges or considerations

Format your response clearly and be thorough in your analysis.`;

    const messages = [
      { role: "system" as const, content: reasoningPrompt },
      { role: "user" as const, content: message }
    ];

    const response = await this.sendAIRequest(messages, false); // No tools for reasoning phase
    return response?.message.content || "Failed to generate reasoning";
  }


  async RunTools(reasoning: string, originalMessage: string): Promise<{ results: string[], toolCalls: any[] }> {
    const toolExecutionPrompt = `Based on the reasoning below, execute the necessary tools to gather information or perform actions.

Reasoning: ${reasoning}

Original User Request: ${originalMessage}

Available tools: ${(await this.mcpInteraction.getMCPTools())
  .map((t) => `${t.function.name}: ${t.function.description || "No description"}`)
  .join("\n")}

Your task is to:
1. Review the reasoning and identify which tools need to be called
2. Execute the appropriate tools with the correct parameters
3. Gather all necessary information to answer the user's request

Use tools proactively based on the reasoning. If the reasoning suggests exploring files, directories, or gathering specific information, use the appropriate tools to do so.

Be thorough and systematic in your approach.`;

    const messages = [
      { role: "system" as const, content: toolExecutionPrompt },
      { role: "user" as const, content: `Execute tools based on this reasoning: ${reasoning}` }
    ];

    const response = await this.sendAIRequest(messages, true); // Enable tools for execution phase
    
    if (!response) {
      return { results: ["Failed to get response from AI"], toolCalls: [] };
    }

    const results: string[] = [];
    const toolCalls: any[] = [];

    // Execute tools if the AI decided to use them
    if (response.message.tool_calls && response.message.tool_calls.length > 0) {
      console.log(chalk.yellow("\n🔧 Executing planned tools..."));
      
      for (const toolCall of response.message.tool_calls) {
        try {
          console.log(chalk.cyan(`\nCalling: ${toolCall.function.name}`));
          const result = await this.mcpInteraction.callMCPTool(
            toolCall.function.name,
            toolCall.function.arguments
          );

          const resultText = (result as any).content[0].text;
          console.log(chalk.green("\n📄 Tool Result:"));
          console.log(chalk.white(resultText));
          
          results.push(resultText);
          toolCalls.push(toolCall);
        } catch (error) {
          const errorMsg = `Tool execution failed: ${error}`;
          console.log(chalk.red(errorMsg));
          results.push(errorMsg);
          toolCalls.push({ ...toolCall, error: errorMsg });
        }
      }
    } else {
      console.log(chalk.blue("\n💭 No tools needed for this step"));
      results.push("No tools were executed");
    }

    return { results, toolCalls };
  }

  async Evaluate(originalMessage: string, reasoning: string, toolResults: string[]): Promise<{ isComplete: boolean, finalResponse: string }> {
    const evaluationPrompt = `You are evaluating whether a task has been completed successfully.

Original User Request: ${originalMessage}

Initial Reasoning: ${reasoning}

Tool Results: ${toolResults.join("\n\n---\n\n")}

Your task is to:
1. Review the original request and what was planned
2. Analyze the tool results to see if they provide sufficient information
3. Determine if the task is complete or if more work is needed
4. If complete, provide a comprehensive final response
5. If not complete, explain what additional steps are needed
6. If the task cannot be completed with the available tools, explain why and provide a final response.

Respond with:
- A clear assessment of whether the task is complete
- If complete: A thorough, helpful response to the user
- If not complete: What additional information or actions are needed
- If you are done or cannot continue clearly state so with **DONE**

Be honest about whether you have enough information to fully answer the user's request.`;

    const messages = [
      { role: "system" as const, content: evaluationPrompt },
      { role: "user" as const, content: `Evaluate if this task is complete: ${originalMessage}` }
    ];

    const response = await this.sendAIRequest(messages, false); // No tools for evaluation
    const responseText = response?.message.content || "Failed to evaluate task completion";
    
    // More robust heuristic to determine if task is complete
    const lowerResponse = responseText.toLowerCase();
    const isComplete = lowerResponse.includes("**done**") || 
                      lowerResponse.includes("task evaluation: complete") ||
                      (lowerResponse.includes("complete") && lowerResponse.includes("task"));
    
    // Debug logging
    console.log(chalk.gray(`\n🔍 Debug - isComplete: ${isComplete}`));
    console.log(chalk.gray(`🔍 Debug - responseText contains "**done**": ${lowerResponse.includes("**done**")}`));
    console.log(chalk.gray(`🔍 Debug - responseText contains "task evaluation: complete": ${lowerResponse.includes("task evaluation: complete")}`));

    return { isComplete, finalResponse: responseText };
  }

  // Method to update the current model
  updateModel(newModel: string) {
    this.currentModel = newModel;
  }
}
