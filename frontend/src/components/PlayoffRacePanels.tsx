import type { ReactNode } from 'react';
import type { PlayoffNarratives } from '../pages/narratives';

type NarrativeAccordionProps = {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
};

function NarrativeAccordion({ title, subtitle, children }: NarrativeAccordionProps) {
  return (
    <details className="group bg-base-100 border-2 border-base-content/30 rounded-lg shadow-md transition-colors hover:border-primary/70 open:border-primary/70">
      <summary className="flex items-center justify-between gap-3 rounded-lg px-4 py-3 cursor-pointer select-none hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold leading-snug">{title}</span>
          {subtitle && (
            <span className="text-xs text-base-content/70 leading-tight">{subtitle}</span>
          )}
        </div>
        <span className="flex shrink-0 items-center gap-2 text-primary">
          <span className="hidden md:inline text-[0.65rem] font-semibold uppercase tracking-wide md:group-open:hidden">
            Expand
          </span>
          <span className="hidden md:group-open:inline text-[0.65rem] font-semibold uppercase tracking-wide">
            Collapse
          </span>
          <svg
            data-testid="race-chevron"
            className="h-5 w-5 transition-transform group-open:rotate-180"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </summary>
      <div className="px-4 pb-4 text-sm leading-snug space-y-2">{children}</div>
    </details>
  );
}

export function PlayoffRacePanels({ narratives }: { narratives: PlayoffNarratives | null }) {
  if (!narratives) return null;
  return (
    <div className="grid items-start gap-3 lg:grid-cols-3">
      {narratives.bubble && (
        <NarrativeAccordion title={narratives.bubble.heading}>
          <p className="text-base-content/90">{narratives.bubble.summary}</p>
          <ul className="list-disc list-inside text-base-content/80 space-y-1">
            {narratives.bubble.scenarios.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
          {narratives.bubble.note && (
            <p className="text-xs text-base-content/70">{narratives.bubble.note}</p>
          )}
        </NarrativeAccordion>
      )}

      {narratives.bye && (
        <NarrativeAccordion title={narratives.bye.heading}>
          <p className="text-base-content/90">{narratives.bye.summary}</p>
          <ul className="list-disc list-inside text-base-content/80 space-y-1">
            {narratives.bye.scenarios.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
          {narratives.bye.note && (
            <p className="text-xs text-base-content/70">{narratives.bye.note}</p>
          )}
        </NarrativeAccordion>
      )}

      {narratives.divisions.length > 0 && (
        <NarrativeAccordion
          title="Division Races"
          subtitle={`${narratives.divisions.length.toString()} divisions in play`}
        >
          <div className="space-y-3">
            {narratives.divisions.map((race, idx) => (
              <div key={race.id ?? idx} className="space-y-1">
                <div className="text-sm font-semibold leading-snug">{race.summary}</div>
                <ul className="list-disc list-inside text-xs sm:text-sm leading-snug space-y-1 text-base-content/80">
                  {race.scenarios.map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
                {race.note && <p className="text-xs text-base-content/70">{race.note}</p>}
              </div>
            ))}
          </div>
        </NarrativeAccordion>
      )}
    </div>
  );
}
