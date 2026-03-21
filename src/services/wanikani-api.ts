import pRetry from "p-retry";

const BASE_URL = "https://api.wanikani.com/v2";
const REVISION = "20170710";

interface WKCollectionResponse<T> {
  object: "collection";
  total_count: number;
  data_updated_at: string | null;
  pages: {
    per_page: number;
    next_url: string | null;
    previous_url: string | null;
  };
  data: WKResource<T>[];
}

export interface WKResource<T> {
  id: number;
  object: string;
  url: string;
  data_updated_at: string;
  data: T;
}

export interface WKUserData {
  id: string;
  username: string;
  level: number;
  profile_url: string;
  started_at: string;
  current_vacation_started_at: string | null;
  subscription: {
    active: boolean;
    type: string;
    max_level_granted: number;
    period_ends_at: string | null;
  };
}

export interface WKSubjectData {
  characters: string | null;
  slug: string;
  level: number;
  hidden_at: string | null;
  document_url: string;
  meanings: { meaning: string; primary: boolean; accepted_answer: boolean }[];
  auxiliary_meanings: { meaning: string; type: string }[];
  readings?: {
    reading: string;
    primary: boolean;
    accepted_answer: boolean;
    type?: string;
  }[];
  meaning_mnemonic: string;
  meaning_hint?: string | null;
  reading_mnemonic?: string;
  reading_hint?: string | null;
  component_subject_ids?: number[];
  amalgamation_subject_ids?: number[];
  visually_similar_subject_ids?: number[];
  parts_of_speech?: string[];
  context_sentences?: { en: string; ja: string }[];
  pronunciation_audios?: {
    url: string;
    content_type: string;
    metadata: Record<string, unknown>;
  }[];
  character_images?: {
    url: string;
    content_type: string;
    metadata: Record<string, unknown>;
  }[];
  lesson_position: number;
  spaced_repetition_system_id: number;
}

export interface WKAssignmentData {
  subject_id: number;
  subject_type: string;
  srs_stage: number;
  unlocked_at: string | null;
  started_at: string | null;
  passed_at: string | null;
  burned_at: string | null;
  available_at: string | null;
  resurrected_at: string | null;
  hidden: boolean;
}

export interface WKReviewStatisticData {
  subject_id: number;
  subject_type: string;
  meaning_correct: number;
  meaning_incorrect: number;
  meaning_max_streak: number;
  meaning_current_streak: number;
  reading_correct: number;
  reading_incorrect: number;
  reading_max_streak: number;
  reading_current_streak: number;
  percentage_correct: number;
  hidden: boolean;
}

export interface WKStudyMaterialData {
  subject_id: number;
  subject_type: string;
  meaning_note: string | null;
  reading_note: string | null;
  meaning_synonyms: string[];
  hidden: boolean;
}

export interface WKLevelProgressionData {
  level: number;
  created_at: string;
  unlocked_at: string | null;
  started_at: string | null;
  passed_at: string | null;
  completed_at: string | null;
  abandoned_at: string | null;
}

export interface WKSrsSystemData {
  name: string;
  description: string;
  unlocking_stage_position: number;
  starting_stage_position: number;
  passing_stage_position: number;
  burning_stage_position: number;
  stages: {
    position: number;
    interval: number | null;
    interval_unit: string | null;
  }[];
}

export type FetchProgressCallback = (
  count: number,
  total: number,
) => void | Promise<void>;

export class WaniKaniClient {
  private headers: Record<string, string>;

  constructor(apiKey: string) {
    this.headers = {
      Authorization: `Bearer ${apiKey}`,
      "Wanikani-Revision": REVISION,
    };
  }

  async getUser(): Promise<WKResource<WKUserData>> {
    const res = await this.fetchWithRetry(`${BASE_URL}/user`);
    if (!res.ok) {
      throw new WKApiError(res.status, await res.text());
    }
    return res.json();
  }

  async getAllSubjects(
    onProgress?: FetchProgressCallback,
  ): Promise<WKResource<WKSubjectData>[]> {
    return this.fetchAll<WKSubjectData>("/subjects", onProgress);
  }

  async getAllAssignments(
    onProgress?: FetchProgressCallback,
  ): Promise<WKResource<WKAssignmentData>[]> {
    return this.fetchAll<WKAssignmentData>("/assignments", onProgress);
  }

  async getAllReviewStatistics(
    onProgress?: FetchProgressCallback,
  ): Promise<WKResource<WKReviewStatisticData>[]> {
    return this.fetchAll<WKReviewStatisticData>(
      "/review_statistics",
      onProgress,
    );
  }

  async getAllStudyMaterials(
    onProgress?: FetchProgressCallback,
  ): Promise<WKResource<WKStudyMaterialData>[]> {
    return this.fetchAll<WKStudyMaterialData>("/study_materials", onProgress);
  }

  async getAllLevelProgressions(
    onProgress?: FetchProgressCallback,
  ): Promise<WKResource<WKLevelProgressionData>[]> {
    return this.fetchAll<WKLevelProgressionData>(
      "/level_progressions",
      onProgress,
    );
  }

  async getAllSrsSystems(
    onProgress?: FetchProgressCallback,
  ): Promise<WKResource<WKSrsSystemData>[]> {
    return this.fetchAll<WKSrsSystemData>(
      "/spaced_repetition_systems",
      onProgress,
    );
  }

  private async fetchWithRetry(url: string): Promise<Response> {
    return pRetry(
      async () => {
        const res = await fetch(url, { headers: this.headers });
        if (res.status === 429) {
          const resetEpoch = Number(res.headers.get("RateLimit-Reset") ?? 0);
          const waitMs = resetEpoch
            ? Math.max(0, resetEpoch * 1000 - Date.now()) + 1000
            : 0;
          // Sleep here so p-retry's own backoff (minTimeout: 0) adds nothing
          if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
          throw new Error("Rate limited by WaniKani API");
        }
        return res;
      },
      { retries: 5, minTimeout: 0, factor: 1 },
    );
  }

  private async fetchAll<T>(
    path: string,
    onProgress?: FetchProgressCallback,
  ): Promise<WKResource<T>[]> {
    const all: WKResource<T>[] = [];
    let url: string | null = `${BASE_URL}${path}`;

    while (url) {
      const res = await this.fetchWithRetry(url);
      if (!res.ok) {
        throw new WKApiError(res.status, await res.text());
      }
      const body: WKCollectionResponse<T> = await res.json();
      all.push(...body.data);
      await onProgress?.(all.length, body.total_count);
      url = body.pages.next_url;
    }

    return all;
  }
}

export class WKApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`WaniKani API error ${status}: ${body}`);
  }
}
