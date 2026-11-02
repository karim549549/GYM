-- A fingerprint of everything a coach can change about a food, so a review can tell the food it was asked
-- to publish from a food edited afterwards. Row level security applies to the caller as usual.
CREATE FUNCTION food_content_fingerprint(p_food_id uuid) RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT md5(jsonb_build_object(
    'food', to_jsonb(f) - 'id' - 'workspace_id',
    'portions', (SELECT coalesce(jsonb_agg(to_jsonb(p) - 'id' - 'food_id' ORDER BY p.sort_order, p.name_ar), '[]'::jsonb) FROM food_portions p WHERE p.food_id = f.id),
    'nutrients', (SELECT coalesce(jsonb_agg(to_jsonb(n) - 'id' - 'food_id' ORDER BY n.nutrient_id), '[]'::jsonb) FROM food_nutrients n WHERE n.food_id = f.id),
    'aliases', (SELECT coalesce(jsonb_agg(to_jsonb(a) - 'id' - 'food_id' ORDER BY a.kind, a.alias), '[]'::jsonb) FROM food_aliases a WHERE a.food_id = f.id)
  )::text)
  FROM foods f WHERE f.id = p_food_id
$$;
--> statement-breakpoint
-- Requests made before this have no fingerprint: they are marked 'legacy', never equal a real one, so an admin rejects them and the coach asks again.
ALTER TABLE "food_publication_requests" ADD COLUMN "content_fingerprint" text NOT NULL DEFAULT 'legacy';
--> statement-breakpoint
ALTER TABLE "food_publication_requests" ALTER COLUMN "content_fingerprint" DROP DEFAULT;
