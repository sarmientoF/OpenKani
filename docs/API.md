# API Reference

All routes under `/v2`. Responses follow WaniKani API v2 format.

## Authentication

All protected routes require a Bearer token (returned by `/v2/migrate`):

```
Authorization: Bearer <token>
```

## Public routes

### `POST /v2/migrate`

Import all WaniKani data into a per-user Turso database.

**Body:**
```json
{ "wanikani_api_key": "your-wk-api-key" }
```

**Query params:**
- `force=true` — wipe existing data and re-import

**Response:**
```json
{
  "status": "completed",
  "user_id": "uuid",
  "db_name": "md5hash",
  "counts": {
    "subjects": 9000,
    "assignments": 5000,
    "review_statistics": 4500,
    "study_materials": 50,
    "level_progressions": 30,
    "srs_systems": 1
  },
  "token": "bearer-token"
}
```

## Protected routes

### `GET /v2/user`

Returns user profile data.

### `GET /v2/subjects`

List subjects (radicals, kanji, vocabulary).

**Query params:** `ids`, `types`, `slugs`, `levels`, `hidden`, `updated_after`

Paginated — follow `pages.next_url` for more results.

### `GET /v2/assignments`

List assignments with SRS status.

**Query params:** `ids`, `subject_ids`, `subject_types`, `levels`, `available_before`, `available_after`, `srs_stages`, `unlocked`, `started`, `immediately_available_for_review`, `immediately_available_for_lessons`, `in_review`, `burned`, `updated_after`

### `PUT /v2/assignments/:id/start`

Start a lesson (unlock assignment). Optionally set `started_at`:

```json
{ "started_at": "2024-01-01T00:00:00.000Z" }
```

### `GET /v2/reviews`

Returns empty collection (review history not stored).

### `POST /v2/reviews`

Submit a review. Updates SRS stage, review statistics, and next review time.

**Body:**
```json
{
  "review": {
    "assignment_id": 123,
    "incorrect_meaning_answers": 0,
    "incorrect_reading_answers": 1,
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### `GET /v2/review_statistics`

Review accuracy stats per subject.

**Query params:** `ids`, `subject_ids`, `subject_types`, `updated_after`, `percentages_greater_than`, `percentages_less_than`

### `GET /v2/level_progressions`

Level progression history.

**Query params:** `ids`, `updated_after`

### `GET /v2/spaced_repetition_systems`

SRS system definitions (stages, intervals).

**Query params:** `ids`

### `GET /v2/study_materials`

User notes and synonyms per subject.

**Query params:** `ids`, `subject_ids`, `subject_types`, `updated_after`

### `POST /v2/study_materials`

Create study material.

```json
{
  "study_material": {
    "subject_id": 123,
    "meaning_note": "...",
    "reading_note": "...",
    "meaning_synonyms": ["..."]
  }
}
```

### `PUT /v2/study_materials/:id`

Update study material (same body as POST).

### `GET /v2/summary`

Dashboard summary — available lessons, reviews, next review time.

### `GET /v2/voice_actors`

Returns empty collection (not implemented).
