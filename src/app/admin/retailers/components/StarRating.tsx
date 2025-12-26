import { Star } from "lucide-react";

export function StarRating({ rating, size = "sm" }: { rating: number | null; size?: "sm" | "lg" }) {
  if (rating === null) return <span className="text-zinc-400">-</span>;
  const stars = [];
  const starSize = size === "lg" ? "h-5 w-5" : "h-4 w-4";
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Star
        key={i}
        className={`${starSize} ${i <= rating ? "fill-amber-400 text-amber-400" : "text-zinc-300"}`}
      />
    );
  }
  return <div className="flex items-center gap-0.5">{stars}</div>;
}
