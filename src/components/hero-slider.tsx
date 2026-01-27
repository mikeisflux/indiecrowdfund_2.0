"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowRight, Rocket, ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeroSlide {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  buttonText: string | null;
  buttonLink: string | null;
  secondaryButtonText: string | null;
  secondaryButtonLink: string | null;
  mediaType: "IMAGE" | "YOUTUBE" | "VIDEO";
  imageUrl: string | null;
  videoUrl: string | null;
  videoThumbnail: string | null;
  textAlignment: string;
  overlayOpacity: number;
}

interface HeroSliderProps {
  initialSlides?: HeroSlide[];
  autoPlayInterval?: number;
}

// Helper to extract YouTube video ID
function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?\s]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Default slide content matching the original hero
const defaultSlide: HeroSlide = {
  id: "default",
  title: "Support Who You Love",
  subtitle: "IndieCrowdfund leads the way!",
  description: "IndieCrowdfund is the future home to thousands of creative projects in art, design, film, games, music, and more. Back a project or start your own today.",
  buttonText: "Discover Projects",
  buttonLink: "/discover",
  secondaryButtonText: "Start a Project",
  secondaryButtonLink: "/projects/new",
  mediaType: "IMAGE",
  imageUrl: null,
  videoUrl: null,
  videoThumbnail: null,
  textAlignment: "center",
  overlayOpacity: 0,
};

export function HeroSlider({ initialSlides = [], autoPlayInterval = 6000 }: HeroSliderProps) {
  const [slides, setSlides] = useState<HeroSlide[]>(initialSlides.length > 0 ? initialSlides : [defaultSlide]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Fetch slides on mount if none provided
  useEffect(() => {
    if (initialSlides.length === 0) {
      fetch("/api/hero-slides")
        .then((res) => res.json())
        .then((data) => {
          if (data.slides && data.slides.length > 0) {
            setSlides(data.slides);
          }
        })
        .catch(console.error);
    }
  }, [initialSlides.length]);

  // Auto-play
  useEffect(() => {
    if (!isPlaying || slides.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, autoPlayInterval);

    return () => clearInterval(timer);
  }, [isPlaying, slides.length, autoPlayInterval]);

  const goToSlide = useCallback((index: number) => {
    if (isTransitioning || index === currentIndex) return;
    setIsTransitioning(true);
    setCurrentIndex(index);
    setTimeout(() => setIsTransitioning(false), 500);
  }, [currentIndex, isTransitioning]);

  const goToNext = useCallback(() => {
    goToSlide((currentIndex + 1) % slides.length);
  }, [currentIndex, slides.length, goToSlide]);

  const goToPrev = useCallback(() => {
    goToSlide((currentIndex - 1 + slides.length) % slides.length);
  }, [currentIndex, slides.length, goToSlide]);

  const currentSlide = slides[currentIndex];

  // Render text content with underline animation
  const renderTitle = (title: string) => {
    // Check if "Love" is in the title for the special underline
    if (title.includes("Love")) {
      const parts = title.split("Love");
      return (
        <>
          {parts[0]}
          <span className="relative">
            Love
            <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" fill="none">
              <path d="M2 10C50 4 150 4 198 10" stroke="url(#underline-gradient)" strokeWidth="3" strokeLinecap="round" className="animate-line" />
              <defs>
                <linearGradient id="underline-gradient" x1="0" y1="0" x2="200" y2="0">
                  <stop stopColor="#10b981" />
                  <stop offset="0.5" stopColor="#06b6d4" />
                  <stop offset="1" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
          </span>
          {parts[1]}
        </>
      );
    }

    // Highlight "Support" if present
    if (title.includes("Support")) {
      return (
        <>
          <span className="gradient-text">Support</span> {title.replace("Support ", "")}
        </>
      );
    }

    return title;
  };

  return (
    <section className="relative overflow-hidden hero-gradient py-1.5">
      {/* Animated grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,black_40%,transparent_100%)]" />

      {/* Background media */}
      {currentSlide.mediaType === "IMAGE" && currentSlide.imageUrl && (
        <div className="absolute inset-0">
          <Image
            src={currentSlide.imageUrl}
            alt=""
            fill
            className={cn(
              "object-cover transition-opacity duration-500",
              isTransitioning ? "opacity-0" : "opacity-100"
            )}
            priority
          />
          <div
            className="absolute inset-0 bg-black transition-opacity duration-300"
            style={{ opacity: currentSlide.overlayOpacity / 100 }}
          />
        </div>
      )}

      {currentSlide.mediaType === "VIDEO" && currentSlide.videoUrl && (
        <div className="absolute inset-0">
          <video
            src={currentSlide.videoUrl}
            className="w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
          />
          <div
            className="absolute inset-0 bg-black"
            style={{ opacity: currentSlide.overlayOpacity / 100 }}
          />
        </div>
      )}

      {currentSlide.mediaType === "YOUTUBE" && currentSlide.videoUrl && (
        <div className="absolute inset-0">
          <iframe
            src={`https://www.youtube.com/embed/${getYouTubeVideoId(currentSlide.videoUrl)}?autoplay=1&mute=1&loop=1&controls=0&showinfo=0&rel=0&iv_load_policy=3&playlist=${getYouTubeVideoId(currentSlide.videoUrl)}`}
            className="w-full h-full scale-150"
            style={{ pointerEvents: "none" }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          <div
            className="absolute inset-0 bg-black"
            style={{ opacity: currentSlide.overlayOpacity / 100 }}
          />
        </div>
      )}

      {/* Content */}
      <div className="container relative">
        <div
          className={cn(
            "mx-auto max-w-3xl",
            currentSlide.textAlignment === "left" && "mr-auto ml-0 text-left",
            currentSlide.textAlignment === "right" && "ml-auto mr-0 text-right",
            currentSlide.textAlignment === "center" && "text-center"
          )}
        >
          {currentSlide.subtitle && (
            <p
              className={cn(
                "mb-2 text-lg font-medium text-primary animate-fade-in-up",
                isTransitioning && "opacity-0"
              )}
              key={`subtitle-${currentIndex}`}
            >
              {currentSlide.subtitle}
            </p>
          )}
          <h1
            className={cn(
              "mb-2 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl animate-fade-in-up",
              isTransitioning && "opacity-0"
            )}
            style={{ animationDelay: "0.1s" }}
            key={`title-${currentIndex}`}
          >
            {renderTitle(currentSlide.title)}
          </h1>
          {currentSlide.description && (
            <p
              className={cn(
                "mt-6 mb-4 text-lg text-muted-foreground md:text-xl max-w-2xl animate-fade-in-up",
                currentSlide.textAlignment === "center" && "mx-auto",
                currentSlide.textAlignment === "right" && "ml-auto",
                isTransitioning && "opacity-0"
              )}
              style={{ animationDelay: "0.2s" }}
              key={`desc-${currentIndex}`}
            >
              {currentSlide.description}
            </p>
          )}
          <div
            className={cn(
              "flex flex-col gap-4 sm:flex-row animate-fade-in-up",
              currentSlide.textAlignment === "center" && "sm:justify-center",
              currentSlide.textAlignment === "right" && "sm:justify-end",
              isTransitioning && "opacity-0"
            )}
            style={{ animationDelay: "0.3s" }}
            key={`buttons-${currentIndex}`}
          >
            {currentSlide.buttonText && currentSlide.buttonLink && (
              <Link href={currentSlide.buttonLink}>
                <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-primary to-emerald-600 hover:from-primary/90 hover:to-emerald-600/90 shadow-lg shadow-primary/25 group btn-glow">
                  {currentSlide.buttonText}
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            )}
            {currentSlide.secondaryButtonText && currentSlide.secondaryButtonLink && (
              <Link href={currentSlide.secondaryButtonLink}>
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-border/50 hover:border-primary/50 hover:bg-primary/5 group glass-card">
                  {currentSlide.secondaryButtonText}
                  <Rocket className="ml-2 h-4 w-4 group-hover:translate-y-[-2px] transition-transform" />
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Slider Controls */}
        {slides.length > 1 && (
          <>
            {/* Navigation Arrows */}
            <button
              onClick={goToPrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/50 backdrop-blur-sm border border-border/50 text-foreground hover:bg-background/80 transition-all opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100"
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={goToNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/50 backdrop-blur-sm border border-border/50 text-foreground hover:bg-background/80 transition-all opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100"
              aria-label="Next slide"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Dots & Play/Pause */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
              {/* Play/Pause button */}
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-1.5 rounded-full bg-background/50 backdrop-blur-sm border border-border/50 text-foreground hover:bg-background/80 transition-all"
                aria-label={isPlaying ? "Pause slideshow" : "Play slideshow"}
              >
                {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              </button>

              {/* Dots */}
              <div className="flex gap-2">
                {slides.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => goToSlide(index)}
                    className={cn(
                      "w-2 h-2 rounded-full transition-all",
                      index === currentIndex
                        ? "bg-primary w-6"
                        : "bg-foreground/30 hover:bg-foreground/50"
                    )}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
