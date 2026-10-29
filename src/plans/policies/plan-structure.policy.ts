import { Injectable } from '@nestjs/common';
import type { PlanDayInput } from '../interfaces/plan.interface';

export type PlanStructureCheck =
  { outcome: 'valid' } | { outcome: 'invalid'; problems: string[] };

/**
 * What makes a set of days a sensible plan, beyond each field being well formed: no day twice, none
 * past the plan's last week, no exercises on a rest day, no superset of one. Every problem at once,
 * so the coach fixes them in one go.
 */
@Injectable()
export class PlanStructurePolicy {
  check(weeks: number, days: PlanDayInput[]): PlanStructureCheck {
    const problems: string[] = [];
    const seen = new Set<string>();

    days.forEach((day, index) => {
      const where = `days[${index}]`;
      if (day.weekNo > weeks) {
        problems.push(`${where}.weekNo: beyond the plan`);
      }

      const key = `${day.weekNo}:${day.dayNo}`;
      if (seen.has(key)) {
        problems.push(`${where}: duplicate`);
      }
      seen.add(key);

      if (day.isRest && day.exercises.length > 0) {
        problems.push(`${where}: a rest day has no exercises`);
      }
      problems.push(...this.lonelySupersets(where, day));
    });

    return problems.length > 0
      ? { outcome: 'invalid', problems }
      : { outcome: 'valid' };
  }

  /** A superset is at least two exercises done together; a letter on one exercise is a slip. */
  private lonelySupersets(where: string, day: PlanDayInput): string[] {
    const uses = new Map<string, number>();
    for (const exercise of day.exercises) {
      if (exercise.supersetGroup) {
        uses.set(
          exercise.supersetGroup,
          (uses.get(exercise.supersetGroup) ?? 0) + 1,
        );
      }
    }
    return day.exercises.flatMap((exercise, index) =>
      exercise.supersetGroup && uses.get(exercise.supersetGroup) === 1
        ? [`${where}.exercises[${index}].supersetGroup: alone`]
        : [],
    );
  }
}
