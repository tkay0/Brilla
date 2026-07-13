import { BadRequestException } from '@nestjs/common';
import { RoundType } from '../../generated/prisma/enums.js';

const MCQ_ROUND_TYPES: ReadonlySet<RoundType> = new Set([
  RoundType.SpeedRace,
  RoundType.TrueFalse,
  RoundType.Riddle,
]);

const ROUND_TYPE_PARAM_MAP: Record<string, RoundType[]> = {
  SpeedRace: [RoundType.SpeedRace],
  TrueFalse: [RoundType.TrueFalse],
  Riddle: [RoundType.Riddle],
  Practice: [RoundType.General, RoundType.ProblemOfDay],
};

export function resolveRoundTypes(param: string): RoundType[] {
  const roundTypes = ROUND_TYPE_PARAM_MAP[param];
  if (!roundTypes) {
    throw new BadRequestException(
      `Unknown round type "${param}". Expected one of: ${Object.keys(ROUND_TYPE_PARAM_MAP).join(', ')}.`,
    );
  }
  return roundTypes;
}

export function isMcqRoundType(roundType: RoundType): boolean {
  return MCQ_ROUND_TYPES.has(roundType);
}
