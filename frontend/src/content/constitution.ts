import constitutionMarkdown from './constitution.md?raw';
import { parseConstitutionMarkdown, type ConstitutionDocument } from './parseConstitutionMarkdown';

export type {
  ConstitutionDocument,
  ConstitutionSection,
  ConstitutionBlock,
  ConstitutionInline,
  ConstitutionListItem,
  ConstitutionTable,
} from './parseConstitutionMarkdown';
export { parseConstitutionMarkdown, parseInlineMarkdown, slugifyHeading } from './parseConstitutionMarkdown';

export const CONSTITUTION_MARKDOWN = constitutionMarkdown;

export const constitutionDocument: ConstitutionDocument =
  parseConstitutionMarkdown(CONSTITUTION_MARKDOWN);

export function getConstitutionToc(document: ConstitutionDocument = constitutionDocument) {
  return document.sections.map((section) => ({
    id: section.id,
    title: section.title,
    children: section.children.map((child) => ({
      id: child.id,
      title: child.title,
    })),
  }));
}
