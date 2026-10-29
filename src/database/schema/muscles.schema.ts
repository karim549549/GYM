import { sql } from 'drizzle-orm';
import { check, pgTable, text } from 'drizzle-orm/pg-core';
import { BodySide } from '../../exercises/enums/body-side.enum';

const SIDE_VALUES = Object.values(BodySide)
  .map((side) => `'${side}'`)
  .join(', ');

/**
 * The muscles of the anatomy drawing. The list is closed (a coach does not invent muscles), so
 * this is a real table with a readable text key and the exercises point at it with a foreign key.
 * Reference data, shared by everyone, so it has no workspace.
 */
export const muscles = pgTable(
  'muscles',
  {
    id: text('id').primaryKey(),
    labelAr: text('label_ar').notNull(),
    labelEn: text('label_en').notNull(),
    /** The id of the path in the anatomy SVG: the join between the data and the drawing. */
    svgPathId: text('svg_path_id').notNull(),
    bodySide: text('body_side').$type<BodySide>().notNull(),
  },
  (table) => [
    check(
      'muscles_body_side_check',
      sql`${table.bodySide} in (${sql.raw(SIDE_VALUES)})`,
    ),
  ],
);
