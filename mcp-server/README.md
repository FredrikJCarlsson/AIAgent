# MCP Server

A Model Context Protocol (MCP) server that provides file system tools for AI agents and other MCP clients.

## Features

- 📁 **File Listing**: List files and directories in any path
- 📂 **Directory Listing**: List only directories
- 📄 **File Content**: Read the content of any file
- 🔒 **Secure Access**: Operates within a configurable base path
- 🌐 **Remote Support**: Can run locally or on remote servers

## Installation

```bash
npm install
npm run build
```

## Usage

### As MCP Server
The server is designed to be used by MCP clients (like the AI CLI Agent):

```bash
npm start
```

### With Custom Base Path
```bash
npm start -- --path /path/to/base/directory
```

### Development Mode
```bash
npm run dev
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

```bash
# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Run built version
npm start
```

## Integration

This MCP server is designed to work with:
- AI CLI Agent (included in this workspace)
- Any MCP-compatible client
- Claude Desktop (with proper configuration)

## Dependencies

- `@modelcontextprotocol/sdk` - MCP server implementation
- `commander` - CLI argument parsing