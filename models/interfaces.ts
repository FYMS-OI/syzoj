
/* Judge State */

export enum Status {
  ACCEPTED = "Accepted",
  COMPILE_ERROR = "Compile Error",
  FILE_ERROR = "File Error",
  INVALID_INTERACTION = "Invalid Interaction",
  JUDGEMENT_FAILED = "Judgement Failed",
  MEMORY_LIMIT_EXCEEDED = "Memory Limit Exceeded",
  NO_TESTDATA = "No Testdata",
  OUTPUT_LIMIT_EXCEEDED = "Output Limit Exceeded",
  PARTIALLY_CORRECT = "Partially Correct",
  RUNTIME_ERROR = "Runtime Error",
  SYSTEM_ERROR = "System Error",
  TIME_LIMIT_EXCEEDED = "Time Limit Exceeded",
  UNKNOWN = "Unknown",
  WRONG_ANSWER = "Wrong Answer",
  WAITING = "Waiting"
}

/* Quote */

export enum QuoteType {
  hitokoto = 'hitokoto',
  image = 'image'
}

export interface DialogItem {
  from: string;
  content: string;
}

export interface HitokotoQuoteContent {
  hitokoto: string;
  html?: string;
  dialog?: DialogItem[];
  is_dialog: boolean;
}

export interface ImageQuoteContent {
  filename: string;
  url?: string;
  size: number;
}

export interface UserQuote {
  id: number;
  type: string;
  content: object;
  creation_time: string;
  update_time: string;
  from: string[];
  provider?: {
    id: number;
    username: string;
  };
  weight?: number;
}

export enum VoteType {
  up = 1,
  down = -1
}

export interface VoteSummary {
  self: number;
  total?: {
    up?: number;
    down?: number;
  }
}
