import { Injectable } from '@nestjs/common';

export interface StarterTemplate {
  name: string;
  goal: string;
  days: { dayNo: number; name: string; exerciseSlugs: string[] }[];
}

/**
 * The templates every new coach starts with. The product's rule is that the default way to build a
 * plan is a template, never a blank page: a coach who opens a blank page closes it and goes back to
 * Excel. Each is one week, which is how most programs are written; the coach sets the length when
 * copying it for a client. Exercises are named by the library's handle, so these stay right when a
 * library exercise is renamed.
 */
@Injectable()
export class StarterPlansPolicy {
  starterTemplates(): StarterTemplate[] {
    return [
      {
        name: 'جسم كامل - 3 أيام',
        goal: 'لياقة عامة',
        days: [
          {
            dayNo: 1,
            name: 'اليوم الأول',
            exerciseSlugs: [
              'back-squat',
              'barbell-bench-press',
              'barbell-row',
              'overhead-press',
              'plank',
            ],
          },
          {
            dayNo: 3,
            name: 'اليوم الثاني',
            exerciseSlugs: [
              'romanian-deadlift',
              'incline-dumbbell-press',
              'lat-pulldown',
              'lateral-raise',
              'crunch',
            ],
          },
          {
            dayNo: 5,
            name: 'اليوم الثالث',
            exerciseSlugs: [
              'leg-press',
              'push-up',
              'dumbbell-row',
              'dumbbell-curl',
              'triceps-pushdown',
            ],
          },
        ],
      },
      {
        name: 'دفع / سحب / أرجل - 6 أيام',
        goal: 'بناء عضل',
        days: [
          {
            dayNo: 1,
            name: 'دفع',
            exerciseSlugs: [
              'barbell-bench-press',
              'incline-dumbbell-press',
              'overhead-press',
              'lateral-raise',
              'triceps-pushdown',
            ],
          },
          {
            dayNo: 2,
            name: 'سحب',
            exerciseSlugs: [
              'lat-pulldown',
              'barbell-row',
              'seated-cable-row',
              'face-pull',
              'barbell-curl',
            ],
          },
          {
            dayNo: 3,
            name: 'أرجل',
            exerciseSlugs: [
              'back-squat',
              'leg-press',
              'romanian-deadlift',
              'leg-curl',
              'standing-calf-raise',
            ],
          },
          {
            dayNo: 4,
            name: 'دفع',
            exerciseSlugs: [
              'incline-dumbbell-press',
              'cable-fly',
              'overhead-press',
              'lateral-raise',
              'skull-crusher',
            ],
          },
          {
            dayNo: 5,
            name: 'سحب',
            exerciseSlugs: [
              'pull-up',
              'dumbbell-row',
              'face-pull',
              'hammer-curl',
              'dumbbell-shrug',
            ],
          },
          {
            dayNo: 6,
            name: 'أرجل',
            exerciseSlugs: [
              'goblet-squat',
              'walking-lunge',
              'hip-thrust',
              'leg-extension',
              'seated-calf-raise',
            ],
          },
        ],
      },
      {
        name: 'علوي / سفلي - 4 أيام',
        goal: 'قوة وبناء عضل',
        days: [
          {
            dayNo: 1,
            name: 'علوي',
            exerciseSlugs: [
              'barbell-bench-press',
              'barbell-row',
              'overhead-press',
              'lat-pulldown',
              'barbell-curl',
              'triceps-pushdown',
            ],
          },
          {
            dayNo: 2,
            name: 'سفلي',
            exerciseSlugs: [
              'back-squat',
              'romanian-deadlift',
              'leg-press',
              'leg-curl',
              'standing-calf-raise',
            ],
          },
          {
            dayNo: 4,
            name: 'علوي',
            exerciseSlugs: [
              'incline-dumbbell-press',
              'seated-cable-row',
              'lateral-raise',
              'pull-up',
              'hammer-curl',
              'skull-crusher',
            ],
          },
          {
            dayNo: 5,
            name: 'سفلي',
            exerciseSlugs: [
              'goblet-squat',
              'hip-thrust',
              'walking-lunge',
              'leg-extension',
              'seated-calf-raise',
            ],
          },
        ],
      },
    ];
  }

  /** Every exercise of a starter template is three sets of 8 to 12 with 90 seconds of rest. */
  setScheme(): { sets: number; reps: string; restSeconds: number } {
    return { sets: 3, reps: '8-12', restSeconds: 90 };
  }
}
