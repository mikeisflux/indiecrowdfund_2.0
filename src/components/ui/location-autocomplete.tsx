"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MapPin, Loader2 } from "lucide-react";

// Google Maps types
type AutocompleteService = google.maps.places.AutocompleteService;

interface LocationAutocompleteProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

interface Prediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

export function LocationAutocomplete({
  value,
  onChange,
  placeholder = "Enter city, state, or country",
  className,
  disabled,
}: LocationAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value || "");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const autocompleteServiceRef = useRef<AutocompleteService | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load Google Maps script
  useEffect(() => {
    if (typeof window !== "undefined" && !window.google?.maps?.places) {
      // Check if script already exists
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript) {
        existingScript.addEventListener("load", () => {
          setIsGoogleLoaded(true);
        });
        return;
      }

      // Get API key from environment or window config
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
      if (!apiKey) {
        console.warn("Google Places API key not configured. Location autocomplete disabled.");
        return;
      }

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        setIsGoogleLoaded(true);
      };
      document.head.appendChild(script);
    } else if (window.google?.maps?.places) {
      setIsGoogleLoaded(true);
    }
  }, []);

  // Initialize autocomplete service
  useEffect(() => {
    if (isGoogleLoaded && window.google?.maps?.places) {
      autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
    }
  }, [isGoogleLoaded]);

  // Sync with external value changes (intentionally only depends on `value` prop)
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchPredictions = useCallback((input: string) => {
    if (!autocompleteServiceRef.current || !input.trim()) {
      setPredictions([]);
      return;
    }

    setIsLoading(true);

    autocompleteServiceRef.current.getPlacePredictions(
      {
        input,
        types: ["(cities)"], // Focus on cities for project locations
      },
      (results, status) => {
        setIsLoading(false);
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          setPredictions(results as unknown as Prediction[]);
          setShowDropdown(true);
        } else {
          setPredictions([]);
        }
      }
    );
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // Debounce API calls
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (newValue.length >= 2 && isGoogleLoaded) {
      debounceTimerRef.current = setTimeout(() => {
        fetchPredictions(newValue);
      }, 300);
    } else {
      setPredictions([]);
      setShowDropdown(false);
    }
  };

  const handleSelect = (prediction: Prediction) => {
    const selectedValue = prediction.description;
    setInputValue(selectedValue);
    onChange(selectedValue);
    setPredictions([]);
    setShowDropdown(false);
  };

  const handleBlur = () => {
    // Update the value when user leaves the input
    if (inputValue !== value) {
      onChange(inputValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && predictions.length > 0) {
      e.preventDefault();
      handleSelect(predictions[0]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onFocus={() => predictions.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn("pl-10", className)}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && predictions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg"
        >
          <ul className="py-1">
            {predictions.map((prediction) => (
              <li
                key={prediction.place_id}
                onClick={() => handleSelect(prediction)}
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
              >
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="font-medium">
                    {prediction.structured_formatting.main_text}
                  </span>
                  {prediction.structured_formatting.secondary_text && (
                    <span className="text-muted-foreground">
                      , {prediction.structured_formatting.secondary_text}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">
            Powered by Google
          </div>
        </div>
      )}

      {!isGoogleLoaded && inputValue.length >= 2 && (
        <p className="mt-1 text-xs text-muted-foreground">
          Location autocomplete not available. Enter location manually.
        </p>
      )}
    </div>
  );
}

// Declare Google Maps types
declare global {
  interface Window {
    google: typeof google;
  }
}
