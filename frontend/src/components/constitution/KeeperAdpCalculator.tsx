import { useId, useState } from 'react';
import {
  calculateUndraftedKeeperCost,
  CURRENT_DRAFT_ROUNDS,
  KEEPER_ADP_TEAM_COUNT,
} from '../../utils/keeperAdp';

const formatAdp = (adp: number): string =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(adp);

export function KeeperAdpCalculator() {
  const inputId = useId();
  const helpId = `${inputId}-help`;
  const [adpInput, setAdpInput] = useState('');
  const hasInput = adpInput.trim().length > 0;
  const parsedAdp = hasInput ? Number(adpInput) : Number.NaN;
  const calculation = calculateUndraftedKeeperCost(parsedAdp);
  const hasError = hasInput && calculation === null;

  return (
    <section
      aria-labelledby="keeper-adp-calculator-heading"
      className="card border border-primary/25 bg-primary/5 shadow-sm"
    >
      <div className="card-body gap-4 p-4 sm:p-5">
        <div>
          <h3 id="keeper-adp-calculator-heading" className="card-title text-base sm:text-lg">
            Undrafted keeper ADP calculator
          </h3>
          <p className="mt-1 text-sm text-base-content/60">
            Current setup: {KEEPER_ADP_TEAM_COUNT.toString()} Teams and{' '}
            {CURRENT_DRAFT_ROUNDS.toString()} draft rounds.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)] sm:items-end">
          <div className="form-control w-full">
            <label className="label py-1 text-sm font-semibold" htmlFor={inputId}>
              Sleeper ADP on draft day
            </label>
            <input
              aria-describedby={helpId}
              aria-invalid={hasError}
              className={`input input-bordered w-full ${hasError ? 'input-error' : ''}`}
              id={inputId}
              inputMode="decimal"
              min="1"
              placeholder="Example: 74.3"
              step="any"
              type="number"
              value={adpInput}
              onChange={(event) => {
                setAdpInput(event.target.value);
              }}
            />
            <span id={helpId} className="label py-1 text-xs text-base-content/50">
              Decimal ADP values are okay.
            </span>
          </div>

          <div
            aria-live="polite"
            className={`rounded-box border p-4 ${
              hasError ? 'border-error/40 bg-error/10' : 'border-base-300 bg-base-100'
            }`}
            data-testid="keeper-adp-result"
            role="status"
          >
            {!hasInput && (
              <p className="text-sm text-base-content/55">
                Enter an ADP to calculate the first Keeper Season cost.
              </p>
            )}

            {hasError && (
              <p className="text-sm font-semibold text-error">Enter an ADP of 1 or higher.</p>
            )}

            {calculation && (
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-base-content/50">
                  Keeper cost
                </div>
                <div className="mt-0.5 text-2xl font-bold text-primary">
                  Round {calculation.keeperRound.toString()}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-base-content/70">
                  ADP {formatAdp(calculation.adp)} falls in Round {calculation.adpRound.toString()}{' '}
                  (picks {calculation.roundStartPick.toString()}-
                  {calculation.roundEndPick.toString()}).{' '}
                  {calculation.wasCapped
                    ? `Adding two rounds reaches Round ${calculation.uncappedKeeperRound.toString()}, so the final-round cap sets the cost at Round ${calculation.keeperRound.toString()}.`
                    : `Adding two rounds sets the cost at Round ${calculation.keeperRound.toString()}.`}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default KeeperAdpCalculator;
