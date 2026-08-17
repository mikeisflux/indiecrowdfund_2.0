import { db } from "@/lib/db";
import { encryptCredential, decryptCredential } from "@/lib/encryption";
import { circuitBreaker } from "@/lib/circuit-breaker";

// Where a project's ShipStation credentials come from.
//
// Originally they lived only on the creator's User row, which forced a rule
// nobody wanted: only the creator could connect, because a collaborator
// writing there would repoint every other campaign that creator runs. On a
// platform where the person holding the ShipStation account is usually the
// fulfilment house, not the creator, that put the connection in the hands of
// the one person who does not do the shipping.
//
// Credentials are now stored per project on FulfillmentIntegration, which is
// already keyed @@unique([projectId, provider]). A collaborator can connect
// the campaign they work on and touch nothing else. The creator's User fields
// are still read as a fallback so connections made before this keep working
// without anyone re-entering keys.

export interface ShipStationCredentials {
  apiKey: string;
  apiSecret: string;
  /** Which store the working credentials came from, for logging. */
  source: "project" | "creator";
  /**
   * The ShipStation store orders are imported into, if one has been chosen.
   *
   * A ShipStation account holds one store per selling channel plus a manual
   * store, and each has its own branding, packing slips and automation rules.
   * Omitting it drops every pushed order into whichever store the account
   * treats as default — for a fulfilment house running several campaigns,
   * that is all of them in one undifferentiated pile.
   */
  storeId: number | null;
  storeName: string | null;
}

/** One store on a ShipStation account, as returned by GET /stores. */
export interface ShipStationStore {
  storeId: number;
  storeName: string;
  marketplaceName?: string | null;
  active?: boolean;
}

/** Decrypt, tolerating legacy values that were stored in the clear. */
function safeDecrypt(value: string): string {
  try {
    return decryptCredential(value);
  } catch {
    return value;
  }
}

/**
 * Shape held in FulfillmentIntegration.credentials.
 *
 * The two secrets are encrypted; the store selection is not a secret and is
 * kept in the clear so it can be read back into the UI without a decrypt.
 * The column is Json, so adding the store needed no migration.
 */
interface StoredCredentials {
  apiKeyEncrypted?: string;
  apiSecretEncrypted?: string;
  storeId?: number | null;
  storeName?: string | null;
}

export function encryptShipStationCredentials(apiKey: string, apiSecret: string) {
  return {
    apiKeyEncrypted: encryptCredential(apiKey),
    apiSecretEncrypted: encryptCredential(apiSecret),
  };
}

/** Store selection as stored, for surfaces that must not touch the secrets. */
export async function getShipStationStoreSelection(
  projectId: string
): Promise<{ storeId: number | null; storeName: string | null }> {
  const integration = await db.fulfillmentIntegration.findFirst({
    where: { projectId, provider: "SHIPSTATION" },
    select: { credentials: true },
  });
  const stored = (integration?.credentials ?? {}) as StoredCredentials;
  return {
    storeId: typeof stored.storeId === "number" ? stored.storeId : null,
    storeName: typeof stored.storeName === "string" ? stored.storeName : null,
  };
}

/**
 * List the stores on a ShipStation account.
 *
 * Returns null rather than throwing when the account cannot be listed — some
 * plans gate the endpoint, and a creator whose keys are otherwise valid should
 * still get connected and fall back to their ShipStation default store rather
 * than being blocked at the door.
 */
export async function fetchShipStationStores(
  apiKey: string,
  apiSecret: string
): Promise<ShipStationStore[] | null> {
  try {
    const response = await circuitBreaker.execute("shipstation", () =>
      fetch("https://ssapi.shipstation.com/stores?showInactive=false", {
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`,
        },
      })
    );

    if (!response.ok) return null;

    // V1 returns a bare array here, not the {stores:[]} envelope some of its
    // other collection endpoints use.
    const body: unknown = await response.json();
    const rows = Array.isArray(body)
      ? body
      : Array.isArray((body as { stores?: unknown })?.stores)
        ? ((body as { stores: unknown[] }).stores)
        : [];

    // Guarded against non-objects, not just wrong-shaped ones: a single null
    // in the array would otherwise throw inside the filter and be caught
    // below, reporting the whole account as unlistable over one bad row.
    return rows
      .filter(
        (row): row is ShipStationStore =>
          !!row &&
          typeof row === "object" &&
          typeof (row as Partial<ShipStationStore>).storeId === "number" &&
          typeof (row as Partial<ShipStationStore>).storeName === "string"
      )
      .map((row) => ({
        storeId: row.storeId,
        storeName: row.storeName,
        marketplaceName: row.marketplaceName ?? null,
        active: row.active ?? true,
      }));
  } catch {
    return null;
  }
}

/** Persist which store this campaign's orders import into. */
export async function saveShipStationStore(
  projectId: string,
  store: { storeId: number; storeName: string } | null
): Promise<void> {
  const integration = await db.fulfillmentIntegration.findFirst({
    where: { projectId, provider: "SHIPSTATION" },
    select: { id: true, credentials: true },
  });
  if (!integration) return;

  const stored = (integration.credentials ?? {}) as StoredCredentials;
  await db.fulfillmentIntegration.update({
    where: { id: integration.id },
    data: {
      credentials: {
        ...stored,
        storeId: store?.storeId ?? null,
        storeName: store?.storeName ?? null,
      },
    },
  });
}

/**
 * Resolve the credentials to use for a project, project-level first.
 *
 * Returns null when neither store has a usable pair, so callers can tell
 * "not connected" apart from "connected but broken".
 */
export async function resolveShipStationCredentials(
  projectId: string,
  creatorId: string
): Promise<ShipStationCredentials | null> {
  const integration = await db.fulfillmentIntegration.findFirst({
    where: { projectId, provider: "SHIPSTATION" },
    select: { credentials: true },
  });

  const stored = (integration?.credentials ?? {}) as StoredCredentials;
  const storeId = typeof stored.storeId === "number" ? stored.storeId : null;
  const storeName = typeof stored.storeName === "string" ? stored.storeName : null;

  if (stored.apiKeyEncrypted && stored.apiSecretEncrypted) {
    return {
      apiKey: safeDecrypt(stored.apiKeyEncrypted),
      apiSecret: safeDecrypt(stored.apiSecretEncrypted),
      source: "project",
      storeId,
      storeName,
    };
  }

  const creator = await db.user.findFirst({
    where: { id: creatorId, deletedAt: null },
    select: { shipstationApiKey: true, shipstationApiSecret: true },
  });

  if (creator?.shipstationApiKey && creator?.shipstationApiSecret) {
    return {
      apiKey: safeDecrypt(creator.shipstationApiKey),
      apiSecret: safeDecrypt(creator.shipstationApiSecret),
      source: "creator",
      // A store chosen on the campaign still applies when the keys come from
      // the creator's account-level fallback — the choice is about where this
      // campaign's orders land, not about which credentials opened the door.
      storeId,
      storeName,
    };
  }

  return null;
}

/**
 * Whether this user may connect ShipStation for this project.
 *
 * The creator, or a collaborator whose invitation has been accepted. Pending
 * or revoked collaborators are not enough — that check is the only thing
 * standing between "the fulfilment partner can set this up" and "anyone once
 * invited can repoint where a campaign's orders go".
 */
export async function canManageShipStation(
  projectId: string,
  userId: string
): Promise<boolean> {
  const project = await db.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
      OR: [
        { creatorId: userId },
        { collaborators: { some: { userId, status: "ACCEPTED" } } },
      ],
    },
    select: { id: true },
  });
  return !!project;
}
