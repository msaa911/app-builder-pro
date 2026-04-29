/**
 * templates.ts — LPL-007
 * Static template data for TemplatesPage.
 * 6 curated templates in 2 categories.
 */

export interface TemplateItem {
  id: string;
  name: string;
  description: string;
  prompt: string;
  icon: string;
  category: string;
}

export interface TemplateCategory {
  id: string;
  label: string;
  emoji: string;
}

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  { id: 'websites', label: 'Websites', emoji: '🌐' },
  { id: 'apps', label: 'Apps', emoji: '📱' },
];

export const templates: TemplateItem[] = [
  // 🌐 Websites
  {
    id: 'portfolio',
    name: 'Portfolio',
    description: 'A modern personal portfolio with projects, about section, and contact form.',
    prompt:
      'Build a modern personal portfolio website with a hero section, projects gallery, about section, and a contact form. Use a clean design with smooth animations.',
    icon: '🌐',
    category: 'websites',
  },
  {
    id: 'blog',
    name: 'Blog',
    description: 'A clean blog layout with post list, categories, and reading view.',
    prompt:
      'Build a clean blog website with a post list, category filters, and a reading view. Include a sidebar with recent posts and categories.',
    icon: '🌐',
    category: 'websites',
  },
  {
    id: 'landing-page',
    name: 'Landing Page',
    description: 'A high-converting landing page with hero, features, pricing, and CTA sections.',
    prompt:
      'Build a high-converting landing page with a hero section, feature highlights, pricing cards, testimonials, and a call-to-action footer.',
    icon: '🌐',
    category: 'websites',
  },
  // 📱 Apps
  {
    id: 'todo-app',
    name: 'Todo App',
    description: 'A task management app with add, complete, filter, and delete functionality.',
    prompt:
      'Build a todo app with the ability to add tasks, mark them as complete, filter by status (all, active, completed), and delete tasks. Use local storage for persistence.',
    icon: '📱',
    category: 'apps',
  },
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'A data dashboard with stats cards, charts, and a recent activity feed.',
    prompt:
      'Build a data dashboard with stats cards at the top, charts for visualizing data trends, and a recent activity feed on the side. Use a clean dark theme.',
    icon: '📱',
    category: 'apps',
  },
  {
    id: 'chat-app',
    name: 'Chat App',
    description: 'A real-time chat interface with message history, input area, and user list.',
    prompt:
      'Build a chat application with a message history area, text input with a send button, and a sidebar showing connected users. Include message timestamps and user avatars.',
    icon: '📱',
    category: 'apps',
  },
];
