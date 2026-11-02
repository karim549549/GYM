import { Injectable } from '@nestjs/common';

export interface StarterMealTemplate {
  name: string;
  caloriesKcalTarget: number;
  proteinGTarget: number;
  carbsGTarget: number;
  fatGTarget: number;
  meals: {
    name: string;
    /** `HH:MM`. */
    suggestedTime: string;
    /** The amount is in the food's default portion: 2 eggs, 1 cup, half a loaf. */
    items: { slug: string; quantity: number }[];
  }[];
}

/**
 * The nutrition templates every new coach starts with, in the foods an Egyptian client actually
 * eats. As with workout plans, the default way to build a plan is a template, never a blank page.
 * Foods are named by the library's handle; amounts are in each food's default portion, since nobody
 * weighs their food. The meals repeat every day: a coach who wants variety pins a meal to a day.
 */
@Injectable()
export class StarterMealPlansPolicy {
  starterTemplates(): StarterMealTemplate[] {
    return [
      {
        name: 'تنشيف - حوالي 1500 سعر',
        caloriesKcalTarget: 1500,
        proteinGTarget: 130,
        carbsGTarget: 120,
        fatGTarget: 50,
        meals: [
          {
            name: 'الفطار',
            suggestedTime: '08:00',
            items: [
              { slug: 'egg-boiled', quantity: 2 },
              { slug: 'bread-baladi', quantity: 0.5 },
              { slug: 'cucumber', quantity: 1 },
              { slug: 'tomato', quantity: 1 },
            ],
          },
          {
            name: 'الغداء',
            suggestedTime: '14:00',
            items: [
              { slug: 'chicken-breast-grilled', quantity: 1.5 },
              { slug: 'rice-white-cooked', quantity: 1 },
              { slug: 'zucchini-cooked', quantity: 1 },
              { slug: 'olive-oil', quantity: 1 },
            ],
          },
          {
            name: 'سناك',
            suggestedTime: '17:00',
            items: [
              { slug: 'yogurt-plain', quantity: 1 },
              { slug: 'apple', quantity: 1 },
            ],
          },
          {
            name: 'العشاء',
            suggestedTime: '21:00',
            items: [
              { slug: 'tuna-canned-water', quantity: 1 },
              { slug: 'bread-baladi', quantity: 0.5 },
              { slug: 'lettuce', quantity: 2 },
            ],
          },
        ],
      },
      {
        name: 'تضخيم - حوالي 2800 سعر',
        caloriesKcalTarget: 2800,
        proteinGTarget: 180,
        carbsGTarget: 320,
        fatGTarget: 90,
        meals: [
          {
            name: 'الفطار',
            suggestedTime: '08:00',
            items: [
              { slug: 'ful-with-oil', quantity: 1 },
              { slug: 'egg-boiled', quantity: 2 },
              { slug: 'bread-baladi', quantity: 1 },
              { slug: 'milk-full-fat', quantity: 1 },
            ],
          },
          {
            name: 'الغداء',
            suggestedTime: '14:00',
            items: [
              { slug: 'chicken-thigh-grilled', quantity: 2 },
              { slug: 'rice-white-cooked', quantity: 3 },
              { slug: 'broccoli-cooked', quantity: 1 },
              { slug: 'olive-oil', quantity: 1 },
            ],
          },
          {
            name: 'سناك',
            suggestedTime: '17:30',
            items: [
              { slug: 'peanut-butter', quantity: 2 },
              { slug: 'banana', quantity: 2 },
              { slug: 'whey-protein', quantity: 1 },
            ],
          },
          {
            name: 'العشاء',
            suggestedTime: '21:00',
            items: [
              { slug: 'beef-lean-cooked', quantity: 1.5 },
              { slug: 'potato-boiled', quantity: 2 },
              { slug: 'spinach-cooked', quantity: 1 },
            ],
          },
        ],
      },
    ];
  }
}
