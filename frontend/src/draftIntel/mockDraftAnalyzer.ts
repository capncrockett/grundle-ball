export type MockDraftSelection = {
  playerId: string;
  pickNo: number;
};

export type MockDraftSample = {
  draftId: string;
  totalPicks: number;
  picks: MockDraftSelection[];
};

export type MockDraftAvailability = {
  overallPick: number;
  availableCount: number;
  sampleCount: number;
  percentage: number | null;
};

export type MockDraftPlayerAnalysis = {
  playerId: string;
  mockCount: number;
  meanPick: number | null;
  medianPick: number | null;
  earliestPick: number | null;
  latestPick: number | null;
  standardDeviation: number | null;
  availability: MockDraftAvailability[];
};

export type MockDraftAnalysis = {
  selectedMockCount: number;
  players: MockDraftPlayerAnalysis[];
};

const precise = (value: number): number => Number(value.toFixed(10));

const requirePositiveInteger = (value: number, label: string): void => {
  if (!Number.isInteger(value) || value <= 0)
    throw new Error(`${label} must be a positive integer`);
};

const validateSamples = (samples: MockDraftSample[]): void => {
  const draftIds = new Set<string>();
  samples.forEach((sample) => {
    if (!sample.draftId.trim()) throw new Error('Mock draft ID cannot be empty');
    if (draftIds.has(sample.draftId)) throw new Error(`Duplicate mock draft ${sample.draftId}`);
    draftIds.add(sample.draftId);
    requirePositiveInteger(sample.totalPicks, `Total picks for mock ${sample.draftId}`);

    const playerIds = new Set<string>();
    const pickNumbers = new Set<number>();
    sample.picks.forEach((pick) => {
      if (!pick.playerId.trim()) throw new Error(`Mock ${sample.draftId} has an empty player ID`);
      requirePositiveInteger(pick.pickNo, `Pick number in mock ${sample.draftId}`);
      if (pick.pickNo > sample.totalPicks) {
        throw new Error(`Pick ${pick.pickNo.toString()} is outside mock ${sample.draftId}`);
      }
      if (playerIds.has(pick.playerId)) {
        throw new Error(`Mock ${sample.draftId} contains player ${pick.playerId} more than once`);
      }
      if (pickNumbers.has(pick.pickNo)) {
        throw new Error(`Mock ${sample.draftId} contains duplicate pick ${pick.pickNo.toString()}`);
      }
      playerIds.add(pick.playerId);
      pickNumbers.add(pick.pickNo);
    });
  });
};

const median = (values: number[]): number => {
  const middle = Math.floor(values.length / 2);
  if (values.length % 2 === 1) return values[middle] ?? 0;
  return precise(((values[middle - 1] ?? 0) + (values[middle] ?? 0)) / 2);
};

export function analyzeMockDrafts(
  playerIds: string[],
  samples: MockDraftSample[],
  availabilityPicks: number[],
): MockDraftAnalysis {
  validateSamples(samples);

  const uniquePlayerIds = new Set(playerIds);
  if (uniquePlayerIds.size !== playerIds.length) throw new Error('Player IDs must be unique');
  playerIds.forEach((playerId) => {
    if (!playerId.trim()) throw new Error('Player ID cannot be empty');
  });

  const uniqueAvailabilityPicks = new Set(availabilityPicks);
  if (uniqueAvailabilityPicks.size !== availabilityPicks.length) {
    throw new Error('Availability picks must be unique');
  }
  availabilityPicks.forEach((pick) => {
    requirePositiveInteger(pick, 'Availability pick');
  });

  const pickByDraftAndPlayer = new Map<string, Map<string, number>>(
    samples.map((sample) => [
      sample.draftId,
      new Map(sample.picks.map((pick) => [pick.playerId, pick.pickNo])),
    ]),
  );

  const players = playerIds.map<MockDraftPlayerAnalysis>((playerId) => {
    const observedPicks = samples
      .map((sample) => pickByDraftAndPlayer.get(sample.draftId)?.get(playerId))
      .filter((pick): pick is number => pick !== undefined)
      .sort((a, b) => a - b);
    const meanPick =
      observedPicks.length === 0
        ? null
        : precise(observedPicks.reduce((sum, pick) => sum + pick, 0) / observedPicks.length);
    const standardDeviation =
      meanPick === null
        ? null
        : precise(
            Math.sqrt(
              observedPicks.reduce((sum, pick) => sum + (pick - meanPick) ** 2, 0) /
                observedPicks.length,
            ),
          );

    const availability = availabilityPicks.map<MockDraftAvailability>((overallPick) => {
      const eligibleSamples = samples.filter((sample) => sample.totalPicks >= overallPick);
      const availableCount = eligibleSamples.filter((sample) => {
        const selectedAt = pickByDraftAndPlayer.get(sample.draftId)?.get(playerId);
        return selectedAt === undefined || selectedAt >= overallPick;
      }).length;
      return {
        overallPick,
        availableCount,
        sampleCount: eligibleSamples.length,
        percentage:
          eligibleSamples.length === 0
            ? null
            : precise((availableCount / eligibleSamples.length) * 100),
      };
    });

    return {
      playerId,
      mockCount: observedPicks.length,
      meanPick,
      medianPick: observedPicks.length === 0 ? null : median(observedPicks),
      earliestPick: observedPicks.at(0) ?? null,
      latestPick: observedPicks.at(-1) ?? null,
      standardDeviation,
      availability,
    };
  });

  return { selectedMockCount: samples.length, players };
}
