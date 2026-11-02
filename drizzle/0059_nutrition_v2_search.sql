CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
-- food-search-ar-v1: keep display text intact; normalize only the search copy.
CREATE FUNCTION normalize_search_text(input text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT btrim(regexp_replace(
    translate(
      regexp_replace(normalize(input, NFKC),
        U&'[\0610-\061A\0640\064B-\065F\0670\06D6-\06DC\06DF-\06E4\06E7-\06E8\06EA-\06ED]', '', 'g'),
      'أإآٱىة٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      'اااايه01234567890123456789abcdefghijklmnopqrstuvwxyz'),
    U&'[\0009-\000D\0020\0085\00A0\1680\2000-\200A\2028\2029\202F\205F\3000]+', ' ', 'g'));
$$;
--> statement-breakpoint
CREATE FUNCTION foods_fill_search_name() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_name := normalize_search_text(concat_ws(' ', NEW.name_ar, NEW.name_en, NEW.brand));
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION recipes_fill_search_name() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_name := normalize_search_text(concat_ws(' ', NEW.name_ar, NEW.name_en));
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION nutrition_fill_search_alias() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_alias := normalize_search_text(NEW.alias);
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER foods_search_name BEFORE INSERT OR UPDATE ON foods
FOR EACH ROW EXECUTE FUNCTION foods_fill_search_name();
--> statement-breakpoint
CREATE TRIGGER recipes_search_name BEFORE INSERT OR UPDATE ON recipes
FOR EACH ROW EXECUTE FUNCTION recipes_fill_search_name();
--> statement-breakpoint
CREATE TRIGGER food_aliases_search_alias BEFORE INSERT OR UPDATE ON food_aliases
FOR EACH ROW EXECUTE FUNCTION nutrition_fill_search_alias();
--> statement-breakpoint
CREATE TRIGGER recipe_aliases_search_alias BEFORE INSERT OR UPDATE ON recipe_aliases
FOR EACH ROW EXECUTE FUNCTION nutrition_fill_search_alias();
--> statement-breakpoint
-- Temporarily let the migration owner backfill shared and private rows.
ALTER TABLE foods NO FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
UPDATE foods SET search_name = normalize_search_text(concat_ws(' ', name_ar, name_en, brand));
--> statement-breakpoint
ALTER TABLE foods FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE INDEX foods_search_name_trgm_idx ON foods USING gin (search_name gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX food_aliases_search_alias_trgm_idx ON food_aliases USING gin (search_alias gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX recipes_search_name_trgm_idx ON recipes USING gin (search_name gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX recipe_aliases_search_alias_trgm_idx ON recipe_aliases USING gin (search_alias gin_trgm_ops);
