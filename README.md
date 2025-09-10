# AI CLI Agent & MCP Server Workspace

This workspace contains two TypeScript applications:

1. **AI CLI Agent** - A command-line interface that connects to local Ollama models and MCP servers
2. **MCP Server** - A Model Context Protocol server that provides file system tools

## Quick Start

1. **Install dependencies:**
   ```bash
   npm run install:all
   ```

2. **Build both applications:**
   ```bash
   npm run build
   ```

3. **Start Ollama** (if not already running):
   ```bash
   ollama serve
   ```

4. **Pull a model** (if you don't have one):
   ```bash
   ollama pull llama3.2
   ```

5. **Run the CLI agent:**
   ```bash
   cd cli-agent
   npm run dev
   ```

## Project Structure

```
├── cli-agent/          # AI CLI Agent application
│   ├── src/
│   │   └── index.ts    # Main CLI application
│   ├── package.json
│   └── tsconfig.json
├── mcp-server/         # MCP Server application
│   ├── src/
│   │   └── index.ts    # MCP server implementation
│   ├── package.json
│   └── tsconfig.json
└── package.json        # Workspace configuration
```

## Features

### AI CLI Agent
- 🤖 Connects to local Ollama models
- 🔧 Integrates with MCP servers
- 💬 Interactive chat interface
- 🎨 Clean, colorful terminal UI
- 🔄 Model switching support

### MCP Server
- 📁 List files and directories
- 📂 List directories only
- 📄 Get file content
- 🌐 Can run locally or remotely
- 🔒 Secure file system access

## Usage

### CLI Agent Commands

```bash
# Interactive mode
npm run dev

# Direct chat
npm run dev -- --chat "List files in current directory"

# Use specific model
npm run dev -- --model llama3.2
```

### MCP Server

The MCP server automatically starts when you run the CLI agent. It provides these tools:

- `list_files [path]` - List files and directories
- `list_directories [path]` - List only directories  
- `get_file_content <file_path>` - Read file content

## Development

### Building
```bash
npm run build
```

### Development Mode
```bash
npm run dev
```

### Individual Project Commands

**CLI Agent:**
```bash
cd cli-agent
npm run dev    # Development mode
npm run build  # Build
npm start      # Run built version
```

**MCP Server:**
```bash
cd mcp-server
npm run dev    # Development mode
npm run build  # Build
npm start      # Run built version
```

## Requirements

- Node.js 18+
- Ollama installed and running
- At least one Ollama model pulled (e.g., `ollama pull llama3.2`)

## Configuration

### Ollama Configuration
The CLI agent connects to Ollama at `http://localhost:11434` by default. Make sure Ollama is running:

```bash
ollama serve
```

### MCP Server Base Path
The MCP server uses the current working directory as the base path by default. You can specify a different path when running the server directly:

```bash
cd mcp-server
npm start -- --path /path/to/base/directory
```

## Troubleshooting

1. **Ollama connection failed**: Make sure Ollama is running (`ollama serve`)
2. **No models available**: Pull a model first (`ollama pull llama3.2`)
3. **MCP server not starting**: Check that the mcp-server is built (`npm run build`)
4. **Permission errors**: Ensure the MCP server has read access to the target directories