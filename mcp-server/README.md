# MCP Server

A Model Context Protocol (MCP) server that provides file system tools for AI agents and other MCP clients.

## Features

- 📁 **File Listing**: List files and directories in any path
- 📂 **Directory Listing**: List only directories
- 📄 **File Content**: Read the content of any file
- 🔒 **Secure Access**: Operates within a configurable base path
- 🌐 **Remote Support**: Can run locally or on remote servers

## Installation

### Local Installation
```bash
npm install
npm run build
```

### Docker Installation
```bash
# Build the Docker image
docker build -t mcp-server .

# Or use docker-compose
docker-compose build
```

## Usage

### Local Usage

#### As MCP Server
The server is designed to be used by MCP clients (like the AI CLI Agent):

```bash
npm start
```

#### With Custom Base Path
```bash
npm start -- --path /path/to/base/directory
```

#### Development Mode
```bash
npm run dev
```

### Docker Usage

#### Production Mode
```bash
# Run with docker-compose
docker-compose up -d

# Or run directly with Docker
docker run -d --name mcp-server \
  -v /path/to/workspace:/app/workspace:ro \
  mcp-server
```

#### Development Mode
```bash
# Run development container with live reload
docker-compose --profile dev up mcp-server-dev

# Or build and run development container
docker build -f Dockerfile.dev -t mcp-server-dev .
docker run -it --rm \
  -v $(pwd):/app \
  -v /app/node_modules \
  mcp-server-dev
```

#### Custom Base Path with Docker
```bash
# Override the default workspace path
docker run -it --rm \
  -v /your/custom/path:/app/workspace:ro \
  mcp-server node dist/index.js --path /app/workspace
```

## Available Tools

### 1. list_files
List all files and directories in a given path.

**Parameters:**
- `path` (string, optional): Directory path relative to base path (default: ".")

**Example:**
```json
{
  "name": "list_files",
  "arguments": {
    "path": "src"
  }
}
```

### 2. list_directories
List only directories in a given path.

**Parameters:**
- `path` (string, optional): Directory path relative to base path (default: ".")

**Example:**
```json
{
  "name": "list_directories", 
  "arguments": {
    "path": "."
  }
}
```

### 3. get_file_content
Read the content of a specific file.

**Parameters:**
- `path` (string, required): File path relative to base path

**Example:**
```json
{
  "name": "get_file_content",
  "arguments": {
    "path": "package.json"
  }
}
```

## Security

The server operates within a configurable base path to prevent unauthorized access to sensitive files. By default, it uses the current working directory as the base path.

## Error Handling

The server provides clear error messages for common issues:
- Path not found
- Permission denied
- Invalid file/directory operations
- Missing required parameters

## Development

### Local Development
```bash
# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Run built version
npm start
```

### Docker Development
```bash
# Build development image
docker build -f Dockerfile.dev -t mcp-server-dev .

# Run development container with live reload
docker-compose --profile dev up mcp-server-dev

# Or run interactively
docker run -it --rm \
  -v $(pwd):/app \
  -v /app/node_modules \
  mcp-server-dev
```

## Integration

This MCP server is designed to work with:
- AI CLI Agent (included in this workspace)
- Any MCP-compatible client
- Claude Desktop (with proper configuration)

## Dependencies

- `@modelcontextprotocol/sdk` - MCP server implementation
- `commander` - CLI argument parsing

## Docker Configuration

The project includes comprehensive Docker support:

- **Dockerfile**: Multi-stage production build with security best practices
- **Dockerfile.dev**: Development container with live reload
- **docker-compose.yml**: Orchestration for both production and development
- **.dockerignore**: Optimized build context

### Docker Features

- 🔒 **Security**: Non-root user, read-only workspace mounts
- 🚀 **Performance**: Multi-stage builds, optimized layers
- 🔄 **Development**: Live reload, volume mounts for development
- 📊 **Monitoring**: Health checks and proper logging
- 🛠️ **Flexibility**: Configurable base paths and environments