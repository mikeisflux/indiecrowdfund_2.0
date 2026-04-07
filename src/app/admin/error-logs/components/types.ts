export interface ErrorGroup {
  id: string;
  fingerprint: string;
  title: string;
  type: string;
  level: string;
  source: string;
  endpoint: string | null;
  status: string;
  assignedTo: string | null;
  eventCount: number;
  firstSeen: string;
  lastSeen: string;
  latestMessage: string;
  latestStack: string | null;
  latestMetadata: unknown;
}

export interface ErrorOccurrence {
  id: string;
  groupId: string;
  message: string;
  stack: string | null;
  url: string | null;
  method: string | null;
  statusCode: number | null;
  userId: string | null;
  userAgent: string | null;
  ip: string | null;
  metadata: unknown;
  timestamp: string;
}

export interface ErrorStats {
  unresolved: number;
  inProgress: number;
  resolved: number;
  ignored: number;
  fatal: number;
  last24hEvents: number;
}

export interface FrequencyPoint {
  hour: string;
  count: number;
}
