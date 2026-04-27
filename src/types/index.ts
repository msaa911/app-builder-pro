export type FileSystemTree = {
  [name: string]: DirectoryNode | FileNode;
};

export type DirectoryNode = {
  directory: FileSystemTree;
};

export type FileNode = {
  file: {
    contents: string | Uint8Array;
  };
};

export interface ProjectFile {
  path: string;
  content?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  files?: ProjectFile[];
  timestamp: number;
}

export interface AIResponse {
  message: string;
  files?: ProjectFile[];
  warnings?: string[]; // array de warnings del parsing
  explanation?: string;
}

export type BuilderState = 'idle' | 'generating' | 'installing' | 'running' | 'error';

export type ConsoleLogType = 'info' | 'success' | 'warn' | 'error';

export interface ConsoleLog {
  type: ConsoleLogType;
  text: string;
  timestamp: string; // HH:MM:SS format
}
