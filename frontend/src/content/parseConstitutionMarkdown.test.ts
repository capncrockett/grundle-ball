import {
  parseConstitutionMarkdown,
  parseInlineMarkdown,
  slugifyHeading,
} from './parseConstitutionMarkdown';
import { CONSTITUTION_MARKDOWN, constitutionDocument, getConstitutionToc } from './constitution';

describe('slugifyHeading', () => {
  it('normalizes titles into stable anchor ids', () => {
    expect(slugifyHeading('League Details')).toBe('league-details');
    expect(slugifyHeading("Overtly Unnecessary And Pedantic Constitutional Stuff We Should Never Need.")).toBe(
      'overtly-unnecessary-and-pedantic-constitutional-stuff-we-should-never-need',
    );
  });
});

describe('parseInlineMarkdown', () => {
  it('parses emphasis markers', () => {
    expect(parseInlineMarkdown('Hello **bold** and *italic* text')).toEqual([
      { type: 'text', text: 'Hello ' },
      { type: 'strong', text: 'bold' },
      { type: 'text', text: ' and ' },
      { type: 'em', text: 'italic' },
      { type: 'text', text: ' text' },
    ]);
  });
});

describe('parseConstitutionMarkdown', () => {
  it('parses title, nested sections, paragraphs, and nested lists', () => {
    const markdown = `# Sample Constitution

## League Details

Intro paragraph.

- Top item
  - Nested item
- Another item

### Nested Rules

More detail.

1. First
2. Second
`;

    const doc = parseConstitutionMarkdown(markdown);

    expect(doc.title).toBe('Sample Constitution');
    expect(doc.sections).toHaveLength(1);
    expect(doc.sections[0]).toMatchObject({
      id: 'league-details',
      title: 'League Details',
      level: 2,
    });
    expect(doc.sections[0].blocks[0]).toEqual({
      type: 'paragraph',
      inlines: [{ type: 'text', text: 'Intro paragraph.' }],
    });
    expect(doc.sections[0].blocks[1]).toMatchObject({
      type: 'list',
      ordered: false,
      items: [
        {
          inlines: [{ type: 'text', text: 'Top item' }],
          children: [{ inlines: [{ type: 'text', text: 'Nested item' }] }],
        },
        {
          inlines: [{ type: 'text', text: 'Another item' }],
        },
      ],
    });
    expect(doc.sections[0].children).toHaveLength(1);
    expect(doc.sections[0].children[0]).toMatchObject({
      id: 'nested-rules',
      title: 'Nested Rules',
      level: 3,
    });
    expect(doc.sections[0].children[0].blocks[1]).toMatchObject({
      type: 'list',
      ordered: true,
      items: [
        { inlines: [{ type: 'text', text: 'First' }] },
        { inlines: [{ type: 'text', text: 'Second' }] },
      ],
    });
  });

  it('deduplicates repeated heading slugs', () => {
    const doc = parseConstitutionMarkdown(`# Title

## Season

### 2020 Season

## Archive

### 2020 Season
`);

    expect(doc.sections[0].children[0].id).toBe('2020-season');
    expect(doc.sections[1].children[0].id).toBe('2020-season-2');
  });
});

describe('constitution source content', () => {
  it('loads the production markdown and exposes expected sections', () => {
    expect(CONSTITUTION_MARKDOWN).toContain('# Grundle League Constitution');
    expect(constitutionDocument.title).toBe('Grundle League Constitution');

    const sectionTitles = constitutionDocument.sections.map((section) => section.title);
    expect(sectionTitles).toEqual(
      expect.arrayContaining([
        'League Details',
        'Keepers',
        'Regular Season',
        'Playoffs',
        'Archived Season Amendments',
      ]),
    );

    const toc = getConstitutionToc();
    expect(toc.some((item) => item.id === 'keepers')).toBe(true);
    expect(toc.find((item) => item.id === 'archived-season-amendments')?.children.map((c) => c.id)).toEqual(
      expect.arrayContaining(['2020-season', '2019-season']),
    );
  });

  it('includes key rule text from the imported constitution', () => {
    const playoffs = constitutionDocument.sections.find((section) => section.id === 'playoffs');
    expect(playoffs).toBeDefined();

    const serialized = JSON.stringify(playoffs);
    expect(serialized).toContain('THE CHAMPIONSHIP BELT!!!');
    expect(serialized).toContain('6th seed is awarded to the highest Points For');
  });
});
