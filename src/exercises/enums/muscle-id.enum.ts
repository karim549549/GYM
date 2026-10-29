/**
 * The muscles of the anatomy drawing. The list is closed: adding a muscle is a migration that
 * inserts its row, a path in the drawing, and a line here, and `test/exercises.e2e-spec.ts` fails
 * until the table and this enum agree.
 */
export enum MuscleId {
  CHEST = 'chest',
  FRONT_DELTS = 'front_delts',
  SIDE_DELTS = 'side_delts',
  REAR_DELTS = 'rear_delts',
  BICEPS = 'biceps',
  TRICEPS = 'triceps',
  FOREARMS = 'forearms',
  ABS = 'abs',
  OBLIQUES = 'obliques',
  LOWER_BACK = 'lower_back',
  LATS = 'lats',
  UPPER_BACK = 'upper_back',
  TRAPS = 'traps',
  GLUTES = 'glutes',
  QUADS = 'quads',
  HAMSTRINGS = 'hamstrings',
  CALVES = 'calves',
  ADDUCTORS = 'adductors',
  ABDUCTORS = 'abductors',
  HIP_FLEXORS = 'hip_flexors',
}
