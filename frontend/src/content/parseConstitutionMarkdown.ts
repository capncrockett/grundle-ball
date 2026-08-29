export type ConstitutionInline =
  { type: 'text'; text: string } | { type: 'strong'; text: string } | { type: 'em'; text: string };

export type ConstitutionTable = {
  headers: ConstitutionInline[][];
  rows: ConstitutionInline[][][];
};

export type ConstitutionBlock =
  | { type: 'paragraph'; inlines: ConstitutionInline[] }
  | { type: 'list'; ordered: boolean; items: ConstitutionListItem[] }
  | { type: 'table'; table: ConstitutionTable };

export type ConstitutionListItem = {
  inlines: ConstitutionInline[];
  children?: ConstitutionListItem[];
};

export type ConstitutionSection = {
  id: string;
  title: string;
  level: 2 | 3;
  blocks: ConstitutionBlock[];
  children: ConstitutionSection[];
};

export type ConstitutionDocument = {
  title: string;
  sections: ConstitutionSection[];
};

const HEADING_RE = /^(#{1,3})\s+(.+?)\s*$/;
const UNORDERED_ITEM_RE = /^(\s*)[-*+]\s+(.+)$/;
const ORDERED_ITEM_RE = /^(\s*)\d+\.\s+(.+)$/;

const TABLE_ROW_RE = /^\|.+\|$/;
const TABLE_SEPARATOR_RE = /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|$/;

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => cell.trim());
}

function parseTableBlock(
  lines: string[],
  startIndex: number,
): { block: ConstitutionBlock; nextIndex: number } | null {
  if (startIndex + 1 >= lines.length) {
    return null;
  }

  const headerLine = lines[startIndex].trim();
  const separatorLine = lines[startIndex + 1].trim();
  if (!TABLE_ROW_RE.test(headerLine) || !TABLE_SEPARATOR_RE.test(separatorLine)) {
    return null;
  }

  const headers = splitTableRow(headerLine).map((cell) => parseInlineMarkdown(cell));
  const rows: ConstitutionInline[][][] = [];
  let index = startIndex + 2;

  while (index < lines.length) {
    const candidate = lines[index].trim();
    if (!candidate || !TABLE_ROW_RE.test(candidate) || TABLE_SEPARATOR_RE.test(candidate)) {
      break;
    }
    rows.push(splitTableRow(candidate).map((cell) => parseInlineMarkdown(cell)));
    index += 1;
  }

  return {
    block: {
      type: 'table',
      table: { headers, rows },
    },
    nextIndex: index,
  };
}

export function slugifyHeading(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function uniqueSlug(base: string, used: Set<string>): string {
  let candidate = base || 'section';
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${String(suffix)}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

export function parseInlineMarkdown(text: string): ConstitutionInline[] {
  const inlines: ConstitutionInline[] = [];
  const pattern = /(\*\*|__)(.+?)\1|(\*|_)(.+?)\3/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      inlines.push({ type: 'text', text: text.slice(lastIndex, match.index) });
    }

    if (match[1]) {
      inlines.push({ type: 'strong', text: match[2] });
    } else if (match[3]) {
      inlines.push({ type: 'em', text: match[4] });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    inlines.push({ type: 'text', text: text.slice(lastIndex) });
  }

  if (inlines.length === 0) {
    inlines.push({ type: 'text', text });
  }

  return inlines;
}

type FlatSection = {
  id: string;
  title: string;
  level: 2 | 3;
  blocks: ConstitutionBlock[];
};

type OpenList = {
  indent: number;
  ordered: boolean;
  items: ConstitutionListItem[];
};

function attachNestedList(parent: OpenList, nested: OpenList): void {
  const parentItem = parent.items[parent.items.length - 1];
  parentItem.children = nested.items;
}

function parseListBlock(
  lines: string[],
  startIndex: number,
): { block: ConstitutionBlock; nextIndex: number } {
  const stack: OpenList[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      break;
    }

    const unordered = line.match(UNORDERED_ITEM_RE);
    const ordered = unordered ? null : line.match(ORDERED_ITEM_RE);
    const match = unordered ?? ordered;
    if (!match) {
      break;
    }

    const indent = match[1].length;
    const content = match[2];
    const isOrdered = Boolean(ordered);
    const item: ConstitutionListItem = { inlines: parseInlineMarkdown(content) };

    while (stack.length > 0 && stack[stack.length - 1].indent > indent) {
      const closed = stack.pop() as OpenList;
      if (stack.length === 0) {
        stack.push(closed);
        break;
      }
      attachNestedList(stack[stack.length - 1], closed);
    }

    if (stack.length > 0 && stack[stack.length - 1].indent === indent) {
      stack[stack.length - 1].items.push(item);
    } else {
      stack.push({ indent, ordered: isOrdered, items: [item] });
    }

    index += 1;
  }

  while (stack.length > 1) {
    const closed = stack.pop() as OpenList;
    attachNestedList(stack[stack.length - 1], closed);
  }

  if (stack.length === 0) {
    return {
      block: { type: 'list', ordered: false, items: [] },
      nextIndex: index,
    };
  }

  const root = stack[0];
  return {
    block: { type: 'list', ordered: root.ordered, items: root.items },
    nextIndex: index,
  };
}

function nestSections(flat: FlatSection[]): ConstitutionSection[] {
  const roots: ConstitutionSection[] = [];
  let currentH2: ConstitutionSection | null = null;

  for (const section of flat) {
    const node: ConstitutionSection = {
      id: section.id,
      title: section.title,
      level: section.level,
      blocks: section.blocks,
      children: [],
    };

    if (section.level === 2) {
      roots.push(node);
      currentH2 = node;
      continue;
    }

    if (currentH2) {
      currentH2.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export function parseConstitutionMarkdown(markdown: string): ConstitutionDocument {
  const normalized = markdown.replace(/\r\n/g, '\n').trim();
  const lines = normalized.length > 0 ? normalized.split('\n') : [];

  let title = 'Constitution';
  const usedIds = new Set<string>();
  const flatSections: FlatSection[] = [];
  let current: FlatSection | null = null;
  let index = 0;

  const ensureSection = (): FlatSection => {
    if (!current) {
      current = {
        id: uniqueSlug('introduction', usedIds),
        title: 'Introduction',
        level: 2,
        blocks: [],
      };
      flatSections.push(current);
    }
    return current;
  };

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const heading = trimmed.match(HEADING_RE);
    if (heading) {
      const hashes = heading[1];
      const level = hashes.length;
      const headingTitle = heading[2].trim();

      if (level === 1) {
        title = headingTitle;
        index += 1;
        continue;
      }

      // Heading match is limited to #..###, so remaining levels are 2 or 3.
      const sectionLevel: 2 | 3 = level === 2 ? 2 : 3;
      // Section headings are authored with a leading ordinal (e.g. "8. Keepers")
      // to mirror the source document's numbering. Strip it for the displayed
      // title and anchor id so links/TOC entries read as "Keepers" / "#keepers"
      // instead of "8. Keepers" / "#8-keepers".
      const cleanedTitle = headingTitle.replace(/^\d+\.\s+/, '');
      current = {
        id: uniqueSlug(slugifyHeading(cleanedTitle), usedIds),
        title: cleanedTitle,
        level: sectionLevel,
        blocks: [],
      };
      flatSections.push(current);
      index += 1;
      continue;
    }

    const table = parseTableBlock(lines, index);
    if (table) {
      ensureSection().blocks.push(table.block);
      index = table.nextIndex;
      continue;
    }

    if (UNORDERED_ITEM_RE.test(line) || ORDERED_ITEM_RE.test(line)) {
      const { block, nextIndex } = parseListBlock(lines, index);
      ensureSection().blocks.push(block);
      index = nextIndex;
      continue;
    }

    // Paragraph: consume consecutive non-empty, non-heading, non-list lines.
    const paragraphLines: string[] = [trimmed];
    index += 1;
    while (index < lines.length) {
      const next = lines[index];
      const nextTrimmed = next.trim();
      if (!nextTrimmed) break;
      if (HEADING_RE.test(nextTrimmed)) break;
      if (UNORDERED_ITEM_RE.test(next) || ORDERED_ITEM_RE.test(next)) break;
      if (TABLE_ROW_RE.test(nextTrimmed)) break;
      paragraphLines.push(nextTrimmed);
      index += 1;
    }

    ensureSection().blocks.push({
      type: 'paragraph',
      inlines: parseInlineMarkdown(paragraphLines.join(' ')),
    });
  }

  return {
    title,
    sections: nestSections(flatSections),
  };
}
