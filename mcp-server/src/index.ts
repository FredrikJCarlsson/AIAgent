#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { readFile, readdir, stat } from 'fs/promises';
import { join, resolve } from 'path';
import { program } from 'commander';

class FileSystemMCPServer {
  private server: Server;
  private basePath: string;

  constructor(basePath: string = process.cwd()) {
    this.basePath = resolve(basePath);
    this.server = new Server(
      {
        name: 'filesystem-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'list_files',
            description: 'List files and directories in a given path',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'The directory path to list (relative to base path)',
                  default: '.',
                },
              },
            },
          },
          {
            name: 'list_directories',
            description: 'List only directories in a given path',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'The directory path to list (relative to base path)',
                  default: '.',
                },
              },
            },
          },
          {
            name: 'get_file_content',
            description: 'Get the content of a specific file',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'The file path to read (relative to base path)',
                },
              },
              required: ['path'],
            },
          },
        ] as Tool[],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'list_files':
            return await this.listFiles(args.path || '.');
          case 'list_directories':
            return await this.listDirectories(args.path || '.');
          case 'get_file_content':
            return await this.getFileContent(args.path);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    });
  }

  private async listFiles(relativePath: string) {
    const fullPath = join(this.basePath, relativePath);
    const stats = await stat(fullPath);
    
    if (!stats.isDirectory()) {
      throw new Error(`Path ${relativePath} is not a directory`);
    }

    const items = await readdir(fullPath, { withFileTypes: true });
    const fileList = items.map(item => ({
      name: item.name,
      type: item.isDirectory() ? 'directory' : 'file',
      path: join(relativePath, item.name),
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(fileList, null, 2),
        },
      ],
    };
  }

  private async listDirectories(relativePath: string) {
    const fullPath = join(this.basePath, relativePath);
    const stats = await stat(fullPath);
    
    if (!stats.isDirectory()) {
      throw new Error(`Path ${relativePath} is not a directory`);
    }

    const items = await readdir(fullPath, { withFileTypes: true });
    const directories = items
      .filter(item => item.isDirectory())
      .map(item => ({
        name: item.name,
        type: 'directory',
        path: join(relativePath, item.name),
      }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(directories, null, 2),
        },
      ],
    };
  }

  private async getFileContent(relativePath: string) {
    if (!relativePath) {
      throw new Error('File path is required');
    }

    const fullPath = join(this.basePath, relativePath);
    const stats = await stat(fullPath);
    
    if (stats.isDirectory()) {
      throw new Error(`Path ${relativePath} is a directory, not a file`);
    }

    const content = await readFile(fullPath, 'utf-8');
    
    return {
      content: [
        {
          type: 'text',
          text: content,
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MCP File System Server running on stdio');
  }
}

// CLI interface
program
  .name('mcp-server')
  .description('MCP Server with file system tools')
  .version('1.0.0')
  .option('-p, --path <path>', 'Base path for file operations', process.cwd())
  .action(async (options) => {
    const server = new FileSystemMCPServer(options.path);
    await server.run();
  });

program.parse();