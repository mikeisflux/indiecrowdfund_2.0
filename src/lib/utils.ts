import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}

export function formatPercentage(value: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

export function calculateFundingPercentage(current: number, goal: number): number {
  if (goal === 0) return 0;
  return Math.round((current / goal) * 100);
}

export function getDaysRemaining(endDate: Date): number {
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function getHoursRemaining(endDate: Date): number {
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60)));
}

export function getMinutesRemaining(endDate: Date): number {
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60)));
}

export function getSecondsRemaining(endDate: Date): number {
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / 1000));
}

export function getTimeRemainingDetails(endDate: Date): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  isEnded: boolean;
} {
  const now = new Date();
  const diff = Math.max(0, endDate.getTime() - now.getTime());

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return {
    days,
    hours,
    minutes,
    seconds,
    totalSeconds,
    isEnded: diff <= 0,
  };
}

export function formatTimeRemaining(daysOrEndDate: number | Date, endDate?: Date): string {
  let actualEndDate: Date | undefined;
  let days: number;
  let hours: number;
  let minutes: number;
  let seconds: number;

  if (typeof daysOrEndDate === "number") {
    days = daysOrEndDate;
    if (endDate) {
      actualEndDate = endDate;
      const details = getTimeRemainingDetails(endDate);
      hours = details.hours + details.days * 24;
      minutes = details.minutes;
      seconds = details.seconds;
    } else {
      hours = days * 24;
      minutes = 0;
      seconds = 0;
    }
  } else {
    actualEndDate = daysOrEndDate;
    const details = getTimeRemainingDetails(daysOrEndDate);
    days = details.days;
    hours = details.hours + details.days * 24; // Total hours
    minutes = details.minutes;
    seconds = details.seconds;

    if (details.isEnded) {
      return "Ended";
    }
  }

  if (days <= 0 && hours <= 0 && minutes <= 0 && seconds <= 0) {
    return "Ended";
  }

  // Less than 2 minutes - show seconds
  if (actualEndDate) {
    const totalMinutes = getMinutesRemaining(actualEndDate);
    const totalHours = getHoursRemaining(actualEndDate);

    if (totalMinutes <= 2) {
      const totalSeconds = getSecondsRemaining(actualEndDate);
      return `${totalSeconds} second${totalSeconds !== 1 ? "s" : ""} left`;
    }

    // Less than 2 hours - show minutes
    if (totalHours <= 2) {
      return `${totalMinutes} minute${totalMinutes !== 1 ? "s" : ""} left`;
    }
  }

  // Less than 2 days - show hours
  if (days < 2) {
    return `${hours} hour${hours !== 1 ? "s" : ""} left`;
  }

  return `${days} day${days !== 1 ? "s" : ""} left`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateProjectSlug(title: string): string {
  const baseSlug = slugify(title);
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `${baseSlug}-${randomSuffix}`;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
