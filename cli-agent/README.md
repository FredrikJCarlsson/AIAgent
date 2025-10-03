# AI CLI Agent

A TypeScript command-line interface that connects to local Ollama models and MCP servers for intelligent file system operations.

## Features

- 🤖 **AI Integration**: Connects to local Ollama models for natural language processing
- 🔧 **MCP Server Integration**: Uses Model Context Protocol servers for tool access
- 💬 **Interactive Chat**: Clean, colorful terminal interface for AI conversations
- 🔄 **Model Switching**: Easy switching between different Ollama models
- 🎨 **Beautiful UI**: Uses chalk for colorful output and inquirer for interactive prompts

## Installation

```bash
npm install
npm run build
```

## Usage

### Interactive Mode
```bash
npm run dev
```

### Direct Chat
```bash
npm run dev -- --chat "List all files in the current directory"
```

### Specify Model
```bash
npm run dev -- --model llama3.2
```

## Available Commands

When running in interactive mode, you can:

1. **💬 Chat with AI** - Have natural language conversations with the AI
2. **🔧 Use MCP Tool** - Directly call MCP server tools
3. **🔄 Change Model** - Switch between available Ollama models
4. **📋 List Available Tools** - See all MCP tools
5. **❌ Exit** - Close the application

## MCP Tools

The agent automatically connects to MCP servers and provides access to:

- `list_files [path]` - List files and directories
- `list_directories [path]` - List only directories
- `get_file_content <file_path>` - Read file content

## Configuration

### Environment Variables
Create a `.env` file in the `cli-agent` directory with the following content:

```bash
# Sentry Configuration
SENTRY_DSN=yourSentrydsn,
```

**Note**: The `.env` file is already included in `.gitignore` and will not be committed to version control.

### Ollama Connection
The agent connects to Ollama at `http://localhost:11434`. Make sure Ollama is running:

```bash
ollama serve
```

### Available Models
Check available models:
```bash
ollama list
```

Pull a new model:
```bash
ollama pull llama3.2
```

## Development

```bash
# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Run built version
npm start
```

## Dependencies

- `@modelcontextprotocol/sdk` - MCP client integration
- `ollama` - Ollama API client
- `chalk` - Terminal colors
- `inquirer` - Interactive prompts
- `ora` - Loading spinners
- `commander` - CLI argument parsing