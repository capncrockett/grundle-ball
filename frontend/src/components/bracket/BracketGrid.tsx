// Shared bracket grid + connectors (layout layer)
//
// This component is responsible for:
// - Structural layout of bracket columns/rows
// - SVG connectors between games/slots
// - Ghost/placeholder cards and BYE masking
// It deliberately does NOT know about Sleeper APIs or seeding logic — it just
// receives BracketSlot data and renders it using the BracketTile card layer.

import type { FC, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { BracketSlot } from '../../bracket/types';
import type { Team } from '../../models/fantasy';
import { ROUTING_RULES } from '../../bracket/routingRules';
import { BracketTile, BRACKET_TILE_BODY_HEIGHT_CLASS } from './BracketTile';

interface BracketColumnItem {
  id: string;
  slotId: BracketSlot['id'] | null;
  /** Optional override for the card title (e.g., BYE when masking a slot in Round 1). */
  titleOverride?: string;
  /** Optional: mask one position to show a BYE/TBD without altering the real slot data. */
  maskOppIndex?: 0 | 1;
  /** Optional class override for positioning within the column. */
  itemClassName?: string;
  /** Optional override for ghost body height. */
  ghostBodyClassName?: string;
  /** Optional content for ghost cards. */
  ghostContent?: ReactNode;
  /** Optional class override for ghost content wrapper. */
  ghostContentClassName?: string;
  /** Optional connector target for non-slot items (ex: BYE cards). */
  connectorToSlotId?: BracketSlot['id'];
}

export interface BracketLayoutColumn {
  title?: string;
  subtitle?: string;
  items: BracketColumnItem[];
  /** Optional height override per column. */
  columnHeightClass?: string;
  /** Optional class override for the items container (e.g., justify-between). */
  itemsContainerClassName?: string;
  /** Optional class override for the column container. */
  columnClassName?: string;
}

interface BracketGridProps {
  columns: BracketLayoutColumn[];
  slots: BracketSlot[];
  teamsById: Map<number, Team>;
  scoreOverridesByTeamId?: Map<number, number>;
  highlightTeamId?: number | null;
  mode: 'score' | 'reward';
  /** Base column height if none is provided per column. */
  defaultColumnHeightClass?: string;
  /** Optional override to apply the same height class to all columns (e.g., Keeper uses a shorter stack). */
  columnHeightClass?: string;
  /** Horizontal gap between columns. */
  colGapClass?: string;
}

interface BracketMatchShellProps {
  itemId: string;
  children: ReactNode;
  className?: string;
  slotId?: BracketSlot['id'];
}

const BracketMatchShell: FC<BracketMatchShellProps> = ({
  itemId,
  children,
  className,
  slotId,
}) => {
  return (
    <div
      className={['relative flex flex-col items-stretch gap-1 min-w-0 w-full', className]
        .filter(Boolean)
        .join(' ')}
      data-cell-id={itemId}
      data-slot-id={slotId ?? undefined}
      role="group"
    >
      <div className="absolute inset-x-0 top-0 h-0 w-full pointer-events-none" data-anchor="top" />
      <div className="flex-1 min-w-0 w-full">{children}</div>
      <div
        className="absolute inset-x-0 bottom-0 h-0 w-full pointer-events-none"
        data-anchor="bottom"
      />
    </div>
  );
};

export const BracketGrid: FC<BracketGridProps> = ({
  columns,
  slots,
  teamsById,
  scoreOverridesByTeamId,
  highlightTeamId,
  mode,
  defaultColumnHeightClass = 'min-h-[600px] md:min-h-[720px]',
  columnHeightClass,
  colGapClass = 'gap-3 md:gap-10',
}) => {
  const slotById = useMemo(() => new Map(slots.map((s) => [s.id, s])), [slots]);
  const columnsContainerRef = useRef<HTMLDivElement | null>(null);
  const [connectorPaths, setConnectorPaths] = useState<string[]>([]);

  const gridTemplateColumns = `repeat(${columns.length.toString()}, minmax(0, 1fr))`;
  const resolvedColumnHeight = columnHeightClass ?? defaultColumnHeightClass;

  useEffect(() => {
    const container = columnsContainerRef.current;
    if (!container) return;

    const manualConnectors = columns.flatMap((col) =>
      col.items
        .filter((item) => item.connectorToSlotId)
        .map((item) => ({
          fromItemId: item.id,
          toSlotId: item.connectorToSlotId as BracketSlot['id'],
        })),
    );

    let rafId: number | null = null;
    const updatePaths = () => {
      const containerRect = container.getBoundingClientRect();
      const slotRects = new Map<string, DOMRect>();
      const cellRects = new Map<string, DOMRect>();
      container.querySelectorAll<HTMLElement>('[data-slot-id]').forEach((el) => {
        const slotId = el.dataset.slotId;
        if (!slotId) return;
        slotRects.set(slotId, el.getBoundingClientRect());
      });
      container.querySelectorAll<HTMLElement>('[data-cell-id]').forEach((el) => {
        const cellId = el.dataset.cellId;
        if (!cellId) return;
        cellRects.set(cellId, el.getBoundingClientRect());
      });

      const nextPaths: string[] = [];
      const pushCurve = (fromRect: DOMRect, toRect: DOMRect) => {
        const startX = fromRect.right - containerRect.left;
        const startY = fromRect.top + fromRect.height / 2 - containerRect.top;
        const endX = toRect.left - containerRect.left;
        const endY = toRect.top + toRect.height / 2 - containerRect.top;
        const curveOffset = Math.max(24, Math.abs(endX - startX) * 0.5);
        const c1x = startX + curveOffset;
        const c2x = endX - curveOffset;

        nextPaths.push(['M', startX, startY, 'C', c1x, startY, c2x, endY, endX, endY].join(' '));
      };
      ROUTING_RULES.forEach((rule) => {
        if (!rule.winnerGoesTo) return;
        const fromRect = slotRects.get(rule.fromSlotId);
        const toRect = slotRects.get(rule.winnerGoesTo.slotId);
        if (!fromRect || !toRect) return;
        pushCurve(fromRect, toRect);
      });
      manualConnectors.forEach((connector) => {
        const fromRect = cellRects.get(connector.fromItemId);
        const toRect = slotRects.get(connector.toSlotId);
        if (!fromRect || !toRect) return;
        pushCurve(fromRect, toRect);
      });

      setConnectorPaths(nextPaths);
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
      if (rafId != null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafId);
      }
      resizeObserver?.disconnect();
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [columns, slots, colGapClass, mode]);

  return (
    <div className="w-full">
      {/* Column headers */}
      <div
        className={`grid ${colGapClass} mb-2 md:mb-4`}
        style={{ gridTemplateColumns: gridTemplateColumns }}
      >
        {columns.map((col, idx) => (
          <div key={idx} className="flex flex-col">
            {col.title && (
              <h2 className="text-[0.6rem] md:text-sm font-semibold tracking-wide uppercase text-base-content/70">
                {col.title}
              </h2>
            )}
            {col.subtitle && (
              <span className="text-[0.55rem] md:text-xs font-medium text-base-content/60">
                {col.subtitle}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Columns with flex-stacked matchups */}
      <div ref={columnsContainerRef} className="relative">
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
          focusable="false"
        >
          {connectorPaths.map((path, idx) => (
            <path
              key={idx}
              d={path}
              fill="none"
              stroke="currentColor"
              className="text-base-content/40"
              strokeWidth={2}
              strokeLinecap="round"
            />
          ))}
        </svg>
        <div
          className={`relative z-10 grid ${colGapClass}`}
          style={{ gridTemplateColumns: gridTemplateColumns }}
        >
          {columns.map((col, colIdx) => {
            const columnHeight = col.columnHeightClass ?? resolvedColumnHeight;
            return (
              <div
                key={colIdx}
                className={['flex flex-col min-w-0 w-full', columnHeight, col.columnClassName]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div
                  className={[
                    'flex-1 flex flex-col gap-2 md:gap-4',
                    col.itemsContainerClassName,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {col.items.map((item) => {
                    if (!item.slotId) {
                      const ghostBodyClassName =
                        item.ghostBodyClassName ?? BRACKET_TILE_BODY_HEIGHT_CLASS;
                      const ghostContentClassName =
                        item.ghostContentClassName ??
                        'flex h-full w-full flex-col items-center justify-center text-center text-[0.7rem] md:text-xs text-base-content/70';
                      return (
                        <BracketMatchShell
                          key={item.id}
                          itemId={item.id}
                          className={item.itemClassName}
                        >
                          <div
                            className={[
                              'card card-compact w-full max-w-full min-w-0 h-full',
                              item.ghostContent
                                ? 'bg-base-100 border border-base-300'
                                : 'bg-transparent border border-transparent shadow-none',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            aria-hidden="true"
                          >
                            <div
                              className={[
                                'card-body p-2 md:p-3',
                                ghostBodyClassName,
                                item.ghostContent ? 'flex' : null,
                              ]
                                .filter(Boolean)
                                .join(' ')}
                            >
                              {item.ghostContent ? (
                                <div className={ghostContentClassName}>{item.ghostContent}</div>
                              ) : null}
                            </div>
                          </div>
                        </BracketMatchShell>
                      );
                    }
                    const slot = slotById.get(item.slotId);
                    if (!slot) return null;

                    const displaySlot =
                      item.maskOppIndex == null
                        ? slot
                        : {
                            ...slot,
                            positions: slot.positions.map((pos, idx) =>
                              idx === item.maskOppIndex
                                ? { ...(pos ?? {}), teamId: undefined, isBye: true }
                                : pos && scoreOverridesByTeamId
                                  ? {
                                      ...pos,
                                      currentPoints: scoreOverridesByTeamId.get(pos.teamId ?? -1),
                                    }
                                  : pos,
                            ) as typeof slot.positions,
                          };

                    const connectSlotId = item.maskOppIndex == null ? item.slotId : undefined;

                    return (
                      <BracketMatchShell
                        key={item.id}
                        itemId={item.id}
                        className={item.itemClassName}
                        slotId={connectSlotId ?? undefined}
                      >
                        <BracketTile
                          slot={displaySlot}
                          teamsById={teamsById}
                          highlightTeamId={highlightTeamId}
                          mode={mode}
                          titleOverride={item.titleOverride}
                        />
                      </BracketMatchShell>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
