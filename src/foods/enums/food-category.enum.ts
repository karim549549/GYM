/** What kind of food it is, for filtering and for grouping in a plan. */
export enum FoodCategory {
  PROTEIN = 'protein',
  CARB = 'carb',
  FAT = 'fat',
  VEGETABLE = 'vegetable',
  FRUIT = 'fruit',
  DAIRY = 'dairy',
  DRINK = 'drink',
  /** A whole dish with its macros already worked out for an average portion, such as koshari. */
  COMPOSITE = 'composite',
  SUPPLEMENT = 'supplement',
}
