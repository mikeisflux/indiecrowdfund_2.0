import { MarketplaceListingPage } from "@/components/marketplace/marketplace-listing-page";

export default async function MusicGenrePage({ params }: { params: Promise<{ genre: string }> }) {
  const { genre } = await params;
  const decoded = decodeURIComponent(genre);
  // Title-case the URL slug for display ("hip-hop" -> "Hip Hop").
  const display = decoded.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <MarketplaceListingPage
      title={`${display} Music`}
      description={`Browse ${display.toLowerCase()} releases from independent artists`}
      apiQuery={`?mediaCategory=music&category=${encodeURIComponent(decoded)}`}
      detailHrefPrefix="/marketplace/books/"
      kind="music"
    />
  );
}
