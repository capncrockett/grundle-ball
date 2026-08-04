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

  it('renders nested board responsibilities and rule-change emphasis', () => {
    render(<ConstitutionPage />);

    expect(screen.getByText(/Help identify collusion within the league\/trades/i)).toBeInTheDocument();
    expect(
      screen.getByText(/In season changes will only be made with full consensus/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/THE CHAMPIONSHIP BELT!!!/i)).toBeInTheDocument();
  });
});
