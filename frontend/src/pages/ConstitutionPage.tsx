import type { ReactNode } from 'react';
import {
  constitutionDocument,
  getConstitutionToc,
  type ConstitutionBlock,
  type ConstitutionInline,
  type ConstitutionListItem,
  type ConstitutionSection,
  type ConstitutionTable,
} from '../content/constitution';

function renderInlines(inlines: ConstitutionInline[]): ReactNode[] {
  return inlines.map((inline, index) => {
    const key = `${inline.type}-${String(index)}-${inline.text.slice(0, 12)}`;
    if (inline.type === 'strong') {
      return (
        <strong key={key} className="font-semibold">
          {inline.text}
        </strong>
      );
    }
    if (inline.type === 'em') {
      return (
        <em key={key} className="italic">
          {inline.text}
        </em>
      );
    }
    return <span key={key}>{inline.text}</span>;
  });
}

function ListItems({ items, ordered }: { items: ConstitutionListItem[]; ordered: boolean }) {
  const ListTag = ordered ? 'ol' : 'ul';
  const listClass = ordered
    ? 'list-decimal pl-5 space-y-2 marker:text-base-content/60'
    : 'list-disc pl-5 space-y-2 marker:text-base-content/60';

  return (
    <ListTag className={listClass}>
      {items.map((item, index) => (
        <li
          key={`item-${String(index)}-${item.inlines
            .map((part) => part.text)
            .join('')
            .slice(0, 24)}`}
        >
          <span>{renderInlines(item.inlines)}</span>
          {item.children && item.children.length > 0 ? (
            <div className="mt-2">
              <ListItems items={item.children} ordered={ordered} />
            </div>
          ) : null}
        </li>
      ))}
    </ListTag>
  );
}

function TableView({ table }: { table: ConstitutionTable }) {
  return (
    <div className="overflow-x-auto rounded-box border border-base-300">
      <table className="table table-zebra table-sm sm:table-md">
        <thead>
          <tr>
            {table.headers.map((header, index) => (
              <th key={`header-${String(index)}`}>{renderInlines(header)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={`row-${String(rowIndex)}`}>
              {row.map((cell, cellIndex) => (
                <td key={`cell-${String(rowIndex)}-${String(cellIndex)}`}>{renderInlines(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BlockView({ block }: { block: ConstitutionBlock }) {
  if (block.type === 'paragraph') {
    return <p className="leading-relaxed text-base-content/90">{renderInlines(block.inlines)}</p>;
  }

  if (block.type === 'table') {
    return <TableView table={block.table} />;
  }

  return <ListItems items={block.items} ordered={block.ordered} />;
}

function SectionView({ section }: { section: ConstitutionSection }) {
  const HeadingTag = section.level === 2 ? 'h2' : 'h3';
  const headingClass =
    section.level === 2
      ? 'text-xl sm:text-2xl font-bold tracking-tight scroll-mt-24'
      : 'text-lg sm:text-xl font-semibold tracking-tight scroll-mt-24';

  return (
    <section aria-labelledby={section.id} className="space-y-4">
      <HeadingTag id={section.id} className={headingClass}>
        {section.title}
      </HeadingTag>
      <div className="space-y-4">
        {section.blocks.map((block, index) => (
          <BlockView key={`${section.id}-block-${String(index)}`} block={block} />
        ))}
      </div>
      {section.children.length > 0 ? (
        <div className="space-y-6 pt-2">
          {section.children.map((child) => (
            <SectionView key={child.id} section={child} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export const CONSTITUTION_PDF_HREF = '/docs/Grundle_League_Constitution_2026_REVIEW_DRAFT_v2.pdf';

export function ConstitutionPage() {
  const document = constitutionDocument;
  const toc = getConstitutionToc(document);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6" data-testid="constitution-page">
      <div className="mb-6 space-y-3">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold">{document.title}</h1>
          <p className="text-sm text-base-content/60">
            2026 Edition. This page is the current source of truth; the linked PDF is an archived
            review draft.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={CONSTITUTION_PDF_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline btn-sm"
            data-testid="constitution-pdf-link"
          >
            Open archived PDF
          </a>
          <a href={CONSTITUTION_PDF_HREF} download className="btn btn-ghost btn-sm">
            Download archived PDF
          </a>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] items-start">
        <aside className="lg:sticky lg:top-4">
          <nav
            aria-label="Constitution table of contents"
            className="card bg-base-100 shadow-sm border border-base-300"
            data-testid="constitution-toc"
          >
            <div className="card-body p-4 gap-3">
              <h2 className="card-title text-base">Contents</h2>
              <ul className="menu menu-sm p-0 gap-1">
                {toc.map((item) => (
                  <li key={item.id}>
                    <a href={`#${item.id}`} className="rounded-md">
                      {item.title}
                    </a>
                    {item.children.length > 0 ? (
                      <ul className="ml-2 border-l border-base-300 pl-2">
                        {item.children.map((child) => (
                          <li key={child.id}>
                            <a href={`#${child.id}`} className="rounded-md text-base-content/80">
                              {child.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </aside>

        <article className="card bg-base-100 shadow-sm border border-base-300">
          <div className="card-body p-5 sm:p-8 space-y-10" data-testid="constitution-content">
            {document.sections.map((section) => (
              <SectionView key={section.id} section={section} />
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}

export default ConstitutionPage;
