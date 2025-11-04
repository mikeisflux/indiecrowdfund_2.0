import { prisma } from "./db"
import crypto from "crypto"

export async function generateVerificationToken(
  userId: string,
  type: "EMAIL_VERIFICATION" | "PASSWORD_RESET"
) {
  // Generate a secure random token
  const token = crypto.randomBytes(32).toString("hex")

  // Set expiration (24 hours from now)
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + 24)

  // Create token in database
  const verificationToken = await prisma.verificationToken.create({
    data: {
      token,
      userId,
      type,
      expiresAt,
    },
  })

  return verificationToken
}

export async function verifyToken(token: string, type: string) {
  const verificationToken = await prisma.verificationToken.findUnique({
    where: { token },
    include: { user: true },
  })

  if (!verificationToken) {
    return { valid: false, error: "Invalid token" }
  }

  if (verificationToken.type !== type) {
    return { valid: false, error: "Invalid token type" }
  }

  if (verificationToken.usedAt) {
    return { valid: false, error: "Token already used" }
  }

  if (new Date() > verificationToken.expiresAt) {
    return { valid: false, error: "Token expired" }
  }

  return { valid: true, token: verificationToken }
}

export async function markTokenAsUsed(tokenId: string) {
  await prisma.verificationToken.update({
    where: { id: tokenId },
    data: { usedAt: new Date() },
  })
}

export async function deleteExpiredTokens() {
  await prisma.verificationToken.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  })
}

export async function deleteUserTokens(userId: string, type?: string) {
  await prisma.verificationToken.deleteMany({
    where: {
      userId,
      ...(type && { type }),
    },
  })
}
