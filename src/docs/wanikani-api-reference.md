# WaniKani API v2 — Quick Reference

**Official docs:** https://docs.api.wanikani.com/20170710/

## Basics

- Base URL: `https://api.wanikani.com/v2/`
- Auth: `Authorization: Bearer <token>`
- Revision header: `Wanikani-Revision: 20170710`
- Rate limit: 60 req/min

## Response Envelope

Resources: `{ id, object, url, data_updated_at, data }`
Collections: `{ object: "collection", url, pages, total_count, data_updated_at, data[] }`
Pagination: cursor-based via `page_after_id` / `page_before_id`, 500/page default (1000 for subjects/reviews)
Errors: `{ error: string, code: number }`

## Endpoints

| Endpoint | Methods | Notes |
|----------|---------|-------|
| `/assignments` | GET, GET /:id | Filter: available_after/before, srs_stages, levels, subject_types, burned, started, unlocked |
| `/assignments/:id/start` | PUT | Starts lesson; sets srs_stage=1, started_at, available_at |
| `/reviews` | GET, POST | GET returns empty (not persisted); POST creates review + updates assignment & review_statistic |
| `/review_statistics` | GET, GET /:id | Filter: hidden, ids, percentages_greater/less_than, subject_ids, subject_types |
| `/study_materials` | GET, GET /:id, POST, PUT /:id | One per subject; fields: meaning_note, reading_note, meaning_synonyms |
| `/subjects` | GET, GET /:id | Types: radical, kanji, vocabulary, kana_vocabulary; max 1000/page |
| `/level_progressions` | GET, GET /:id | Timestamps: unlocked → started → passed → completed |
| `/spaced_repetition_systems` | GET, GET /:id | Stages array with position, interval, interval_unit |
| `/summary` | GET | Report (not collection) of lesson/review availability; reviews grouped by hour for 24h |
| `/user` | GET, PUT | PUT updates preferences only |
| `/voice_actors` | GET, GET /:id | — |
| `/resets` | GET, GET /:id | — |

## SRS Stage Calculation

- Correct (0 incorrect): `new_stage = min(current + 1, 9)`
- Incorrect: `new_stage = max(current − ceil(incorrect/2) × penalty, 1)`
  - penalty = 2 if current_stage ≥ 5 (Guru+), else 1
- `available_at` = `created_at + stage.interval`, floored to nearest hour

## Common Filter Params

Most collection endpoints accept: `ids`, `updated_after`, `subject_ids`, `subject_types`
Arrays: comma-delimited string — `?ids=8,16,64`
Conditional requests: `If-None-Match` (ETag) and `If-Modified-Since` supported → 304
