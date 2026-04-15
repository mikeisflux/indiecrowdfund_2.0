/* eslint-disable @typescript-eslint/no-explicit-any */
// Stub types for Prisma Client when generated client is not available
// This allows TypeScript builds to pass before `prisma generate` is run
// On deployment, run `prisma generate` to get actual types

declare module "@prisma/client" {
  // Generic model delegate interface - uses any for build compatibility
  interface ModelDelegate<T = any> {
    findUnique(args: any): Promise<T | null>;
    findUniqueOrThrow(args: any): Promise<T>;
    findFirst(args?: any): Promise<T | null>;
    findFirstOrThrow(args?: any): Promise<T>;
    findMany(args?: any): Promise<T[]>;
    create(args: any): Promise<T>;
    createMany(args: any): Promise<{ count: number }>;
    update(args: any): Promise<T>;
    updateMany(args: any): Promise<{ count: number }>;
    upsert(args: any): Promise<T>;
    delete(args: any): Promise<T>;
    deleteMany(args?: any): Promise<{ count: number }>;
    count(args?: any): Promise<number>;
    aggregate(args: any): Promise<any>;
    groupBy(args: any): Promise<any[]>;
  }

  export class PrismaClient {
    // Stub kept permissive — Prisma 7 added `adapter`, `errorFormat`,
    // and other options; real types come from the generated client.
    constructor(options?: any);
    $connect(): Promise<void>;
    $disconnect(): Promise<void>;
    $executeRaw(query: any, ...values: any[]): Promise<number>;
    $queryRaw<T = any>(query: any, ...values: any[]): Promise<T>;
    $transaction<T>(fn: (prisma: PrismaClient) => Promise<T>): Promise<T>;
    $transaction<T extends any[]>(promises: [...T]): Promise<T>;

    // Model accessors
    user: ModelDelegate;
    account: ModelDelegate;
    session: ModelDelegate;
    verificationToken: ModelDelegate;
    project: ModelDelegate;
    reward: ModelDelegate;
    pledge: ModelDelegate;
    comment: ModelDelegate;
    update: ModelDelegate;
    fAQ: ModelDelegate;
    notification: ModelDelegate;
    projectView: ModelDelegate;
    referralTracker: ModelDelegate;
    userBehavior: ModelDelegate;
    userPreference: ModelDelegate;
    retailer: ModelDelegate;
    retailerProduct: ModelDelegate;
    retailerOrder: ModelDelegate;
    retailerOrderItem: ModelDelegate;
    survey: ModelDelegate;
    surveyResponse: ModelDelegate;
    projectImage: ModelDelegate;
    projectEvent: ModelDelegate;
    savedProject: ModelDelegate;
    creatorFollower: ModelDelegate;
    [key: string]: ModelDelegate | any;
  }

  // Enum stubs
  export type BehaviorEventType =
    | "PAGE_VIEW"
    | "PAGE_EXIT"
    | "PROJECT_VIEW"
    | "PROJECT_CLICK"
    | "REWARD_CLICK"
    | "PLEDGE_START"
    | "PLEDGE_COMPLETE"
    | "PLEDGE_ABANDON"
    | "PROJECT_SHARE"
    | "PROJECT_SAVE"
    | "SEARCH"
    | "FILTER_APPLY"
    | "VIDEO_PLAY"
    | "SCROLL_DEPTH";

  export type EventType =
    | "PAGE_VIEW"
    | "PROJECT_FOLLOW"
    | "VIDEO_PLAY"
    | "VIDEO_COMPLETE"
    | "PLEDGE_STARTED"
    | "PLEDGE_COMPLETED"
    | "PLEDGE_FAILED"
    | "SHARE_SOCIAL"
    | "SHARE_LINK"
    | "UPDATE_VIEW"
    | "COMMENT_POSTED"
    | "COMMENT_LIKED"
    | "FAQ_VIEW"
    | "SURVEY_START"
    | "SURVEY_COMPLETE"
    | "PROJECT_SAVE"
    | "PROJECT_UNSAVE"
    | "REFERRAL_CLICK";

  export type ProjectStatus =
    | "DRAFT"
    | "PENDING_REVIEW"
    | "SUBMITTED"
    | "REJECTED"
    | "LIVE"
    | "FUNDED"
    | "FAILED"
    | "CANCELLED";

  export type PledgeStatus =
    | "PENDING"
    | "COMPLETED"
    | "FAILED"
    | "REFUNDED"
    | "CANCELLED";

  export type RetailerStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";

  export type OrderStatus =
    | "PENDING"
    | "CONFIRMED"
    | "PROCESSING"
    | "SHIPPED"
    | "DELIVERED"
    | "CANCELLED";

  export type Role = "USER" | "ADMIN" | "CREATOR";

  // Prisma namespace for JSON types, Decimal, and error classes
  export namespace Prisma {
    export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
    export interface JsonObject {
      [key: string]: JsonValue;
    }
    export type JsonArray = JsonValue[];
    export type InputJsonValue = string | number | boolean | null | InputJsonObject | InputJsonArray;
    export interface InputJsonObject {
      [key: string]: InputJsonValue;
    }
    export type InputJsonArray = InputJsonValue[];
    // Decimal used to live at `@prisma/client/runtime/library` in
    // Prisma 6 and earlier; Prisma 7 exports it from this namespace.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export type Decimal = any;
  }

  // Error classes used at runtime
  export class PrismaClientKnownRequestError extends Error {
    code: string;
    meta?: Record<string, unknown>;
    clientVersion: string;
  }
  export class PrismaClientInitializationError extends Error {
    clientVersion: string;
  }
}

declare module ".prisma/client/default" {
  export * from "@prisma/client";
}
