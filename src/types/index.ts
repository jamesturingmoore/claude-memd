// Database record types (matching claude-mem schema)

export interface ObservationRecord {
  id: number;
  memory_session_id: string;
  project: string;
  text: string | null;
  type: string;
  title?: string;
  subtitle?: string;
  facts?: string;
  narrative?: string;
  concepts?: string;
  files_read?: string;
  files_modified?: string;
  prompt_number?: number;
  discovery_tokens?: number;
  content_hash?: string;
  created_at: string;
  created_at_epoch: number;
}

export interface SessionSummaryRecord {
  id: number;
  memory_session_id: string;
  project: string;
  request?: string;
  investigated?: string;
  learned?: string;
  completed?: string;
  next_steps?: string;
  files_read?: string;
  files_edited?: string;
  notes?: string;
  discovery_tokens?: number;
  prompt_number?: number;
  created_at: string;
  created_at_epoch: number;
}

export interface UserPromptRecord {
  id: number;
  content_session_id: string;
  prompt_number: number;
  prompt_text: string;
  project?: string;
  created_at: string;
  created_at_epoch: number;
}

export interface SdkSessionRecord {
  id: number;
  content_session_id: string;
  memory_session_id: string | null;
  project: string;
  user_prompt: string | null;
  started_at: string;
  started_at_epoch: number;
  completed_at: string | null;
  completed_at_epoch: number | null;
  status: 'active' | 'completed' | 'failed';
  worker_port?: number;
  prompt_counter?: number;
}

export interface DatabaseStats {
  observations: number;
  summaries: number;
  prompts: number;
  sessions: number;
}

export interface DeleteResult {
  success: boolean;
  id?: number;
  deletedCount?: number;
  error?: string;
}

export interface ProjectDeleteResult {
  success: boolean;
  project: string;
  observations: number;
  summaries: number;
  prompts: number;
  sessions: number;
}

// API types

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
  project?: string;
}
