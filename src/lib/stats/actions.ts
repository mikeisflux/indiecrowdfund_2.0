'use server';

import { formatCurrency, formatNumber } from './utils';

/**
 * Fetch platform statistics from the database
 * This is a server action that can be called from client components
 */
export async function getStats() {
  // In a real app, this would fetch from a database
  return {
    projectsFunded: 10000,
    totalRaised: 50000000,
    happyBackers: 500000,
    countries: 180,
  };
}

/**
 * Get formatted platform statistics
 * Server action that returns pre-formatted stats for display
 */
export async function getFormattedStats() {
  const stats = await getStats();
  return {
    projectsFunded: formatNumber(stats.projectsFunded),
    totalRaised: formatCurrency(stats.totalRaised),
    happyBackers: formatNumber(stats.happyBackers),
    countries: `${stats.countries}+`,
  };
}
