export interface FeeResult {
  totalFees: number;
  youReceive: number;
  feePercentage: number;
}

export interface StripeFeeResult extends FeeResult {
  platformFee: number;
  processingFee: number;
}

export interface PayPalFeeResult extends FeeResult {
  platformFee: number;
  processingFee: number;
}

export interface DivinityCoinFeeResult extends FeeResult {
  divinityPartnerFee: number;
  perTransactionFee: number;
  platformFee: number;
}

export interface WhopFeeResult extends FeeResult {
  whopFee: number;
  platformFee: number;
}

// 3% platform + 2.9% + $0.30 per transaction
export function calculateStripeFees(
  amount: number,
  averagePledge = 50
): StripeFeeResult {
  const platformFee = amount * 0.03;
  const numTransactions = Math.ceil(amount / averagePledge);
  const processingFee = amount * 0.029 + numTransactions * 0.3;
  const totalFees = platformFee + processingFee;
  const youReceive = amount - totalFees;
  return { platformFee, processingFee, totalFees, youReceive, feePercentage: (totalFees / amount) * 100 };
}

// 3% platform + 3.49% + $0.49 per transaction
export function calculatePayPalFees(
  amount: number,
  averagePledge = 50
): PayPalFeeResult {
  const platformFee = amount * 0.03;
  const numTransactions = Math.ceil(amount / averagePledge);
  const processingFee = amount * 0.0349 + numTransactions * 0.49;
  const totalFees = platformFee + processingFee;
  const youReceive = amount - totalFees;
  return { platformFee, processingFee, totalFees, youReceive, feePercentage: (totalFees / amount) * 100 };
}

// 3% DivinityCoin partner fee + $0.30 per transaction, then 3% platform fee on the remainder
export function calculateDivinityCoinFees(
  amount: number,
  averagePledge = 50
): DivinityCoinFeeResult {
  const divinityPartnerFee = amount * 0.03;
  const numTransactions = Math.ceil(amount / averagePledge);
  const perTransactionFee = numTransactions * 0.3;
  const afterPartner = amount - divinityPartnerFee - perTransactionFee;
  const platformFee = afterPartner * 0.03;
  const totalFees = divinityPartnerFee + perTransactionFee + platformFee;
  const youReceive = amount - totalFees;
  return { divinityPartnerFee, perTransactionFee, platformFee, totalFees, youReceive, feePercentage: (totalFees / amount) * 100 };
}

// 3% Whop fee, then 3% platform fee on the remainder
export function calculateWhopFees(amount: number): WhopFeeResult {
  const whopFee = amount * 0.03;
  const platformFee = (amount - whopFee) * 0.03;
  const totalFees = whopFee + platformFee;
  const youReceive = amount - totalFees;
  return { whopFee, platformFee, totalFees, youReceive, feePercentage: (totalFees / amount) * 100 };
}
