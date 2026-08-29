// Official Sleeper bracket. Layout intentionally mirrors the proven
// Grundle Bowl grid: three equal columns, fixed card geometry, explicit
// spacers, flex-distributed rounds, and SVG winner connectors.

import type { FC, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Team } from '../../models/fantasy';
import type { BracketSide, ResolvedBracketMatchup } from '../../sleeperBracket/types';
import { describePlacementLabel, groupMatchupsByRound } from '../../sleeperBracket/resolveBracket';
import { TeamAvatars } from '../common/TeamAvatars';

interface SleeperBracketBoardProps {
  title: string;
  subtitle?: string;
  matchups: ResolvedBracketMatchup[];
  teamsById: Map<number, Team>;
  placementOffset?: number;
  placementOrder?: 'forward' | 'reverse';
  weekStart?: number;
}

type DisplaySide = BracketSide | { kind: 'bye' };

interface DisplayCard {
  id: string;
  sideA: DisplaySide;
  sideB: DisplaySide;
  matchup?: ResolvedBracketMatchup;
}

interface LayoutItem {
  id: string;
  card?: DisplayCard;
}

interface LayoutColumn {
  title: string;
  subtitle?: string;
  itemsContainerClassName: string;
  items: LayoutItem[];
}

interface Connector {
  fromItemId: string;
  toItemId: string;
}

interface ConnectorPath extends Connector {
  path: string;
}

interface BoardLayout {
  columns: LayoutColumn[];
  connectors: Connector[];
  placementGames: ResolvedBracketMatchup[];
}

const CARD_BODY_HEIGHT_CLASS = 'h-[130px] md:h-[150px]';
const COLUMN_GAP_CLASS = 'gap-3 md:gap-10';
const COLUMN_HEIGHT_CLASS = 'min-h-[600px] md:min-h-[760px]';
const TEAM_NAME_CLASS = 'font-semibold text-[0.65rem] md:text-sm leading-tight truncate';
const SCORE_CLASS = 'text-[0.7rem] md:text-base font-semibold text-base-content/80';

const matchItemId = (matchId: number) => `match-${String(matchId)}`;

function sourceMatchIds(matchup: ResolvedBracketMatchup): number[] {
  return Array.from(
    new Set(
      [
        matchup.raw.t1_from?.w,
        matchup.raw.t1_from?.l,
        matchup.raw.t2_from?.w,
        matchup.raw.t2_from?.l,
      ].filter((matchId): matchId is number => matchId != null),
    ),
  );
}

function matchupCard(matchup: ResolvedBracketMatchup): DisplayCard {
  return {
    id: matchItemId(matchup.matchId),
    sideA: matchup.sideA,
    sideB: matchup.sideB,
    matchup,
  };
}

function buildBoardLayout(matchups: ResolvedBracketMatchup[], weekStart?: number): BoardLayout {
  const rounds = groupMatchupsByRound(matchups);
  const firstRound = rounds.at(0);
  const secondRound = rounds.at(1);
  const finalRound = rounds.at(-1);
  const firstRoundById = new Map(
    (firstRound?.matchups ?? []).map((matchup) => [matchup.matchId, matchup]),
  );
  const semifinalGames = (secondRound?.matchups ?? []).filter(
    (matchup) => matchup.placement == null,
  );
  const placementGames = (secondRound?.matchups ?? []).filter(
    (matchup) => matchup.placement != null,
  );
  const finalGames = [...(finalRound?.matchups ?? [])].sort(
    (a, b) => (a.placement ?? Number.MAX_SAFE_INTEGER) - (b.placement ?? Number.MAX_SAFE_INTEGER),
  );
  const championshipGame = finalGames.at(0);
  const secondaryFinal = finalGames.at(1);
  const firstRoundItems: LayoutItem[] = [];
  const connectors: Connector[] = [];

  semifinalGames.forEach((semifinal) => {
    const sourceId = sourceMatchIds(semifinal).at(0);
    const sourceMatchup = sourceId == null ? undefined : firstRoundById.get(sourceId);
    const directTeam = [semifinal.sideA, semifinal.sideB].find((side) => side.kind === 'team');
    const semifinalItemId = matchItemId(semifinal.matchId);

    if (directTeam) {
      const byeItemId = `bye-${String(semifinal.matchId)}`;
      firstRoundItems.push({
        id: byeItemId,
        card: {
          id: byeItemId,
          sideA: directTeam,
          sideB: { kind: 'bye' },
        },
      });
      connectors.push({ fromItemId: byeItemId, toItemId: semifinalItemId });
    }

    if (sourceMatchup) {
      const sourceItemId = matchItemId(sourceMatchup.matchId);
      firstRoundItems.push({ id: sourceItemId, card: matchupCard(sourceMatchup) });
      connectors.push({ fromItemId: sourceItemId, toItemId: semifinalItemId });
    }
  });

  if (firstRoundItems.length === 0) {
    firstRoundItems.push(
      ...(firstRound?.matchups ?? []).map((matchup) => ({
        id: matchItemId(matchup.matchId),
        card: matchupCard(matchup),
      })),
    );
  }

  if (championshipGame) {
    sourceMatchIds(championshipGame).forEach((sourceId) => {
      connectors.push({
        fromItemId: matchItemId(sourceId),
        toItemId: matchItemId(championshipGame.matchId),
      });
    });
  }

  const roundLabel = (round: number | undefined, fallback: number) =>
    `Round ${String(round ?? fallback)}`;
  const weekLabel = (round: number | undefined, fallback: number) =>
    weekStart == null ? undefined : `Week ${String(weekStart + (round ?? fallback) - 1)}`;

  return {
    columns: [
      {
        title: roundLabel(firstRound?.round, 1),
        subtitle: weekLabel(firstRound?.round, 1),
        itemsContainerClassName: 'justify-between',
        items: firstRoundItems,
      },
      {
        title: roundLabel(secondRound?.round, 2),
        subtitle: weekLabel(secondRound?.round, 2),
        itemsContainerClassName: 'justify-around',
        items: semifinalGames.map((matchup) => ({
          id: matchItemId(matchup.matchId),
          card: matchupCard(matchup),
        })),
      },
      {
        title: 'Finals',
        subtitle: weekLabel(finalRound?.round, 3),
        itemsContainerClassName: 'justify-between',
        items: [
          { id: 'finals-spacer' },
          ...(championshipGame
            ? [
                {
                  id: matchItemId(championshipGame.matchId),
                  card: matchupCard(championshipGame),
                },
              ]
            : []),
          ...(secondaryFinal
            ? [
                {
                  id: matchItemId(secondaryFinal.matchId),
                  card: matchupCard(secondaryFinal),
                },
              ]
            : []),
        ],
      },
    ],
    connectors,
    placementGames,
  };
}

interface SideRowProps {
  side: DisplaySide;
  teamsById: Map<number, Team>;
}

const SideRow: FC<SideRowProps> = ({ side, teamsById }) => {
  const team = side.kind === 'team' ? teamsById.get(side.rosterId) : undefined;
  const label =
    side.kind === 'team'
      ? (team?.teamName ?? `Roster ${String(side.rosterId)}`)
      : side.kind === 'bye'
        ? 'BYE'
        : 'TBD';

  return (
    <div className="min-w-0 max-w-full overflow-hidden py-1.5 md:py-2">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1 md:gap-2">
          {team ? (
            <TeamAvatars
              teamName={label}
              teamAvatarUrl={team.teamAvatarUrl}
              size="md"
              className="shrink-0 md:scale-125"
            />
          ) : (
            <div className="invisible h-8 w-8 shrink-0 rounded-full md:scale-125" aria-hidden />
          )}
        </div>
        <div className={SCORE_CLASS}>-</div>
      </div>
      <div className="mt-1 min-w-0">
        <div className={TEAM_NAME_CLASS} title={label}>
          {label}
        </div>
      </div>
    </div>
  );
};

interface BracketCardProps {
  card: DisplayCard;
  teamsById: Map<number, Team>;
}

const BracketCard: FC<BracketCardProps> = ({ card, teamsById }) => (
  <div className="card card-compact h-full w-full min-w-0 max-w-full overflow-hidden border border-base-300 bg-base-100 shadow-sm">
    <div className={`card-body gap-1.5 p-2 md:p-3 ${CARD_BODY_HEIGHT_CLASS}`}>
      <div className="min-h-0 flex-1 divide-y divide-base-300">
        <SideRow side={card.sideA} teamsById={teamsById} />
        <SideRow side={card.sideB} teamsById={teamsById} />
      </div>
    </div>
  </div>
);

interface MatchShellProps {
  itemId: string;
  children: ReactNode;
}

const MatchShell: FC<MatchShellProps> = ({ itemId, children }) => (
  <div
    className="relative flex w-full min-w-0 flex-col items-stretch gap-1"
    data-cell-id={itemId}
    role="group"
  >
    <div className="min-w-0 w-full flex-1">{children}</div>
  </div>
);

export const SleeperBracketBoard: FC<SleeperBracketBoardProps> = ({
  title,
  subtitle,
  matchups,
  teamsById,
  placementOffset = 0,
  placementOrder = 'forward',
  weekStart,
}) => {
  const layout = useMemo(() => buildBoardLayout(matchups, weekStart), [matchups, weekStart]);
  const placementCount = useMemo(() => {
    const highestPlacement = Math.max(0, ...matchups.map((matchup) => matchup.placement ?? 0));
    return highestPlacement === 0 ? 0 : highestPlacement + 1;
  }, [matchups]);
  const columnsContainerRef = useRef<HTMLDivElement | null>(null);
  const [connectorPaths, setConnectorPaths] = useState<ConnectorPath[]>([]);
  const gridTemplateColumns = `repeat(${layout.columns.length.toString()}, minmax(0, 1fr))`;
  const placementLabel = (matchup: ResolvedBracketMatchup) => {
    if (matchup.placement == null) return null;
    const localPlacement =
      placementOrder === 'reverse' ? placementCount - matchup.placement : matchup.placement;
    return describePlacementLabel(localPlacement, placementOffset);
  };
  const matchupWeek = (matchup: ResolvedBracketMatchup) => (weekStart ?? 15) + matchup.round - 1;

  useEffect(() => {
    const container = columnsContainerRef.current;
    if (!container) return;

    let rafId: number | null = null;
    const updatePaths = () => {
      const containerRect = container.getBoundingClientRect();
      const cellRects = new Map<string, DOMRect>();
      container.querySelectorAll<HTMLElement>('[data-cell-id]').forEach((element) => {
        const itemId = element.dataset.cellId;
        if (itemId) cellRects.set(itemId, element.getBoundingClientRect());
      });

      setConnectorPaths(
        layout.connectors.flatMap((connector) => {
          const fromRect = cellRects.get(connector.fromItemId);
          const toRect = cellRects.get(connector.toItemId);
          if (!fromRect || !toRect) return [];

          const startX = fromRect.right - containerRect.left;
          const startY = fromRect.top + fromRect.height / 2 - containerRect.top;
          const endX = toRect.left - containerRect.left;
          const endY = toRect.top + toRect.height / 2 - containerRect.top;
          const curveOffset = Math.max(24, Math.abs(endX - startX) * 0.5);

          return [
            {
              ...connector,
              path: [
                'M',
                startX,
                startY,
                'C',
                startX + curveOffset,
                startY,
                endX - curveOffset,
                endY,
                endX,
                endY,
              ].join(' '),
            },
          ];
        }),
      );
    };

    const scheduleUpdate = () => {
      if (typeof requestAnimationFrame !== 'function') {
        updatePaths();
        return;
      }
      if (rafId != null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updatePaths);
    };

    scheduleUpdate();
    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleUpdate);
    resizeObserver?.observe(container);
    window.addEventListener('resize', scheduleUpdate);

    return () => {
      if (rafId != null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [layout]);

  return (
    <section aria-label={title}>
      <h2 className="mb-1 text-sm font-bold text-base-content md:text-lg">{title}</h2>
      {subtitle && <p className="mb-3 text-xs text-base-content/60">{subtitle}</p>}

      <div className={`mb-2 grid ${COLUMN_GAP_CLASS} md:mb-4`} style={{ gridTemplateColumns }}>
        {layout.columns.map((column) => (
          <div key={column.title} className="flex min-w-0 flex-col">
            <span className="text-[0.6rem] font-semibold uppercase tracking-wide text-base-content/70 md:text-sm">
              {column.title}
            </span>
            {column.subtitle && (
              <span className="text-[0.55rem] font-medium text-base-content/60 md:text-xs">
                {column.subtitle}
              </span>
            )}
          </div>
        ))}
      </div>

      <div ref={columnsContainerRef} className="relative" data-testid="sleeper-bracket-grid">
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
          focusable="false"
        >
          {connectorPaths.map((connector) => (
            <path
              key={`${connector.fromItemId}-${connector.toItemId}`}
              d={connector.path}
              fill="none"
              stroke="currentColor"
              className="text-base-content/40"
              strokeWidth={2}
              strokeLinecap="round"
              data-testid="sleeper-bracket-connector"
            />
          ))}
        </svg>

        <div className={`relative z-10 grid ${COLUMN_GAP_CLASS}`} style={{ gridTemplateColumns }}>
          {layout.columns.map((column) => (
            <div
              key={column.title}
              className={`flex min-w-0 w-full flex-col ${COLUMN_HEIGHT_CLASS}`}
            >
              <div
                className={`flex flex-1 flex-col gap-2 md:gap-4 ${column.itemsContainerClassName}`}
              >
                {column.items.map((item) => (
                  <MatchShell key={item.id} itemId={item.id}>
                    {item.card ? (
                      <>
                        {item.card.matchup?.placement != null && (
                          <div className="pointer-events-none absolute -top-7 w-full text-[0.55rem] font-semibold uppercase leading-tight tracking-wide text-base-content/60 md:-top-5 md:text-xs">
                            {placementLabel(item.card.matchup)} · Week{' '}
                            {String(matchupWeek(item.card.matchup))}
                          </div>
                        )}
                        <BracketCard card={item.card} teamsById={teamsById} />
                      </>
                    ) : (
                      <div
                        className={`card w-full border border-transparent ${CARD_BODY_HEIGHT_CLASS}`}
                      />
                    )}
                  </MatchShell>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {layout.placementGames.length > 0 && (
        <div className={`mt-4 grid ${COLUMN_GAP_CLASS}`} style={{ gridTemplateColumns }}>
          <div />
          <div className="space-y-2">
            {layout.placementGames.map((matchup) => (
              <div key={matchup.matchId}>
                <div className="mb-1 text-[0.6rem] font-semibold uppercase tracking-wide text-base-content/60 md:text-xs">
                  {placementLabel(matchup)} · Week {String(matchupWeek(matchup))}
                </div>
                <BracketCard card={matchupCard(matchup)} teamsById={teamsById} />
              </div>
            ))}
          </div>
          <div />
        </div>
      )}
    </section>
  );
};

export default SleeperBracketBoard;
