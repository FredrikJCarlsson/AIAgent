#!/usr/bin/env node
import { program } from 'commander';
import { Ollama } from 'ollama';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';
import { join } from 'path';
class AICLIAgent {
    ollama;
    mcpServers = [];
    currentModel = 'llama3.2';
    constructor() {
        this.ollama = new Ollama({
            host: 'http://localhost:11434'
        });
    }
    async initialize() {
        console.log(chalk.blue.bold('🤖 AI CLI Agent'));
        console.log(chalk.gray('Connecting to Ollama and MCP servers...\n'));
        // Check Ollama connection
        const spinner = ora('Checking Ollama connection...').start();
        try {
            await this.ollama.list();
            spinner.succeed('Connected to Ollama');
        }
        catch (error) {
            spinner.fail('Failed to connect to Ollama. Make sure it\'s running on localhost:11434');
            process.exit(1);
        }
        // Start MCP servers
        await this.startMCPServers();
        console.log(chalk.green('\n✅ Initialization complete!\n'));
    }
    async startMCPServers() {
        const spinner = ora('Starting MCP servers...').start();
        try {
            // Start local MCP server
            const mcpServerPath = join(process.cwd(), '..', 'mcp-server', 'dist', 'index.js');
            const mcpProcess = spawn('node', [mcpServerPath], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: process.cwd()
            });
            const transport = new StdioClientTransport({
                command: 'node',
                args: [mcpServerPath]
            });
            const client = new Client({
                name: 'ai-cli-agent',
                version: '1.0.0'
            });
            await transport.start();
            client.connect(transport);
            this.mcpServers.push({
                name: 'filesystem',
                process: mcpProcess,
                client: client
            });
            spinner.succeed('MCP servers started');
        }
        catch (error) {
            spinner.fail('Failed to start MCP servers');
            console.error(error);
        }
    }
    async listAvailableModels() {
        try {
            const models = await this.ollama.list();
            return models.models.map(model => model.name);
        }
        catch (error) {
            console.error('Error fetching models:', error);
            return [];
        }
    }
    async changeModel() {
        const models = await this.listAvailableModels();
        if (models.length === 0) {
            console.log(chalk.yellow('No models available. Please pull a model first.'));
            return;
        }
        const { model } = await inquirer.prompt([
            {
                type: 'list',
                name: 'model',
                message: 'Select a model:',
                choices: models,
                default: this.currentModel
            }
        ]);
        this.currentModel = model;
        console.log(chalk.green(`Model changed to: ${model}`));
    }
    async getMCPTools() {
        const allTools = [];
        for (const server of this.mcpServers) {
            try {
                const response = await server.client.listTools();
                allTools.push(...response.tools);
            }
            catch (error) {
                console.error(`Error getting tools from ${server.name}:`, error);
            }
        }
        return allTools;
    }
    async callMCPTool(toolName, args) {
        for (const server of this.mcpServers) {
            try {
                const response = await server.client.callTool({
                    name: toolName,
                    arguments: args
                });
                return response;
            }
            catch (error) {
                // Try next server
                continue;
            }
        }
        throw new Error(`Tool ${toolName} not found on any MCP server`);
    }
    async chatWithAI(message) {
        const spinner = ora('Thinking...').start();
        try {
            // Get available MCP tools for context
            const tools = await this.getMCPTools();
            const toolsContext = tools.length > 0
                ? `\n\nAvailable tools: ${tools.map(t => t.name).join(', ')}`
                : '';
            const response = await this.ollama.chat({
                model: this.currentModel,
                messages: [
                    {
                        role: 'system',
                        content: `You are a helpful AI assistant with access to file system tools. You can help users navigate and work with files and directories.${toolsContext}`
                    },
                    {
                        role: 'user',
                        content: message
                    }
                ],
                stream: false
            });
            spinner.stop();
            console.log(chalk.cyan('\n🤖 AI Response:'));
            console.log(chalk.white(response.message.content));
            // Check if the AI wants to use any tools
            if (message.toLowerCase().includes('list') || message.toLowerCase().includes('file') || message.toLowerCase().includes('directory')) {
                console.log(chalk.yellow('\n💡 Tip: You can use MCP tools directly with commands like:'));
                console.log(chalk.gray('  - list_files [path]'));
                console.log(chalk.gray('  - list_directories [path]'));
                console.log(chalk.gray('  - get_file_content <file_path>'));
            }
        }
        catch (error) {
            spinner.fail('Error communicating with AI');
            console.error(error);
        }
    }
    async runInteractiveMode() {
        while (true) {
            const { action } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'action',
                    message: 'What would you like to do?',
                    choices: [
                        { name: '💬 Chat with AI', value: 'chat' },
                        { name: '🔧 Use MCP Tool', value: 'mcp' },
                        { name: '🔄 Change Model', value: 'model' },
                        { name: '📋 List Available Tools', value: 'tools' },
                        { name: '❌ Exit', value: 'exit' }
                    ]
                }
            ]);
            switch (action) {
                case 'chat':
                    const { message } = await inquirer.prompt([
                        {
                            type: 'input',
                            name: 'message',
                            message: 'Enter your message:'
                        }
                    ]);
                    await this.chatWithAI(message);
                    break;
                case 'mcp':
                    await this.runMCPTool();
                    break;
                case 'model':
                    await this.changeModel();
                    break;
                case 'tools':
                    await this.listTools();
                    break;
                case 'exit':
                    console.log(chalk.blue('Goodbye! 👋'));
                    process.exit(0);
            }
            console.log(); // Add spacing
        }
    }
    async runMCPTool() {
        const tools = await this.getMCPTools();
        if (tools.length === 0) {
            console.log(chalk.yellow('No MCP tools available'));
            return;
        }
        const { toolName } = await inquirer.prompt([
            {
                type: 'list',
                name: 'toolName',
                message: 'Select a tool:',
                choices: tools.map(tool => ({
                    name: `${tool.name} - ${tool.description}`,
                    value: tool.name
                }))
            }
        ]);
        const tool = tools.find(t => t.name === toolName);
        if (!tool)
            return;
        // Get tool arguments
        const args = {};
        if (tool.inputSchema?.properties) {
            for (const [key, prop] of Object.entries(tool.inputSchema.properties)) {
                const propTyped = prop;
                const { value } = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'value',
                        message: `Enter ${key}${propTyped.description ? ` (${propTyped.description})` : ''}:`,
                        default: propTyped.default || ''
                    }
                ]);
                if (value)
                    args[key] = value;
            }
        }
        const spinner = ora('Executing tool...').start();
        try {
            const result = await this.callMCPTool(toolName, args);
            spinner.succeed('Tool executed successfully');
            console.log(chalk.green('\n📄 Result:'));
            console.log(result.content[0].text);
        }
        catch (error) {
            spinner.fail('Tool execution failed');
            console.error(error);
        }
    }
    async listTools() {
        const tools = await this.getMCPTools();
        if (tools.length === 0) {
            console.log(chalk.yellow('No MCP tools available'));
            return;
        }
        console.log(chalk.blue('\n🔧 Available MCP Tools:'));
        tools.forEach(tool => {
            console.log(chalk.white(`  • ${tool.name}: ${tool.description}`));
        });
    }
    async cleanup() {
        for (const server of this.mcpServers) {
            try {
                await server.client.close();
                server.process.kill();
            }
            catch (error) {
                console.error('Error cleaning up MCP server:', error);
            }
        }
    }
}
// CLI interface
program
    .name('ai-cli-agent')
    .description('AI CLI Agent with MCP server integration')
    .version('1.0.0')
    .option('-m, --model <model>', 'Ollama model to use', 'llama3.2')
    .option('--chat <message>', 'Send a direct message to the AI')
    .action(async (options) => {
    const agent = new AICLIAgent();
    // Handle cleanup on exit
    process.on('SIGINT', async () => {
        console.log(chalk.yellow('\n\nShutting down...'));
        await agent.cleanup();
        process.exit(0);
    });
    try {
        await agent.initialize();
        if (options.chat) {
            await agent.chatWithAI(options.chat);
        }
        else {
            await agent.runInteractiveMode();
        }
    }
    catch (error) {
        console.error('Error:', error);
        await agent.cleanup();
        process.exit(1);
    }
});
program.parse();
