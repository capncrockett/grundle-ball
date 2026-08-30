import {
  parseConstitutionMarkdown,
  parseInlineMarkdown,
  slugifyHeading,
} from './parseConstitutionMarkdown';
import { CONSTITUTION_MARKDOWN, constitutionDocument, getConstitutionToc } from './constitution';

describe('slugifyHeading', () => {
  it('normalizes titles into stable anchor ids', () => {
    expect(slugifyHeading('1. League at a Glance')).toBe('1-league-at-a-glance');
    expect(slugifyHeading('11. Playoffs & Toilet Bowl')).toBe('11-playoffs-toilet-bowl');
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

  it('parses markdown tables', () => {
    const doc = parseConstitutionMarkdown(`# Sample

## Glance

| Setting | Value |
| --- | --- |
| Managers | 12 |
| Buy-in | $25 |
`);

    expect(doc.sections[0].blocks[0]).toMatchObject({
      type: 'table',
      table: {
        headers: [[{ type: 'text', text: 'Setting' }], [{ type: 'text', text: 'Value' }]],
        rows: [
          [[{ type: 'text', text: 'Managers' }], [{ type: 'text', text: '12' }]],
          [[{ type: 'text', text: 'Buy-in' }], [{ type: 'text', text: '$25' }]],
        ],
      },
    });
  });
});

describe('constitution source content', () => {
  it('loads the 2026 production markdown and exposes expected sections', () => {
    expect(CONSTITUTION_MARKDOWN).toContain('# Grundle League Constitution');
    expect(CONSTITUTION_MARKDOWN).toContain('2026 Edition');
    expect(constitutionDocument.title).toBe('Grundle League Constitution');

    const sectionTitles = constitutionDocument.sections.map((section) => section.title);
    expect(sectionTitles).toEqual(
      expect.arrayContaining([
        'League at a Glance',
        'Keepers',
        'Playoffs & Toilet Bowl',
        'Rule & Vote History',
      ]),
    );

    const toc = getConstitutionToc();
    expect(toc.some((item) => item.id === 'keepers')).toBe(true);
    expect(toc.find((item) => item.id === 'rule-vote-history')?.children.map((c) => c.id)).toEqual(
      expect.arrayContaining(['2026', '2020', '2017']),
    );
  });

  it('includes key 2026 rule text from the imported constitution', () => {
    const playoffs = constitutionDocument.sections.find(
      (section) => section.id === 'playoffs-toilet-bowl',
    );
    expect(playoffs).toBeDefined();

    const serialized = JSON.stringify(playoffs);
    expect(serialized).toContain('Highest Points Against');
    expect(serialized).toContain('King (Last Place)');

    const divisions = constitutionDocument.sections.find(
      (section) => section.id === 'regular-season-divisions',
    );
    expect(JSON.stringify(divisions)).toContain('Rumble in the Grundle');

    const glance = constitutionDocument.sections.find(
      (section) => section.id === 'league-at-a-glance',
    );
    expect(glance?.blocks.some((block) => block.type === 'table')).toBe(true);

    const keepers = constitutionDocument.sections.find((section) => section.id === 'keepers');
    const serializedKeepers = JSON.stringify(keepers);
    expect(serializedKeepers).toContain('exactly 1 week (7 days)');
    expect(serializedKeepers).toContain('no more than 2 keepers');
    expect(serializedKeepers).toContain(
      'Owning or acquiring additional draft picks does not increase the cap',
    );
  });
});
