"""Independent check of the Grundle playoff odds against a saved Sleeper snapshot.

Written separately from the app code (frontend/src/utils/grundleOdds.ts): the
seeding below follows constitution section 11 directly. Standard library only;
it reads sleeper-snapshot.json next to this file and makes no network calls.

    python3 -I odds_check.py [crosscheck|rooting|weighted|boost|all]

Sections (fixed PRNG seeds, so output is repeatable):
  crosscheck  playoff odds under four score models, plus The Sweater Song's
              odds by its own remaining results (40,000 runs per model)
  rooting     other games that move The Sweater Song's odds most (40,000 runs)
  weighted    odds with week-12 results weighted by Sleeper's win
              probabilities, which the user read from the Sleeper app (200,000 runs)
  boost       The Sweater Song's odds if it scores B more points per week in
              weeks 13-14, week 12 weighted as above (100,000 runs per level)
"""

import itertools
import json
import math
import os
import random
import statistics as st
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SNAP = json.load(open(os.path.join(HERE, 'sleeper-snapshot.json'), encoding='utf-8'))

team = {
    t['rosterId']: dict(w=t['wins'], l=t['losses'], pf=t['pointsFor'], div=t['divisionId'])
    for t in SNAP['teams']
}
names = {t['rosterId']: t['name'] for t in SNAP['teams']}
scores = {t['rosterId']: t['weeklyScores'] for t in SNAP['teams']}
ids = sorted(team)
games = [tuple(g) for g in SNAP['remainingGames']]  # (week, rosterA, rosterB)
pick = lambda prefix: next(i for i in ids if names[i].startswith(prefix))
ME = pick('The Sweater Song')
KEY = [
    (g['winner'], g['loser'], g['probability'])
    for g in SNAP['sleeperWeek12WinProbabilities']['games']
]


def seed_order(wins, pf):
    """Constitution 11: seeds 1-3 division winners, 4-5 next best records,
    6 highest PF of the rest, then the rest. Records tie-break on PF."""
    standing = sorted(ids, key=lambda i: (-wins[i], -pf[i]))
    winners = [next(i for i in standing if team[i]['div'] == d) for d in sorted({team[i]['div'] for i in ids})]
    winners.sort(key=standing.index)
    rest = [i for i in standing if i not in winners]
    order = winners + rest[:2]
    rest = rest[2:]
    pf6 = max(rest, key=lambda i: (pf[i], -standing.index(i)))
    order.append(pf6)
    return order + [i for i in rest if i != pf6]


allscores = [x for i in ids for x in scores[i]]
LEAGUE_MEAN, LEAGUE_SD = st.mean(allscores), st.stdev(allscores)


def model(kind):
    """(mean, sd) per team. 'app' mirrors utils/seasonSimulation.ts."""
    out = {}
    for i in ids:
        s, n = scores[i], len(scores[i])
        shrunk = (n * st.mean(s) + 2 * LEAGUE_MEAN) / (n + 2)
        if kind == 'app':
            out[i] = (shrunk, max(st.stdev(s), LEAGUE_SD / 2))
        elif kind == 'raw':
            out[i] = (st.mean(s), st.stdev(s))
        elif kind == 'league-sd':
            out[i] = (shrunk, LEAGUE_SD)
    return out


def play(rng, draw, on_game=None):
    """One playout; returns (top six roster ids, per-game winners)."""
    wins = {i: team[i]['w'] for i in ids}
    pf = {i: team[i]['pf'] for i in ids}
    winners = {}
    for g in games:
        w, a, b = g
        sa, sb = draw(rng, w, a, b)
        pf[a] += sa
        pf[b] += sb
        winner = a if sa >= sb else b
        wins[winner] += 1
        winners[g] = winner
    return set(seed_order(wins, pf)[:6]), winners


def normal_draw(m, boost=0):
    def draw(rng, week, a, b):
        ma = m[a][0] + (boost if a == ME and week > 12 else 0)
        mb = m[b][0] + (boost if b == ME and week > 12 else 0)
        return max(0, rng.gauss(ma, m[a][1])), max(0, rng.gauss(mb, m[b][1]))
    return draw


def bootstrap_draw(rng, week, a, b):
    return rng.choice(scores[a]), rng.choice(scores[b])


def crosscheck():
    results, cond = {}, {}
    for kind in ('app', 'raw', 'league-sd', 'bootstrap'):
        rng = random.Random(1)
        draw = bootstrap_draw if kind == 'bootstrap' else normal_draw(model(kind))
        hits = dict.fromkeys(ids, 0)
        for _ in range(40000):
            top6, winners = play(rng, draw)
            for i in top6:
                hits[i] += 1
            if kind == 'app':
                key = ''.join('W' if winners[g] == ME else 'L' for g in games if ME in g[1:])
                c = cond.setdefault(key, [0, 0])
                c[0] += 1
                c[1] += ME in top6
        results[kind] = {i: hits[i] / 40000 for i in ids}
    current = seed_order({i: team[i]['w'] for i in ids}, {i: team[i]['pf'] for i in ids})
    print(f"{'team':26} {'rec':5}  " + '  '.join(f'{k:>9}' for k in results))
    for i in current:
        cells = '  '.join(f'{results[k][i] * 100:8.1f}%' for k in results)
        print(f"{names[i][:26]:26} {team[i]['w']}-{team[i]['l']:<3} {cells}")
    print('\nThe Sweater Song by its own results (wk12 Mr. Hanky, wk13 Jahmyr, wk14 Brew Crew):')
    for key, (n, h) in sorted(cond.items(), key=lambda kv: -kv[0].count('W')):
        print(f'  {key}: {h / n * 100:5.1f}% of {n / 400:.1f}% of sims')


def rooting():
    rng, draw = random.Random(2), normal_draw(model('app'))
    tally = {g: [0, 0, 0, 0] for g in games if ME not in g[1:]}
    for _ in range(40000):
        top6, winners = play(rng, draw)
        hit = ME in top6
        for g, t in tally.items():
            if winners[g] == g[1]:
                t[0] += 1
                t[1] += hit
            else:
                t[2] += 1
                t[3] += hit
    rows = []
    for (w, a, b), t in tally.items():
        pa, pb = t[1] / t[0], t[3] / t[2]
        root, other = (a, b) if pa >= pb else (b, a)
        rows.append((abs(pa - pb), w, names[root], names[other], max(pa, pb), min(pa, pb)))
    print('Other games that move The Sweater Song most:')
    for _, w, root, other, hi, lo in sorted(rows, reverse=True)[:6]:
        print(f'  Wk{w}: root for {root[:24]} over {other[:24]}: {hi * 100:4.1f}% vs {lo * 100:4.1f}%')


def stratified(rng, draw, runs, watch):
    """P(top six) per watched team, by the four week-12 results in KEY."""
    strata = {}
    for _ in range(runs):
        top6, winners = play(rng, draw)
        by_pair = {frozenset(g[1:]): winners[g] for g in games if g[0] == 12}
        key = tuple(by_pair[frozenset((x, y))] == x for x, y, _ in KEY)
        s = strata.setdefault(key, [0] + [0] * len(watch))
        s[0] += 1
        for j, t in enumerate(watch):
            s[1 + j] += t in top6
    return strata


def weight(key, skip_first=False):
    pairs = list(zip(key, KEY))[1 if skip_first else 0:]
    return math.prod(q if won else 1 - q for won, (_, _, q) in pairs)


def weighted():
    watch = [ME] + [pick(p) for p in ('Still trading', 'Brew Crew', '5 Fingers', 'Bo Derek', 'Jahmyr')]
    strata = stratified(random.Random(4), normal_draw(model('app')), 200000, watch)
    total = sum(weight(k) for k in strata)
    print(f'runs 200000, probability mass covered {total:.4f}')
    for j, t in enumerate(watch):
        base = sum(s[1 + j] for s in strata.values()) / 200000
        odds = sum(weight(k) * s[1 + j] / s[0] for k, s in strata.items()) / total
        print(f'  {names[t][:26]:26} model-only {base * 100:5.1f}%   with Sleeper week-12 odds {odds * 100:5.1f}%')
    for won in (True, False):
        ks = [k for k in strata if k[0] == won]
        odds = sum(weight(k, True) * strata[k][1] / strata[k][0] for k in ks) / sum(weight(k, True) for k in ks)
        print(f"  The Sweater Song if it {'beats' if won else 'loses to'} Mr. Hanky: {odds * 100:.1f}%")


def boost():
    m = model('app')
    print(f"The Sweater Song model mean {m[ME][0]:.1f}, sd {m[ME][1]:.1f}")
    for b in (0, 5, 10, 15, 20, 30):
        strata = stratified(random.Random(5), normal_draw(m, b), 100000, [ME])
        odds = sum(weight(k) * s[1] / s[0] for k, s in strata.items())
        print(f'  +{b:>2} pts/week in weeks 13-14: {odds * 100:5.1f}%')


if __name__ == '__main__':
    sections = dict(crosscheck=crosscheck, rooting=rooting, weighted=weighted, boost=boost)
    chosen = sys.argv[1] if len(sys.argv) > 1 else 'all'
    for name, fn in sections.items():
        if chosen in (name, 'all'):
            print(f'== {name} ==')
            fn()
            print()
