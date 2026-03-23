-- api/migrations/check-lessons.sql
--
-- Run in Supabase SQL Editor to check lessons table state.
-- If lesson_count = 0, run seed-lessons.sql to populate the knowledge base.

SELECT COUNT(*) AS lesson_count FROM lessons;

-- If 0: run seed-lessons.sql
-- If > 0: knowledge base is seeded — no action needed

-- To see lessons by category:
-- SELECT category, COUNT(*) as count FROM lessons GROUP BY category ORDER BY count DESC;

-- To see lessons that have been applied automatically:
-- SELECT category, problem FROM lessons WHERE applied_automatically = true ORDER BY category;
