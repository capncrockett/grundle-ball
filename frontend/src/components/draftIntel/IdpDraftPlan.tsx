import type { IdpTierSource } from '../../data/idpTierSource';
import type { IdpDraftPlan, IdpPlanAction, IdpPlanPlayer } from '../../draftIntel/idpDraftPlan';
import { getRoundPick } from '../../utils/draftBoard';

export type IdpDraftPlanProps = {
  source: IdpTierSource;
  plan: IdpDraftPlan;
  teamCount: number;
  isLoadingAdp: boolean;
  adpWarning: string | null;
};

const actionLabel: Record<IdpPlanAction, string> = {
  target: 'Target',
  stream: 'Stream',
  watch: 'Watch',
};

const actionClassName: Record<IdpPlanAction, string> = {
  target: 'badge-primary',
  stream: 'badge-ghost',
  watch: 'badge-warning',
};

const formatRoundPick = (overallPick: number, teamCount: number): string => {
  const { round, pickInRound } = getRoundPick(Math.round(overallPick), teamCount);
  return `${round.toString()}.${pickInRound.toString().padStart(2, '0')}`;
};

const formatPercentage = (value: number): string =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);

const availabilityLabel = (player: IdpPlanPlayer, teamCount: number): string | null => {
  const targetPercentage = player.targetAvailability?.percentage;
  if (targetPercentage === null || targetPercentage === undefined || !player.targetPick)
    return null;

  const target = `${formatPercentage(targetPercentage)}% at ${formatRoundPick(
    player.targetPick.overallPick,
    teamCount,
  )}`;
  const nextPercentage = player.nextAvailability?.percentage;
  if (nextPercentage === null || nextPercentage === undefined || !player.nextPick) return target;
  return `${target}; ${formatPercentage(nextPercentage)}% at next pick ${formatRoundPick(
    player.nextPick.overallPick,
    teamCount,
  )}`;
};

function TargetCard({ player, teamCount }: { player: IdpPlanPlayer; teamCount: number }) {
  const availability = availabilityLabel(player, teamCount);
  const mockStats = player.mockStats;
  const targetLabel =
    player.action === 'stream'
      ? 'Final pick or waivers'
      : player.targetPick
        ? `Target ${formatRoundPick(player.targetPick.overallPick, teamCount)}`
        : 'Watch the room';

  return (
    <article
      className="card border border-base-300 bg-base-100 shadow-sm"
      aria-label={`${player.playerName} IDP target`}
    >
      <div className="card-body gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <h4 className="font-black">{player.playerName}</h4>
              <span className="badge badge-secondary badge-sm">Tier {player.tier.toString()}</span>
              <span className="badge badge-outline badge-sm">#{player.sourceRank.toString()}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-base-content/55">
              <span>{player.sleeperPosition ?? player.archetype}</span>
              <span>{player.nflTeam ?? 'FA'}</span>
              {player.isBigPlayFit && (
                <span className="badge badge-success badge-xs">Big-play fit</span>
              )}
              {player.playerStatus && player.playerStatus !== 'Active' && (
                <span className="badge badge-warning badge-xs">{player.playerStatus}</span>
              )}
            </div>
          </div>
          <span className={`badge badge-sm ${actionClassName[player.action]}`}>
            {actionLabel[player.action]}
          </span>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-base-content/45">
            Grundle plan
          </div>
          <div className="font-mono text-xl font-black">{targetLabel}</div>
          {availability && <div className="mt-1 text-xs text-base-content/60">{availability}</div>}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-box bg-base-200/60 px-2.5 py-2">
            <div className="text-base-content/45">Observed mocks</div>
            <div className="font-mono font-bold">
              {!mockStats
                ? 'No sample'
                : mockStats.meanPick === null
                  ? 'Undrafted'
                  : formatRoundPick(mockStats.meanPick, teamCount)}
            </div>
            {mockStats && (
              <div className="text-[0.65rem] text-base-content/45">
                {mockStats.mockCount.toString()} samples
              </div>
            )}
          </div>
          <div className="rounded-box bg-base-200/60 px-2.5 py-2">
            <div className="text-base-content/45">Sleeper IDP ADP</div>
            <div className="font-mono font-bold">
              {player.sleeperAdp === null
                ? 'Unavailable'
                : formatRoundPick(player.sleeperAdp, teamCount)}
            </div>
            <div className="text-[0.65rem] text-base-content/45">1QB plus IDP market</div>
          </div>
        </div>
      </div>
    </article>
  );
}

export function IdpDraftPlan({
  source,
  plan,
  teamCount,
  isLoadingAdp,
  adpWarning,
}: IdpDraftPlanProps) {
  return (
    <section
      className="mb-5 rounded-box border border-primary/30 bg-primary/5 p-4 sm:p-5"
      aria-labelledby="idp-draft-plan-heading"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="badge badge-primary badge-sm">Onesie strategy</span>
            <span className="text-xs font-semibold text-base-content/50">
              One starter - draft one - streamable replacement
            </span>
          </div>
          <h3 id="idp-draft-plan-heading" className="text-xl font-black">
            IDP Draft Plan
          </h3>
          <p className="mt-1 max-w-3xl text-sm text-base-content/65">
            Expert tiers answer who. Sleeper and the selected post-lock mocks answer when. Timing
            never changes a player's tier.
          </p>
        </div>
        <div className="rounded-box border border-base-300 bg-base-100 px-3 py-2 text-xs">
          <a
            className="font-semibold link link-hover"
            href={source.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            {source.name}
          </a>
          <div className="text-base-content/50">Published {source.publishedOn}</div>
        </div>
      </div>

      {isLoadingAdp && (
        <div className="mt-4 flex items-center gap-2 text-xs text-base-content/60">
          <span className="loading loading-spinner loading-xs" />
          Refreshing Sleeper 1QB IDP ADP...
        </div>
      )}
      {adpWarning && (
        <div className="alert alert-warning mt-4 py-2 text-xs">
          <span>{adpWarning} Mock timing remains available.</span>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h4 className="font-bold">Primary Tier 1 shortlist</h4>
          <p className="text-xs text-base-content/55">
            Up to two big-play fits with the cheapest responsible Grundle windows.
          </p>
        </div>
        <span className="badge badge-outline badge-sm">
          {plan.selectedMockCount.toString()} mocks selected
        </span>
      </div>

      {plan.primaryTargets.length === 0 ? (
        <div className="alert mt-3">
          <span>No available Tier 1 targets were resolved.</span>
        </div>
      ) : (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {plan.primaryTargets.map((player) => (
            <TargetCard key={player.playerId} player={player} teamCount={teamCount} />
          ))}
        </div>
      )}

      <details
        className="collapse-arrow collapse mt-4 border border-base-300 bg-base-100"
        open={plan.primaryTargets.length < 2}
      >
        <summary className="collapse-title min-h-0 py-3 text-sm font-bold">
          Tier 2 fallback plan
          <span className="ml-2 font-normal text-base-content/50">
            Only if the Tier 1 plan breaks
          </span>
        </summary>
        <div className="collapse-content">
          <div className="grid gap-3 lg:grid-cols-2">
            {plan.fallbackTargets.map((player) => (
              <TargetCard key={player.playerId} player={player} teamCount={teamCount} />
            ))}
          </div>
        </div>
      </details>

      <div className="mt-4 text-xs text-base-content/55">
        Draft one target. A second rostered IDP is an exceptional-value choice, not the plan.
      </div>
    </section>
  );
}

export default IdpDraftPlan;
