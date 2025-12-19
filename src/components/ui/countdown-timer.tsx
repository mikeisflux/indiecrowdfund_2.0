"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Clock } from "lucide-react";
import { getTimeRemainingDetails, getMinutesRemaining, getSecondsRemaining } from "@/lib/utils";

interface CountdownTimerProps {
  endDate: Date | string;
  className?: string;
  showIcon?: boolean;
  onEnd?: () => void;
  showConfetti?: boolean;
  variant?: "inline" | "stacked"; // stacked shows number above label
}

// Confetti colors
const CONFETTI_COLORS = ['#05ce78', '#ffc439', '#e85b46', '#1da1f2', '#9333ea', '#f97316'];

export function CountdownTimer({
  endDate,
  className = "",
  showIcon = true,
  onEnd,
  showConfetti = true,
  variant = "inline",
}: CountdownTimerProps) {
  const parsedEndDate = useMemo(() => {
    return typeof endDate === "string" ? new Date(endDate) : endDate;
  }, [endDate]);

  const [timeRemaining, setTimeRemaining] = useState(() => getTimeRemainingDetails(parsedEndDate));
  const [showCelebration, setShowCelebration] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);

  // Memoize confetti pieces to prevent re-generation on each render
  const confettiPieces = useMemo(() => {
    return [...Array(50)].map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      animationDelay: `${Math.random() * 3}s`,
      animationDuration: `${3 + Math.random() * 2}s`,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      rotation: `${Math.random() * 360}deg`,
    }));
  }, []);

  const fireworkBursts = useMemo(() => [
    { top: "20%", left: "25%", delay: "0s", size: "w-4 h-4", color: "bg-yellow-400" },
    { top: "32%", right: "25%", delay: "0.5s", size: "w-3 h-3", color: "bg-green-400" },
    { top: "16%", right: "33%", delay: "1s", size: "w-5 h-5", color: "bg-purple-400" },
    { top: "40%", left: "15%", delay: "1.5s", size: "w-3 h-3", color: "bg-pink-400" },
    { top: "25%", right: "15%", delay: "2s", size: "w-4 h-4", color: "bg-blue-400" },
  ], []);

  // Calculate update interval based on time remaining
  const getUpdateInterval = useCallback(() => {
    const totalMinutes = getMinutesRemaining(parsedEndDate);
    const totalSeconds = getSecondsRemaining(parsedEndDate);

    if (totalSeconds <= 120) {
      // Less than 2 minutes - update every second
      return 1000;
    } else if (totalMinutes <= 120) {
      // Less than 2 hours - update every 10 seconds
      return 10000;
    } else {
      // More than 2 hours - update every minute
      return 60000;
    }
  }, [parsedEndDate]);

  useEffect(() => {
    const updateTimer = () => {
      const details = getTimeRemainingDetails(parsedEndDate);
      setTimeRemaining(details);

      if (details.isEnded && !hasEnded) {
        setHasEnded(true);
        if (showConfetti) {
          setShowCelebration(true);
          // Hide celebration after 10 seconds
          setTimeout(() => setShowCelebration(false), 10000);
        }
        onEnd?.();
      }
    };

    // Initial update
    updateTimer();

    // Set up interval with dynamic timing
    let intervalId: NodeJS.Timeout;

    const setupInterval = () => {
      const interval = getUpdateInterval();
      intervalId = setInterval(() => {
        updateTimer();
        // Re-check if interval needs to change
        const newInterval = getUpdateInterval();
        if (newInterval !== interval) {
          clearInterval(intervalId);
          setupInterval();
        }
      }, interval);
    };

    setupInterval();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [parsedEndDate, hasEnded, showConfetti, onEnd, getUpdateInterval]);

  const getDisplayData = useCallback((): { value: number; label: string; text: string } => {
    if (timeRemaining.isEnded) {
      return { value: 0, label: "ended", text: "Campaign Ended!" };
    }

    const totalMinutes = getMinutesRemaining(parsedEndDate);
    const totalSeconds = getSecondsRemaining(parsedEndDate);

    // Less than 2 minutes - show seconds
    if (totalMinutes <= 2) {
      return {
        value: totalSeconds,
        label: totalSeconds !== 1 ? "seconds to go" : "second to go",
        text: `${totalSeconds} second${totalSeconds !== 1 ? "s" : ""} left`,
      };
    }

    // Less than 2 hours - show minutes
    if (totalMinutes <= 120) {
      return {
        value: totalMinutes,
        label: totalMinutes !== 1 ? "minutes to go" : "minute to go",
        text: `${totalMinutes} minute${totalMinutes !== 1 ? "s" : ""} left`,
      };
    }

    // Less than 2 days - show hours
    if (timeRemaining.days < 2) {
      const totalHours = timeRemaining.days * 24 + timeRemaining.hours;
      return {
        value: totalHours,
        label: totalHours !== 1 ? "hours to go" : "hour to go",
        text: `${totalHours} hour${totalHours !== 1 ? "s" : ""} left`,
      };
    }

    // Show days
    return {
      value: timeRemaining.days,
      label: timeRemaining.days !== 1 ? "days to go" : "day to go",
      text: `${timeRemaining.days} day${timeRemaining.days !== 1 ? "s" : ""} left`,
    };
  }, [timeRemaining, parsedEndDate]);

  const displayData = getDisplayData();

  return (
    <>
      {variant === "stacked" ? (
        <div className={className}>
          <p className="text-2xl font-bold">{displayData.value.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">{displayData.label}</p>
        </div>
      ) : (
        <span className={className}>
          {showIcon && <Clock className="h-3 w-3 inline mr-1" />}
          <span>{displayData.text}</span>
        </span>
      )}

      {/* Celebration Overlay */}
      {showCelebration && (
        <div className="fixed inset-0 z-[9999] pointer-events-none">
          {/* Confetti Animation */}
          <div className="absolute inset-0 overflow-hidden">
            {confettiPieces.map((piece) => (
              <div
                key={piece.id}
                className="absolute animate-confetti-fall"
                style={{
                  left: piece.left,
                  animationDelay: piece.animationDelay,
                  animationDuration: piece.animationDuration,
                }}
              >
                <div
                  className="w-3 h-3 rotate-45"
                  style={{
                    backgroundColor: piece.color,
                    transform: `rotate(${piece.rotation})`,
                  }}
                />
              </div>
            ))}
          </div>

          {/* Firework bursts */}
          <div className="absolute inset-0">
            {fireworkBursts.map((burst, i) => (
              <div
                key={i}
                className="absolute animate-ping"
                style={{
                  top: burst.top,
                  left: burst.left,
                  right: burst.right,
                  animationDelay: burst.delay,
                }}
              >
                <div className={`${burst.size} rounded-full ${burst.color} opacity-75`} />
              </div>
            ))}
          </div>

          {/* Celebration Message */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-4 rounded-2xl shadow-2xl animate-bounce">
              <p className="text-2xl font-bold text-center">🎉 Campaign Ended! 🎉</p>
            </div>
          </div>

          {/* CSS Animation */}
          <style jsx>{`
            @keyframes confetti-fall {
              0% {
                transform: translateY(-100vh) rotate(0deg);
                opacity: 1;
              }
              100% {
                transform: translateY(100vh) rotate(720deg);
                opacity: 0;
              }
            }
            .animate-confetti-fall {
              animation: confetti-fall 5s linear infinite;
            }
          `}</style>
        </div>
      )}
    </>
  );
}

// Simple non-interactive version for lists and cards
export function CountdownTimerText({
  endDate,
  className = "",
}: {
  endDate: Date | string;
  className?: string;
}) {
  const parsedEndDate = useMemo(() => {
    return typeof endDate === "string" ? new Date(endDate) : endDate;
  }, [endDate]);

  const [displayText, setDisplayText] = useState(() => {
    const details = getTimeRemainingDetails(parsedEndDate);
    if (details.isEnded) return "Ended";

    const totalMinutes = getMinutesRemaining(parsedEndDate);
    if (totalMinutes <= 2) {
      const totalSeconds = getSecondsRemaining(parsedEndDate);
      return `${totalSeconds}s left`;
    }
    if (totalMinutes <= 120) {
      return `${totalMinutes}m left`;
    }
    if (details.days < 2) {
      const totalHours = details.days * 24 + details.hours;
      return `${totalHours}h left`;
    }
    return `${details.days}d left`;
  });

  useEffect(() => {
    const updateDisplay = () => {
      const details = getTimeRemainingDetails(parsedEndDate);
      if (details.isEnded) {
        setDisplayText("Ended");
        return;
      }

      const totalMinutes = getMinutesRemaining(parsedEndDate);
      if (totalMinutes <= 2) {
        const totalSeconds = getSecondsRemaining(parsedEndDate);
        setDisplayText(`${totalSeconds}s left`);
      } else if (totalMinutes <= 120) {
        setDisplayText(`${totalMinutes}m left`);
      } else if (details.days < 2) {
        const totalHours = details.days * 24 + details.hours;
        setDisplayText(`${totalHours}h left`);
      } else {
        setDisplayText(`${details.days}d left`);
      }
    };

    updateDisplay();

    // Determine update interval
    const totalMinutes = getMinutesRemaining(parsedEndDate);
    let interval: number;
    if (totalMinutes <= 2) {
      interval = 1000; // Update every second
    } else if (totalMinutes <= 120) {
      interval = 10000; // Update every 10 seconds
    } else {
      interval = 60000; // Update every minute
    }

    const intervalId = setInterval(updateDisplay, interval);
    return () => clearInterval(intervalId);
  }, [parsedEndDate]);

  return <span className={className}>{displayText}</span>;
}
