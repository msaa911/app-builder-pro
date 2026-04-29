import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { templates, TEMPLATE_CATEGORIES } from '../data/templates';
import './TemplatesPage.css';

/**
 * TemplatesPage — Curated starter templates.
 * Phase 4: Full implementation with category sections, template cards, and Use Template links.
 */
const TemplatesPage: React.FC = () => {
  return (
    <div className="templates-container" data-testid="templates-container">
      {/* Background Orbs */}
      <div className="bg-orb orb-1"></div>
      <div className="bg-orb orb-2"></div>

      {/* Header */}
      <header className="templates-header">
        <Link to="/" className="logo-compact" data-testid="logo-link" aria-label="Go to home page">
          <Sparkles className="logo-icon active" />
        </Link>
        <Link to="/" className="btn-back" data-testid="templates-back-link">
          <ArrowLeft size={16} />
          <span>Back</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="templates-main">
        <motion.h1
          className="templates-title"
          data-testid="templates-title"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          Templates
        </motion.h1>

        {TEMPLATE_CATEGORIES.map((category) => {
          const categoryTemplates = templates.filter((t) => t.category === category.id);
          return (
            <section key={category.id} className="template-category">
              <h2 className="template-category-title" data-testid="template-category-header">
                {category.emoji} {category.label}
              </h2>
              <motion.div
                className="template-grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                {categoryTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="template-card glass"
                    data-testid="template-card"
                  >
                    <div className="template-card-icon">{template.icon}</div>
                    <h3 className="template-card-name">{template.name}</h3>
                    <p className="template-card-description">{template.description}</p>
                    <Link
                      to="/builder"
                      state={{ prompt: template.prompt }}
                      className="btn-use-template"
                      data-testid="template-use-link"
                    >
                      Use Template
                    </Link>
                  </div>
                ))}
              </motion.div>
            </section>
          );
        })}
      </main>
    </div>
  );
};

export default TemplatesPage;
