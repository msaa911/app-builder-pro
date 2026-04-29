/**
 * TemplatesPage.test.tsx — LPL-008, LPL-009
 * Tests for TemplatesPage component: renders categories, cards, navigation
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import TemplatesPage from '../TemplatesPage';

// ─── Mocks ───────────────────────────────────────────────────────────

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('lucide-react', () => ({
  Sparkles: () => <span data-testid="icon-sparkles">Sparkles</span>,
  ArrowLeft: () => <span data-testid="icon-arrow-left">ArrowLeft</span>,
}));

// ─── Test Helpers ────────────────────────────────────────────────────

function renderTemplates() {
  return render(
    <MemoryRouter>
      <TemplatesPage />
    </MemoryRouter>
  );
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('TemplatesPage', () => {
  // ── Page Structure ──────────────────────────────────────────────────

  describe('page structure', () => {
    it('should render page container', () => {
      renderTemplates();
      expect(screen.getByTestId('templates-container')).toBeInTheDocument();
    });

    it('should render "Templates" heading', () => {
      renderTemplates();
      expect(screen.getByRole('heading', { name: /templates/i })).toBeInTheDocument();
    });

    it('should render logo link to home', () => {
      renderTemplates();
      const logoLink = screen.getByTestId('logo-link');
      expect(logoLink).toHaveAttribute('href', '/');
    });

    it('should render a "Back" link to home', () => {
      renderTemplates();
      const backLink = screen.getByTestId('templates-back-link');
      expect(backLink).toHaveAttribute('href', '/');
    });
  });

  // ── Category Sections ──────────────────────────────────────────────

  describe('category sections', () => {
    it('should render 2 category section headers', () => {
      renderTemplates();
      const categoryHeaders = screen.getAllByTestId('template-category-header');
      expect(categoryHeaders).toHaveLength(2);
    });

    it('should render "Websites" category header', () => {
      renderTemplates();
      expect(screen.getByText(/🌐 Websites/)).toBeInTheDocument();
    });

    it('should render "Apps" category header', () => {
      renderTemplates();
      expect(screen.getByText(/📱 Apps/)).toBeInTheDocument();
    });
  });

  // ── Template Cards ─────────────────────────────────────────────────

  describe('template cards', () => {
    it('should render 6 template cards', () => {
      renderTemplates();
      const cards = screen.getAllByTestId('template-card');
      expect(cards).toHaveLength(6);
    });

    it('should render each template name', () => {
      renderTemplates();
      const names = ['Portfolio', 'Blog', 'Landing Page', 'Todo App', 'Dashboard', 'Chat App'];
      names.forEach((name) => {
        expect(screen.getByText(name)).toBeInTheDocument();
      });
    });

    it('should render each template description', () => {
      renderTemplates();
      // Check for key phrases from each template description
      expect(screen.getByText(/personal portfolio/i)).toBeInTheDocument();
      expect(screen.getByText(/todo app/i)).toBeInTheDocument();
    });

    it('should render "Use Template" link for each template', () => {
      renderTemplates();
      const useLinks = screen.getAllByTestId('template-use-link');
      expect(useLinks).toHaveLength(6);
      useLinks.forEach((link) => {
        expect(link).toHaveTextContent('Use Template');
      });
    });
  });

  // ── Navigation ─────────────────────────────────────────────────────

  describe('navigation', () => {
    it('should have Use Template buttons that are associated with /builder links', () => {
      renderTemplates();
      // Each template card should have a link that goes to /builder
      const templateLinks = screen.getAllByTestId('template-use-link');
      expect(templateLinks).toHaveLength(6);
      templateLinks.forEach((link) => {
        expect(link).toHaveAttribute('href', '/builder');
      });
    });
  });
});
