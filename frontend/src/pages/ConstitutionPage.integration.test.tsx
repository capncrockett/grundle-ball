import { render, screen, within } from '@testing-library/react';
import { ConstitutionPage } from './ConstitutionPage';
import { constitutionDocument, getConstitutionToc } from '../content/constitution';

describe('ConstitutionPage', () => {
  it('renders title, TOC, and major section headings', () => {
    render(<ConstitutionPage />);

expect(
      screen.getByRole('heading', { level: 1, name: /grundle league constitution/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('constitution-page')).toBeInTheDocument();

    const pdfLink = screen.getByTestId('constitution-pdf-link');
    expect(pdfLink).toHaveAttribute(
      'href',
      '/docs/Grundle_League_Constitution_2026_REVIEW_DRAFT_v2.pdf',
    );
    expect(pdfLink).toHaveAttribute('target', '_blank');

    const toc = screen.getByRole('navigation', { name: /constitution table of contents/i });
    expect(toc).toBeInTheDocument();

    for (const section of constitutionDocument.sections) {
      expect(screen.getByRole('heading', { level: 2, name: section.title })).toBeInTheDocument();
      expect(within(toc).getByRole('link', { name: section.title })).toHaveAttribute(
        'href',
        `#${section.id}`,
      );
    }
  });

  it('links every TOC entry to a matching content anchor', () => {
    render(<ConstitutionPage />);

    const toc = getConstitutionToc();
    for (const item of toc) {
      expect(document.getElementById(item.id)).not.toBeNull();
      for (const child of item.children) {
        expect(document.getElementById(child.id)).not.toBeNull();
        expect(screen.getByRole('link', { name: child.title })).toHaveAttribute('href', `#${child.id}`);
      }
    }
  });

it('renders 2026 tables, keeper pending notice, and toilet bowl terminology', () => {
    render(<ConstitutionPage />);

expect(screen.getAllByRole('columnheader', { name: /^Setting$/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('cell', { name: /^Managers$/i })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: /^\$25 per team$/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /^What it means here$/i })).toBeInTheDocument();
    expect(screen.getByText(/PENDING 2026 VOTE/i)).toBeInTheDocument();
    expect(screen.getByText(/King \(Last Place\)/i)).toBeInTheDocument();
expect(screen.getAllByText(/Rumble in the Grundle/i).length).toBeGreaterThanOrEqual(1);
expect(screen.getAllByText(/Highest Points Against/i).length).toBeGreaterThanOrEqual(1);
  });
});
