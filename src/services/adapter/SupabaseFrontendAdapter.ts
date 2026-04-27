/**
 * SupabaseFrontendAdapter
 * CHANGE 6 - Supabase Frontend Adapter
 *
 * Transforms generated React project files to work with a newly created
 * Supabase backend. This includes:
 * - Injecting Supabase client configuration
 * - Adding authentication hooks (if auth detected)
 * - Transforming import statements for auth/database usage
 */

import type { ProjectFile } from '../../types';
import type { AdapterConfig, AdaptedProject, TransformContext, EntityDefinition } from './types';
import type { Entity } from '../analyzer/types';
import { supabaseClientTemplate } from './templates/supabaseClient';
import { useAuthTemplate } from './templates/useAuth';

/**
 * Frontend adapter for Supabase integration.
 *
 * Takes a generated React project and transforms it to work with a
 * newly created Supabase backend. Handles client injection, auth hooks,
 * and import transformations.
 *
 * @example
 * ```ts
 * const adapter = new SupabaseFrontendAdapter();
 * const result = adapter.adapt({
 *   files: generatedFiles,
 *   backendResult: creationResult,
 *   requirements: detectedRequirements,
 * });
 *
 * if (!result.skipped) {
 *   console.log('Injected:', result.injectedFiles);
 *   console.log('Transformed:', result.transformedFiles);
 * }
 * ```
 */
export class SupabaseFrontendAdapter {
  /**
   * Adapt a generated project to work with Supabase backend.
   *
   * @param config - Adapter configuration with files and backend info
   * @returns Adapted project with transformed files
   */
  adapt(config: AdapterConfig): AdaptedProject {
    // Check if adaptation should be skipped
    if (config.skipAdaptation) {
      return {
        files: config.files,
        injectedFiles: [],
        transformedFiles: [],
        skipped: true,
        reason: 'skipAdaptation flag is true',
      };
    }

    // Check if we have backend and requirements to work with
    if (!this.shouldAdapt(config)) {
      return {
        files: config.files,
        injectedFiles: [],
        transformedFiles: [],
        skipped: true,
        reason: 'No backend result or requirements available',
      };
    }

    // Detect what needs to be transformed
    const context = this.detectNeeds(config);
    if (!context) {
      return {
        files: config.files,
        injectedFiles: [],
        transformedFiles: [],
        skipped: true,
        reason: 'Could not determine transformation context',
      };
    }

    // Apply transformations
    let files = [...config.files];
    const injectedFiles: string[] = [];
    const transformedFiles: string[] = [];

    // Inject Supabase client
    const clientResult = this.injectSupabaseClient(files, context);
    files = clientResult.files;
    injectedFiles.push(...clientResult.injected);

    // Inject auth hook if needed
    if (context.hasAuth) {
      const authResult = this.injectUseAuth(files, context);
      files = authResult.files;
      injectedFiles.push(...authResult.injected);
    }

    // Transform imports in components
    const importResult = this.transformImports(files, context);
    files = importResult.files;
    transformedFiles.push(...importResult.transformed);

    return {
      files,
      injectedFiles,
      transformedFiles,
      skipped: false,
    };
  }

  /**
   * Check if adaptation should proceed.
   *
   * Returns true if:
   * - backendResult exists
   * - requirements exists
   * - At least one of: hasAuth, hasStorage, or entities present
   *
   * @param config - Adapter configuration
   * @returns Whether adaptation should proceed
   */
  private shouldAdapt(config: AdapterConfig): boolean {
    if (!config.backendResult || !config.requirements) {
      return false;
    }

    const { hasAuth, hasStorage, entities } = config.requirements;
    return hasAuth || hasStorage || (entities && entities.length > 0);
  }

  /**
   * Detect what needs to be transformed.
   *
   * Extracts transformation context from the config, including:
   * - Supabase credentials
   * - Auth/storage flags
   * - Entity definitions
   *
   * @param config - Adapter configuration
   * @returns Transform context or null if cannot be determined
   */
  private detectNeeds(config: AdapterConfig): TransformContext | null {
    if (!config.backendResult || !config.requirements) {
      return null;
    }

    const { projectUrl, anonKey } = config.backendResult;
    const { hasAuth, hasStorage, entities } = config.requirements;

    // Convert entities to simplified format
    const entityDefinitions: EntityDefinition[] = entities.map((entity: Entity) => ({
      name: entity.name,
      typeName: entity.typeName,
      fields: entity.fields.map((field) => ({
        name: field.name,
        type: field.type,
        isOptional: field.isOptional,
      })),
    }));

    return {
      projectUrl,
      anonKey,
      hasAuth: hasAuth || false,
      hasStorage: hasStorage || false,
      entities: entityDefinitions,
    };
  }

  /**
   * Inject Supabase client file.
   *
   * Creates src/lib/supabase.ts with the Supabase client configuration.
   *
   * @param files - Current file array
   * @param context - Transformation context
   * @returns Updated files and list of injected paths
   */
  private injectSupabaseClient(
    files: ProjectFile[],
    context: TransformContext
  ): { files: ProjectFile[]; injected: string[] } {
    const clientPath = 'src/lib/supabase.ts';

    // Check if file already exists
    const existingIndex = files.findIndex((f) => f.path === clientPath);
    if (existingIndex !== -1) {
      // File exists, merge or skip (design decision: skip for now)
      return { files, injected: [] };
    }

    // Generate client content
    const content = supabaseClientTemplate(context.projectUrl, context.anonKey);

    // Create lib directory structure if needed
    const newFiles = [...files];

    // Add the client file
    newFiles.push({
      path: clientPath,
      content,
    });

    return { files: newFiles, injected: [clientPath] };
  }

  /**
   * Inject authentication hook.
   *
   * Creates src/hooks/useAuth.ts with auth helper functions.
   * Only called if hasAuth is true.
   *
   * @param files - Current file array
   * @param context - Transformation context
   * @returns Updated files and list of injected paths
   */
  private injectUseAuth(
    files: ProjectFile[],
    _context: TransformContext
  ): { files: ProjectFile[]; injected: string[] } {
    const authPath = 'src/hooks/useAuth.ts';

    // Check if file already exists
    const existingIndex = files.findIndex((f) => f.path === authPath);
    if (existingIndex !== -1) {
      return { files, injected: [] };
    }

    // Generate auth hook content
    const content = useAuthTemplate();

    // Add the auth hook file
    const newFiles = [...files, { path: authPath, content }];

    return { files: newFiles, injected: [authPath] };
  }

  /**
   * Transform imports in components.
   *
   * Adds necessary import statements to components that need
   * Supabase client or auth functionality.
   *
   * @param files - Current file array
   * @param context - Transformation context
   * @returns Updated files and list of transformed paths
   */
  private transformImports(
    files: ProjectFile[],
    context: TransformContext
  ): { files: ProjectFile[]; transformed: string[] } {
    const transformed: string[] = [];
    const newFiles = [...files];

    // Find components that might need auth/database imports
    // For now, we look for files that reference 'user' or entity names
    const needsAuthImport = context.hasAuth;
    const needsDatabaseImport = context.entities.length > 0;

    if (!needsAuthImport && !needsDatabaseImport) {
      return { files: newFiles, transformed: [] };
    }

    // Look for component files that might need imports
    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i];
      const filePath = file.path;

      // Only transform TypeScript/TSX files in src
      if (
        !filePath.startsWith('src/') ||
        (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx'))
      ) {
        continue;
      }

      // Skip our own injected files
      if (filePath === 'src/lib/supabase.ts' || filePath === 'src/hooks/useAuth.ts') {
        continue;
      }

      const originalContent = file.content ?? '';
      let newContent = originalContent;
      let wasTransformed = false;

      // Check if this file needs supabase client import
      if (this.needsSupabaseImport(originalContent, context)) {
        const relativePath = this.getRelativePath(filePath, 'src/lib/supabase.ts');
        const importStatement = `import { supabase } from '${relativePath}';`;
        newContent = this.addImport(newContent, importStatement);
        wasTransformed = true;
      }

      // Check if this file needs useAuth import
      if (needsAuthImport && this.needsAuthHook(originalContent)) {
        const relativePath = this.getRelativePath(filePath, 'src/hooks/useAuth.ts');
        const importStatement = `import { useAuth } from '${relativePath}';`;
        newContent = this.addImport(newContent, importStatement);
        wasTransformed = true;
      }

      if (wasTransformed) {
        newFiles[i] = { ...file, content: newContent };
        transformed.push(filePath);
      }
    }

    return { files: newFiles, transformed };
  }

  /**
   * Check if a file needs Supabase client import.
   *
   * @param content - File content
   * @param context - Transform context
   * @returns Whether import is needed
   */
  private needsSupabaseImport(content: string, context: TransformContext): boolean {
    // Check if already has supabase import
    if (content.includes('from ') && content.includes('supabase')) {
      return false;
    }

    // Check if file references entities that would use database
    for (const entity of context.entities) {
      if (content.includes(entity.name)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a file needs useAuth hook import.
   *
   * @param content - File content
   * @returns Whether import is needed
   */
  private needsAuthHook(content: string): boolean {
    // Check if already has useAuth import
    if (content.includes('useAuth')) {
      return false;
    }

    // Check for auth-related patterns
    const authPatterns = ['signIn', 'signUp', 'signOut', 'user', 'login', 'register', 'auth'];
    return authPatterns.some((pattern) => content.includes(pattern));
  }

  /**
   * Calculate relative path from one file to another.
   *
   * @param fromFile - Source file path (e.g., 'src/components/App.tsx')
   * @param toFile - Target file path (e.g., 'src/lib/supabase.ts')
   * @returns Relative path (e.g., '../lib/supabase')
   */
  private getRelativePath(fromFile: string, toFile: string): string {
    // Normalize paths
    const fromParts = fromFile.split('/');
    const toParts = toFile.split('/');

    // Remove filename from source
    fromParts.pop();

    // Find common prefix
    let commonLength = 0;
    while (
      commonLength < fromParts.length &&
      commonLength < toParts.length &&
      fromParts[commonLength] === toParts[commonLength]
    ) {
      commonLength++;
    }

    // Build relative path
    const upLevels = fromParts.length - commonLength;
    const downPath = toParts.slice(commonLength).join('/');

    // Remove extension from target
    const pathWithoutExt = downPath.replace(/\.(ts|tsx)$/, '');

    // Build the relative path
    if (upLevels === 0) {
      return `./${pathWithoutExt}`;
    }

    const upPath = '../'.repeat(upLevels);
    return `${upPath}${pathWithoutExt}`;
  }

  /**
   * Add an import statement to file content.
   *
   * Places the import after existing imports, before other code.
   *
   * @param content - File content
   * @param importStatement - Import to add (e.g., "import { supabase } from '../lib/supabase';")
   * @returns Updated content with import added
   */
  private addImport(content: string, importStatement: string): string {
    // Find the last import statement
    const lines = content.split('\n');
    let lastImportIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('import ') && (line.includes("from '") || line.includes('from "'))) {
        lastImportIndex = i;
      }
    }

    // If no imports found, add at the beginning
    if (lastImportIndex === -1) {
      return `${importStatement}\n\n${content}`;
    }

    // Add after the last import
    const before = lines.slice(0, lastImportIndex + 1).join('\n');
    const after = lines.slice(lastImportIndex + 1).join('\n');

    return `${before}\n${importStatement}\n${after}`;
  }
}
