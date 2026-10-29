import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../database/transaction.manager';
import { ExercisesService } from '../../exercises/exercises.service';
import { PlansQueryHandler } from '../handlers/plans-query.handler';
import { StarterPlansPolicy } from '../policies/starter-plans.policy';

/**
 * Takes over `PlansService.seedStarterTemplates`. It runs inside the transaction that has just
 * created the workspace, whose scope the database already set, so it asks for no scope of its own
 * (that would be refused). Outside such a transaction there is no scope and row level security
 * blocks the insert: it fails closed.
 */
@Injectable()
export class StarterPlansOrchestrator {
  constructor(
    private readonly plansQuery: PlansQueryHandler,
    private readonly exercises: ExercisesService,
    private readonly starterPlans: StarterPlansPolicy,
    private readonly transactions: TransactionManager,
  ) {}

  execute(workspaceId: string): Promise<void> {
    return this.transactions.run(async () => {
      const templates = this.starterPlans.starterTemplates();
      const scheme = this.starterPlans.setScheme();

      const slugs = [
        ...new Set(
          templates.flatMap((t) => t.days.flatMap((d) => d.exerciseSlugs)),
        ),
      ];
      const library = new Map(
        (await this.exercises.findLibraryBySlugs(slugs)).map((e) => [
          e.slug,
          e,
        ]),
      );

      const created = await this.plansQuery.createTemplates(
        workspaceId,
        templates.map((t) => ({ name: t.name, goal: t.goal, weeks: 1 })),
      );
      await this.plansQuery.insertDays(
        workspaceId,
        templates.map((template, index) => ({
          planId: created[index].id,
          days: template.days.map((day) => ({
            weekNo: 1,
            dayNo: day.dayNo,
            name: day.name,
            isRest: false,
            isDeload: false,
            notes: null,
            exercises: day.exerciseSlugs.map((slug) => {
              const exercise = library.get(slug);
              if (!exercise) {
                // a library without its own exercises is a broken deployment, not a coach's mistake
                throw new Error(`The exercise library is missing "${slug}"`);
              }
              return {
                exerciseId: exercise.id,
                exerciseName: exercise.nameAr,
                coachNote: null,
                supersetGroup: null,
                sets: Array.from({ length: scheme.sets }, () => ({
                  reps: scheme.reps,
                  restSeconds: scheme.restSeconds,
                })),
              };
            }),
          })),
        })),
      );
    });
  }
}
