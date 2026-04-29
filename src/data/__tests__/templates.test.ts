/**
 * templates.test.ts — LPL-007
 * Tests for static template data: 6 items, 2 categories
 */
import { describe, it, expect } from 'vitest';
import {
  templates,
  TEMPLATE_CATEGORIES,
  type TemplateItem,
  type TemplateCategory,
} from '../../data/templates';

describe('templates data (LPL-007)', () => {
  it('should have exactly 2 categories', () => {
    expect(TEMPLATE_CATEGORIES).toHaveLength(2);
  });

  it('should have category ids "websites" and "apps"', () => {
    const ids = TEMPLATE_CATEGORIES.map((c) => c.id);
    expect(ids).toContain('websites');
    expect(ids).toContain('apps');
  });

  it('should have exactly 6 templates', () => {
    expect(templates).toHaveLength(6);
  });

  it('should have 3 templates in "websites" category', () => {
    const websites = templates.filter((t) => t.category === 'websites');
    expect(websites).toHaveLength(3);
  });

  it('should have 3 templates in "apps" category', () => {
    const apps = templates.filter((t) => t.category === 'apps');
    expect(apps).toHaveLength(3);
  });

  it('each template should have required fields: id, name, description, prompt, icon, category', () => {
    templates.forEach((t) => {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.prompt).toBeTruthy();
      expect(t.icon).toBeTruthy();
      expect(t.category).toBeTruthy();
    });
  });

  it('each template category should be a valid category id', () => {
    const validCategoryIds = TEMPLATE_CATEGORIES.map((c) => c.id);
    templates.forEach((t) => {
      expect(validCategoryIds).toContain(t.category);
    });
  });

  it('should have unique ids for all templates', () => {
    const ids = templates.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('websites should be: Portfolio, Blog, Landing Page', () => {
    const websites = templates.filter((t) => t.category === 'websites');
    const names = websites.map((t) => t.name);
    expect(names).toContain('Portfolio');
    expect(names).toContain('Blog');
    expect(names).toContain('Landing Page');
  });

  it('apps should be: Todo App, Dashboard, Chat App', () => {
    const apps = templates.filter((t) => t.category === 'apps');
    const names = apps.map((t) => t.name);
    expect(names).toContain('Todo App');
    expect(names).toContain('Dashboard');
    expect(names).toContain('Chat App');
  });
});
