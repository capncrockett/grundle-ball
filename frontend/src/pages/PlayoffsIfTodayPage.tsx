import { useEffect, useMemo, useState } from 'react';
import { getLeagueRosters, getLeagueUsers, getNFLState } from '../api/sleeper';
import { mergeRostersAndUsersToTeams, computeSeeds } from '../utils/sleeperTransforms';
import { applyGameOutcomesToBracket } from '../bracket/state';
import type { Team } from '../models/fantasy';
import type { BracketSlot, BracketSlotId } from '../bracket/types';
import { BRACKET_TEMPLATE } from '../bracket/template';
import { assignSeedsToBracketSlots } from '../bracket/seedAssignment';
import { Bracket } from '../components/bracket/Bracket';
import { TeamAvatars } from '../components/common/TeamAvatars';
import { BracketModeToggle } from '../components/common/BracketModeToggle';
import { TeamSelector } from '../components/common/TeamSelector';
import { LEAGUE_ID } from '../config/league';
import { PlayoffRacePanels } from '../components/PlayoffRacePanels';
import { buildPlayoffNarratives } from './narratives.tsx';

type BracketMode = 'score' | 'reward';

const RESOLUTION_ORDER: BracketSlotId[] = [
  // Champ
  'champ_r1_g1',
  'champ_r1_g2',
  'champ_r2_g1',
  'champ_r2_g2',
  'champ_finals',
  'champ_3rd',
  // Toilet
  'toilet_r1_g1',
  'toilet_r1_g2',
  'toilet_r2_g1',
  'toilet_r2_g2',
  'toilet_finals',
  'toilet_9th_10th',
  // Keeper
  'keeper_splashback1',
  'keeper_splashback2',
  'keeper_5th_6th',
  'keeper_7th_8th',
];

function computeSeasonAverage(team: Team): number {
  const gamesPlayed = team.record.wins + team.record.losses + team.record.ties;
  if (gamesPlayed <= 0) return 0;
  return team.pointsFor / gamesPlayed;
}

function formatRecord(record: Team['record']): string {
  const base = `${record.wins.toString()}-${record.losses.toString()}`;
  return record.ties ? `${base}-${record.ties.toString()}` : base;
}

function chooseWinnerIndex(
  aPoints: number,
  bPoints: number,
  slot: BracketSlot,
  teamsById: Map<number, Team>,
): 0 | 1 {
  if (aPoints > bPoints) return 0;
  if (bPoints > aPoints) return 1;

  // Tie-breaker: better seed (lower number) wins
  const [posA, posB] = slot.positions;
  const seedA = posA?.seed ?? (posA?.teamId ? teamsById.get(posA.teamId)?.seed : undefined);
  const seedB = posB?.seed ?? (posB?.teamId ? teamsById.get(posB.teamId)?.seed : undefined);

  if (seedA != null && seedB != null && seedA !== seedB) {
    return seedA < seedB ? 0 : 1;
  }

  // Final fallback: keep top/left
  return 0;
}

function projectBracketWithAverages(teams: Team[]): BracketSlot[] {
  const teamsById = new Map<number, Team>();
  teams.forEach((team) => teamsById.set(team.sleeperRosterId, team));

  const avgByTeamId = new Map<number, number>();
  teams.forEach((team) => avgByTeamId.set(team.sleeperRosterId, computeSeasonAverage(team)));
  const projectionFor = (teamId: number): number => avgByTeamId.get(teamId) ?? 0;

  // Seed the template and annotate seeded positions with their averages
  let workingSlots = assignSeedsToBracketSlots(teams).map((slot) => ({
    ...slot,
    positions: slot.positions.map((pos) => {
      if (!pos || !pos.teamId) return pos;
      const projection = projectionFor(pos.teamId);
      return { ...pos, projectedPoints: projection, currentPoints: projection };
    }) as typeof slot.positions,
  }));

  const resolved = new Set<BracketSlotId>();

  const resolveSlot = (slotId: BracketSlotId): boolean => {
    const slot = workingSlots.find((s) => s.id === slotId);
    if (!slot) return false;

    const [posA, posB] = slot.positions;
    const hasA = posA?.teamId != null;
    const hasB = posB?.teamId != null;

    // Need both sides to project; otherwise skip until routing fills it
    if (!hasA || !hasB) return false;

    const teamIdA = posA.teamId;
    const teamIdB = posB.teamId;
    if (teamIdA == null || teamIdB == null) {
      return false;
    }

    const projA = projectionFor(teamIdA);
    const projB = projectionFor(teamIdB);

    const updatedSlot: BracketSlot = {
      ...slot,
      positions: [
        { ...posA, currentPoints: projA, projectedPoints: projA },
        { ...posB, currentPoints: projB, projectedPoints: projB },
      ],
    };

    workingSlots = workingSlots.map((s) => (s.id === slotId ? updatedSlot : s));

    const winnerIndex = chooseWinnerIndex(projA, projB, updatedSlot, teamsById);
    workingSlots = applyGameOutcomesToBracket(workingSlots, [{ slotId, winnerIndex }]);
    resolved.add(slotId);
    return true;
  };

  let madeProgress = true;
  while (madeProgress) {
    madeProgress = false;
    for (const slotId of RESOLUTION_ORDER) {
      if (resolved.has(slotId)) continue;
      const resolvedNow = resolveSlot(slotId);
      if (resolvedNow) madeProgress = true;
    }
  }

  return workingSlots;
}

function PlayoffsIfTodayPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [slots, setSlots] = useState<BracketSlot[]>(BRACKET_TEMPLATE);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [mode, setMode] = useState<BracketMode>('score');
  const [currentWeek, setCurrentWeek] = useState<number | null>(null);
  const narratives = useMemo(
    () => (currentWeek == null ? null : buildPlayoffNarratives(teams, currentWeek)),
    [teams, currentWeek],
  );

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        setError(null);

        const [users, rosters, nflState] = await Promise.all([
          getLeagueUsers(LEAGUE_ID),
          getLeagueRosters(LEAGUE_ID),
          getNFLState(),
        ]);
        setCurrentWeek(nflState.week);

        const merged = mergeRostersAndUsersToTeams(rosters, users);
        const withSeeds = computeSeeds(merged);

        setTeams(withSeeds);

        // Project the entire bracket using season-long weekly scoring averages
        const projectedSlots = projectBracketWithAverages(withSeeds);
        setSlots(projectedSlots);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  // Slots are now managed by state and set in the useEffect

  const teamsById = useMemo(() => {
    const map = new Map<number, Team>();
    teams.forEach((t) => map.set(t.sleeperRosterId, t));
    return map;
  }, [teams]);

  const pvpInfo = useMemo(() => {
    if (!selectedTeamId) return null;

    const selected = teamsById.get(selectedTeamId);
    if (!selected) return null;

    const slot = slots.find((s) => s.positions.some((p) => p?.teamId === selectedTeamId));
    if (!slot) {
      return { selected, opponent: null, slot: null };
    }

    const otherPos = slot.positions.find((p) => p && p.teamId !== selectedTeamId);
    const opponent =
      otherPos && otherPos.teamId != null ? (teamsById.get(otherPos.teamId) ?? null) : null;

    return { selected, opponent, slot };
  }, [selectedTeamId, teamsById, slots]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">If the Season Ended Today</h1>
          <p className="text-sm text-base-content/60">
            Projected bracket using current Sleeper seeds and each team&apos;s season-long average
            points per week.
          </p>
          <div className="mt-2 text-xs text-base-content/70 leading-relaxed max-w-2xl">
            We simulate every game with season averages so there&apos;s no lineup guessing-just a
            steady baseline to show how the paths would shake out right now.
          </div>
        </div>

        {/* controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* mode toggle */}
          <BracketModeToggle
            mode={mode}
            onModeChange={(nextMode) => {
              setMode(nextMode);
            }}
          />

          {/* team selector */}
          <TeamSelector
            teams={teams}
            selectedTeamId={selectedTeamId}
            onSelectedTeamChange={setSelectedTeamId}
          />
        </div>
      </div>

      <PlayoffRacePanels narratives={narratives} />

      {pvpInfo && (
        <div className="card bg-base-200 shadow-md">
          <div className="card-body gap-3">
            <div className="text-xs font-semibold uppercase text-base-content/60">Head-to-head</div>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
              {/* left: selected team */}
              <div className="flex items-center gap-2">
                <TeamAvatars
                  teamName={pvpInfo.selected.teamName}
                  teamAvatarUrl={pvpInfo.selected.teamAvatarUrl}
                  userAvatarUrl={pvpInfo.selected.userAvatarUrl}
                  userDisplayName={pvpInfo.selected.ownerDisplayName}
                  showUserAvatar={false}
                  size="md"
                />
                <div>
                  <div className="text-sm font-semibold">
                    {pvpInfo.selected.seed}. {pvpInfo.selected.teamName}
                  </div>
                  <div className="text-[0.7rem] text-base-content/60">
                    ({formatRecord(pvpInfo.selected.record)})
                  </div>
                </div>
              </div>

              <span className="text-xs font-semibold uppercase text-base-content/60">vs</span>

              {/* right: opponent */}
              {pvpInfo.opponent ? (
                <div className="flex items-center gap-2">
                  <TeamAvatars
                    teamName={pvpInfo.opponent.teamName}
                    teamAvatarUrl={pvpInfo.opponent.teamAvatarUrl}
                    userAvatarUrl={pvpInfo.opponent.userAvatarUrl}
                    userDisplayName={pvpInfo.opponent.ownerDisplayName}
                    showUserAvatar={false}
                    size="md"
                  />
                  <div className="text-right">
                    <div className="text-sm font-semibold">
                      {pvpInfo.opponent.seed}. {pvpInfo.opponent.teamName}
                    </div>
                    <div className="text-[0.7rem] text-base-content/60">
                      ({formatRecord(pvpInfo.opponent.record)})
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-[0.7rem] italic text-base-content/60">Opponent TBD</div>
              )}
            </div>

            {pvpInfo.slot && (
              <div className="text-[0.7rem] text-base-content/60">{pvpInfo.slot.label}</div>
            )}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-10">
          <span className="loading loading-spinner loading-lg" />
        </div>
      )}

      {error && !isLoading && (
        <div className="alert alert-error mb-4">
          <span>Failed to load playoff preview: {error}</span>
        </div>
      )}

      {!isLoading && !error && teams.length === 0 && (
        <p className="text-sm text-base-content/60">No teams found.</p>
      )}

      {!isLoading && !error && teams.length > 0 && (
        <Bracket slots={slots} teams={teams} highlightTeamId={selectedTeamId} mode={mode} />
      )}
    </div>
  );
}

export default PlayoffsIfTodayPage;
