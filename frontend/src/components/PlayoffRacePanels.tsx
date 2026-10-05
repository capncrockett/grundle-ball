import type { ReactNode } from 'react';
import type { PlayoffNarratives } from '../pages/narratives';

type NarrativeAccordionProps = {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
};

function NarrativeAccordion({ title, subtitle, children }: NarrativeAccordionProps) {
  return (
    <details className="bg-base-200 border border-base-300 rounded-lg shadow-sm">
      <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer select-none">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold leading-snug">{title}</span>
          {subtitle && (
            <span className="text-xs text-base-content/70 leading-tight">{subtitle}</span>
          )}
        </div>
        <span className="text-[0.65rem] uppercase tracking-wide text-base-content/60">Expand</span>
      </summary>
      <div className="px-4 pb-4 text-sm leading-snug space-y-2">{children}</div>
    </details>
  );
}

export function PlayoffRacePanels({ narratives }: { narratives: PlayoffNarratives | null }) {
  if (!narratives) return null;
  return (
    <div className="grid gap-3 lg:grid-cols-3">
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
