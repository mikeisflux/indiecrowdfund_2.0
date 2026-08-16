import { db } from "@/lib/db";
import { encryptCredential, decryptCredential } from "@/lib/encryption";

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
}

/** Decrypt, tolerating legacy values that were stored in the clear. */
function safeDecrypt(value: string): string {
  try {
    return decryptCredential(value);
  } catch {
    return value;
  }
}

/** Encrypted shape held in FulfillmentIntegration.credentials. */
interface StoredCredentials {
  apiKeyEncrypted?: string;
  apiSecretEncrypted?: string;
}

export function encryptShipStationCredentials(apiKey: string, apiSecret: string) {
  return {
    apiKeyEncrypted: encryptCredential(apiKey),
    apiSecretEncrypted: encryptCredential(apiSecret),
  };
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
  if (stored.apiKeyEncrypted && stored.apiSecretEncrypted) {
    return {
      apiKey: safeDecrypt(stored.apiKeyEncrypted),
      apiSecret: safeDecrypt(stored.apiSecretEncrypted),
      source: "project",
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
