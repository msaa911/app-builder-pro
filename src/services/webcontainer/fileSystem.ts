import { type FileSystemTree, type ProjectFile } from '../../types';

export function filesToTree(files: ProjectFile[]): FileSystemTree {
  const tree: FileSystemTree = {};

  files.forEach((file) => {
    const parts = file.path.split('/');
    let current = tree;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast) {
        current[part] = {
          file: {
            contents: file.content ?? '',
          },
        };
      } else {
        if (!current[part]) {
          current[part] = {
            directory: {},
          };
        }
        // Move into directory
        const node = current[part];
        if ('directory' in node) {
          current = node.directory;
        }
      }
    }
  });

  // Ensure mandatory files for Vite/React if not provided by AI
  if (!tree['index.html']) {
    tree['index.html'] = {
      file: {
        contents: `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Generated App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
        `.trim(),
      },
    };
  }

  if (tree['src'] && 'directory' in tree['src'] && !tree['src'].directory['main.tsx']) {
    tree['src'].directory['main.tsx'] = {
      file: {
        contents: `
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
        `.trim(),
      },
    };
  }

  if (!tree['vite.config.ts']) {
    tree['vite.config.ts'] = {
      file: {
        contents: `
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
})
        `.trim(),
      },
    };
  }

  return tree;
}
