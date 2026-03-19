export type AccessStatus =
  | "trial_active"
  | "trial_expired"
  | "subscription_active"
  | "subscription_expired";

export interface UserAccessSummary {
  user_id: string;
  access_status: AccessStatus;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  trial_message_limit: number | null;
  subscription_plan: string | null;
  subscription_started_at: string | null;
  subscription_ends_at: string | null;
  messages_used: number;
  pdf_uploads_used: number;
  input_tokens_used: number;
  output_tokens_used: number;
  total_tokens_used: number;
}