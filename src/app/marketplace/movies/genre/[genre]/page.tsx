import { MarketplaceListingPage } from "@/components/marketplace/marketplace-listing-page";

export default async function MovieGenrePage({ params }: { params: Promise<{ genre: string }> }) {
  const { genre } = await params;
  const decoded = decodeURIComponent(genre);
  const display = decoded.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <MarketplaceListingPage
      title={`${display} Films`}
      description={`Browse ${display.toLowerCase()} films from independent creators`}
      apiQuery={`?mediaCategory=movie&category=${encodeURIComponent(decoded)}`}
      detailHrefPrefix="/marketplace/books/"
      kind="movie"
    />
  );
}
