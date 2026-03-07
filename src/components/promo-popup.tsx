"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Megaphone,
  Brain,
  ShoppingBag,
  LayoutDashboard,
  Package,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
} from "lucide-react";

interface PromoSlide {
  title: string;
  subtitle: string;
  features: string[];
  iconName: string;
  gradientFrom: string;
  gradientTo: string;
}

const PROMO_DISMISSED_KEY = "promo_popup_dismissed";
const PROMO_SESSION_KEY = "promo_popup_shown_session";
const PROMO_LOGIN_KEY = "promo_popup_login_dismissed";

// Map icon names to components
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles,
  Megaphone,
  Brain,
  ShoppingBag,
  LayoutDashboard,
  Package,
};

function getIcon(iconName: string) {
  return iconMap[iconName] || Sparkles;
}

export function PromoPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState<PromoSlide[]>([]);
  const [showFrequency, setShowFrequency] = useState("once_per_session");

  useEffect(() => {
    async function fetchPopup() {
      try {
        // Don't show on admin pages
        if (window.location.pathname.startsWith("/admin")) return;

        const response = await fetch("/api/promo-popup");
        if (!response.ok) return;

        const data = await response.json();
        if (!data.popup || !Array.isArray(data.popup.slides) || data.popup.slides.length === 0) return;

        const frequency = data.popup.showFrequency || "once_per_session";

        // Always check login key first — popup should show at most once per login session
        // regardless of frequency setting. This survives refreshes and rebuilds.
        if (localStorage.getItem(PROMO_LOGIN_KEY)) return;

        // Additional frequency-based checks
        if (frequency === "once_per_day") {
          const lastDismissed = localStorage.getItem(PROMO_DISMISSED_KEY);
          if (lastDismissed) {
            const dismissedAt = parseInt(lastDismissed, 10);
            const twentyFourHours = 24 * 60 * 60 * 1000;
            if (Date.now() - dismissedAt < twentyFourHours) return;
          }
        }

        // Mark as shown immediately so refreshes / rebuilds / navigations don't re-trigger
        localStorage.setItem(PROMO_LOGIN_KEY, Date.now().toString());
        sessionStorage.setItem(PROMO_SESSION_KEY, Date.now().toString());

        setSlides(data.popup.slides);
        setShowFrequency(frequency);

        // Small delay so the page renders first
        setTimeout(() => setIsOpen(true), 800);
      } catch {
        // Silently fail
      }
    }

    fetchPopup();
  }, []);

  const handleDismiss = () => {
    setIsOpen(false);
    // Always mark session + day keys on dismiss
    sessionStorage.setItem(PROMO_SESSION_KEY, Date.now().toString());
    localStorage.setItem(PROMO_DISMISSED_KEY, Date.now().toString());
    if (showFrequency === "once_per_login") {
      localStorage.setItem(PROMO_LOGIN_KEY, Date.now().toString());
    }
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev < slides.length - 1 ? prev + 1 : prev));
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev > 0 ? prev - 1 : prev));
  };

  if (!isOpen || slides.length === 0) return null;

  const slide = slides[currentSlide];
  const IconComponent = getIcon(slide.iconName);
  const isLastSlide = currentSlide === slides.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleDismiss}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-300">
        {/* Close button - positioned on modal frame, always visible */}
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 z-10 rounded-full p-3 bg-black/40 hover:bg-black/60 text-white transition-colors"
          aria-label="Close"
        >
          <X className="h-6 w-6" />
        </button>

        {/* Slide content */}
        <div
          className="relative p-8 pb-6 text-white flex flex-col"
          style={{
            background: `linear-gradient(135deg, ${slide.gradientFrom} 0%, ${slide.gradientTo} 100%)`,
          }}
        >
          {/* Decorative circles */}
          <div
            className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10"
            style={{ background: "white", transform: "translate(30%, -30%)" }}
          />
          <div
            className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-10"
            style={{ background: "white", transform: "translate(-30%, 30%)" }}
          />

          {/* Icon + Title */}
          <div className="relative z-[1] mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm mb-4">
              <IconComponent className="h-7 w-7" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">{slide.title}</h2>
            <p className="text-white/80 mt-1 text-sm">{slide.subtitle}</p>
          </div>

          {/* Features list */}
          <div className="relative z-[1] flex-1 space-y-2.5">
            {slide.features.map((feature, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                  <Check className="h-3 w-3" />
                </div>
                <span className="text-sm text-white/90 leading-snug">{feature}</span>
              </div>
            ))}
          </div>

          {/* Navigation */}
          <div className="relative z-[1] flex items-center justify-between mt-6 pt-4 border-t border-white/20">
            {/* Dots indicator */}
            <div className="flex items-center gap-1.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === currentSlide
                      ? "w-6 bg-white"
                      : "w-2 bg-white/40 hover:bg-white/60"
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>

            {/* Slide counter */}
            <span className="text-xs text-white/60">
              {currentSlide + 1} / {slides.length}
            </span>

            {/* Arrow buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={prevSlide}
                disabled={currentSlide === 0}
                className="h-9 w-9 rounded-full text-white hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-transparent"
                aria-label="Previous slide"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>

              {isLastSlide ? (
                <Button
                  onClick={handleDismiss}
                  className="h-9 px-4 rounded-full bg-white text-gray-900 hover:bg-white/90 text-sm font-medium"
                >
                  Get Started
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={nextSlide}
                  className="h-9 w-9 rounded-full text-white hover:bg-white/20"
                  aria-label="Next slide"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
