import { Star } from "lucide-react";

export function StarRating({ rating, size = "sm" }: { rating: number | null; size?: "sm" | "lg" }) {
  if (rating === null) return <span className="text-muted-foreground">-</span>;
  const stars = [];
  const starSize = size === "lg" ? "h-5 w-5" : "h-4 w-4";
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Star
        key={i}
        className={`${starSize} ${i <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
      />
    );
  }
  return <div className="flex items-center gap-0.5">{stars}</div>;
}
