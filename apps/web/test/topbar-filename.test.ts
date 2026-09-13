import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { useDocumentStore } from '../src/store/document/useDocumentStore.js';
import { TopBarFilename } from '../src/components/shell/TopBarFilename.js';
import { TopBar } from '../src/components/shell/TopBar.js';
import { DEFAULT_A4_TEMPLATE } from '../src/store/defaultTemplate.js';

describe('TopBar Filename Responsive Display & Popover', () => {
  beforeEach(() => {
    useDocumentStore.getState().resetSession(DEFAULT_A4_TEMPLATE, 'Untitled-Template.uts');
    useDocumentStore.setState({ isDirty: false });
  });

  describe('1. Canonical Filename Rendering & Source of Truth', () => {
    it('renders the default filename from useDocumentStore', () => {
      const html = renderToString(React.createElement(TopBarFilename));
      expect(html).toContain('Untitled-Template.uts');
      expect(html).toContain('title="Untitled-Template.uts (Saved)"');
    });

    it('immediately updates rendered output when filename changes in document store', () => {
      useDocumentStore.getState().setFilename('Annual_Report_2026.uts');
      const html = renderToString(React.createElement(TopBarFilename));
      expect(html).toContain('Annual_Report_2026.uts');
      expect(html).toContain('title="Annual_Report_2026.uts (Saved)"');
    });

    it('reflects dirty / unsaved changes status in title and aria-label', () => {
      useDocumentStore.getState().setFilename('Invoice_Draft.uts');
      useDocumentStore.setState({ isDirty: true });

      const html = renderToString(React.createElement(TopBarFilename));
      expect(html).toContain('Invoice_Draft.uts');
      expect(html).toContain('title="Invoice_Draft.uts (Unsaved changes)"');
      expect(html).toContain('Unsaved changes');
      expect(html).toContain('animate-pulse');
    });

    it('reflects saved status when isDirty is false', () => {
      useDocumentStore.getState().setFilename('Invoice_Final.uts');
      useDocumentStore.setState({ isDirty: false });

      const html = renderToString(React.createElement(TopBarFilename));
      expect(html).toContain('Invoice_Final.uts');
      expect(html).toContain('title="Invoice_Final.uts (Saved)"');
      expect(html).toContain('bg-emerald-500');
    });
  });

  describe('2. Responsive Layout & Truncation Classes', () => {
    it('applies truncate and min-w-0 to enable fluid shrinkage without breaking layout', () => {
      const html = renderToString(React.createElement(TopBarFilename));
      // Verify outer container is shrinkable
      expect(html).toContain('min-w-0');
      // Verify inner text span has truncate and min-w-0
      expect(html).toContain('truncate');
    });

    it('renders in TopBar with responsive breadcrumb container and collapse-friendly brand text', () => {
      const html = renderToString(React.createElement(TopBar));
      expect(html).toContain('UniTemplate');
      expect(html).toContain('hidden sm:inline');
      expect(html).toContain('Untitled-Template.uts');
    });
  });

  describe('3. Filename Edge Cases', () => {
    it('handles short filename cleanly', () => {
      useDocumentStore.getState().setFilename('a.uts');
      const html = renderToString(React.createElement(TopBarFilename));
      expect(html).toContain('a.uts');
      expect(html).toContain('title="a.uts (Saved)"');
    });

    it('handles filename with spaces', () => {
      useDocumentStore.getState().setFilename('My Template Document 2026.uts');
      const html = renderToString(React.createElement(TopBarFilename));
      expect(html).toContain('My Template Document 2026.uts');
      expect(html).toContain('title="My Template Document 2026.uts (Saved)"');
    });

    it('handles very long filename (100+ chars) safely with title attribute and truncate', () => {
      const veryLong = 'enterprise_super_detailed_accounting_template_version_2026_q4_final_approved_draft_with_extra_tables.uts';
      useDocumentStore.getState().setFilename(veryLong);
      const html = renderToString(React.createElement(TopBarFilename));

      // The full filename is completely preserved in the HTML and in the title tooltip
      expect(html).toContain(veryLong);
      expect(html).toContain(`title="${veryLong} (Saved)"`);
      expect(html).toContain('truncate');
    });

    it('updates immediately after new document (resetSession)', () => {
      useDocumentStore.getState().resetSession(DEFAULT_A4_TEMPLATE, 'Fresh-New-Template.uts');
      const html = renderToString(React.createElement(TopBarFilename));
      expect(html).toContain('Fresh-New-Template.uts');
    });

    it('preserves filename when passed via props directly', () => {
      const html = renderToString(React.createElement(TopBarFilename, { filename: 'PropOverride.uts', isDirty: true }));
      expect(html).toContain('PropOverride.uts');
      expect(html).toContain('title="PropOverride.uts (Unsaved changes)"');
    });
  });

  describe('4. Accessibility & Interactive Attributes', () => {
    it('provides accessible button with aria-haspopup="dialog" and aria-expanded="false" by default', () => {
      const html = renderToString(React.createElement(TopBarFilename));
      expect(html).toContain('aria-haspopup="dialog"');
      expect(html).toContain('aria-expanded="false"');
      expect(html).toContain('aria-label=');
    });

    it('includes document icon, dropdown chevron, and status indicator inside the trigger', () => {
      const html = renderToString(React.createElement(TopBarFilename));
      // Document icon (FileText)
      expect(html).toContain('lucide-file-text');
      // Chevron indicator (ChevronDown)
      expect(html).toContain('lucide-chevron-down');
    });
  });

  describe('5. Popover Document Details Dialog', () => {
    it('renders document details popover card when defaultOpen is true', () => {
      const veryLong = 'quarterly_financial_report_template_2026_q3_final_revised_long_name.uts';
      useDocumentStore.getState().setFilename(veryLong);
      useDocumentStore.setState({ isDirty: true });

      const html = renderToString(React.createElement(TopBarFilename, { defaultOpen: true }));

      // Popover structure
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-label="Document details"');
      expect(html).toContain('Document Details');

      // Complete un-truncated filename in full display
      expect(html).toContain(veryLong);
      expect(html).toContain('break-all select-all');

      // Copy filename button
      expect(html).toContain('Copy');
      expect(html).toContain('aria-label="Copy full filename"');

      // Status indicator
      expect(html).toContain('Unsaved changes');

      // File format
      expect(html).toContain('Universe Template (.uts)');

      // Storage target
      expect(html).toContain('Browser Session (Virtual)');

      // Close button
      expect(html).toContain('aria-label="Close document details"');

      // Trigger state
      expect(html).toContain('aria-expanded="true"');
    });

    it('shows "All changes saved" in popover when document is clean', () => {
      useDocumentStore.getState().setFilename('CleanDocument.uts');
      useDocumentStore.setState({ isDirty: false });

      const html = renderToString(React.createElement(TopBarFilename, { defaultOpen: true }));
      expect(html).toContain('All changes saved');
    });
  });
});

