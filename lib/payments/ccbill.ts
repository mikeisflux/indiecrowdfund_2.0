import crypto from "crypto"

interface CCBillConfig {
  merchantAccount: string
  subAccount: string
  formName: string
  salt: string
}

function getConfig(): CCBillConfig {
  const config = {
    merchantAccount: process.env.CCBILL_MERCHANT_ACCOUNT || "",
    subAccount: process.env.CCBILL_SUBACCOUNT || "",
    formName: process.env.CCBILL_FORM_NAME || "",
    salt: process.env.CCBILL_SALT || "",
  }

  if (!config.merchantAccount || !config.subAccount || !config.formName || !config.salt) {
    throw new Error("CCBill configuration is incomplete")
  }

  return config
}

export function generateCCBillFormDigest(
  amount: number,
  currency: string,
  formPeriod: number = 30
): string {
  const config = getConfig()

  const formattedPrice = amount.toFixed(2)

  // CCBill digest format: price + period + currency + salt
  const digestString = `${formattedPrice}${formPeriod}${currency}${config.salt}`

  // Generate MD5 hash
  const digest = crypto.createHash("md5").update(digestString).digest("hex")

  return digest
}

export function generateCCBillPaymentUrl(
  amount: number,
  currency: string = "USD",
  customerInfo: {
    email: string
    firstName?: string
    lastName?: string
  },
  metadata: {
    projectId: string
    pledgeId?: string
    rewardId?: string
  }
): string {
  const config = getConfig()

  const formDigest = generateCCBillFormDigest(amount, currency)

  const params = new URLSearchParams({
    clientAccnum: config.merchantAccount,
    clientSubacc: config.subAccount,
    formName: config.formName,
    formDigest,
    formPrice: amount.toFixed(2),
    formPeriod: "30",
    currency: currency.toUpperCase(),
    email: customerInfo.email,
    ...(customerInfo.firstName && { firstName: customerInfo.firstName }),
    ...(customerInfo.lastName && { lastName: customerInfo.lastName }),
    // Custom fields for tracking
    project_id: metadata.projectId,
    ...(metadata.pledgeId && { pledge_id: metadata.pledgeId }),
    ...(metadata.rewardId && { reward_id: metadata.rewardId }),
  })

  return `https://bill.ccbill.com/jpost/signup.cgi?${params.toString()}`
}

export function verifyCCBillPostback(
  postbackData: Record<string, string>
): boolean {
  try {
    const config = getConfig()

    // CCBill sends a verification hash in postbacks
    const { verificationHash, ...data } = postbackData

    if (!verificationHash) {
      return false
    }

    // Reconstruct the hash from the data
    const hashString = Object.keys(data)
      .sort()
      .map((key) => `${key}=${data[key]}`)
      .join("&") + config.salt

    const calculatedHash = crypto
      .createHash("md5")
      .update(hashString)
      .digest("hex")

    return calculatedHash === verificationHash
  } catch (error) {
    console.error("CCBill postback verification failed:", error)
    return false
  }
}

export function parseCCBillPostback(postbackData: Record<string, string>): {
  transactionId: string
  subscriptionId: string
  amount: number
  currency: string
  email: string
  projectId?: string
  pledgeId?: string
  rewardId?: string
  timestamp: Date
} {
  return {
    transactionId: postbackData.transactionId || "",
    subscriptionId: postbackData.subscriptionId || "",
    amount: parseFloat(postbackData.billedInitialPrice || "0"),
    currency: postbackData.billedCurrencyCode || "USD",
    email: postbackData.email || "",
    projectId: postbackData.project_id,
    pledgeId: postbackData.pledge_id,
    rewardId: postbackData.reward_id,
    timestamp: new Date(),
  }
}
