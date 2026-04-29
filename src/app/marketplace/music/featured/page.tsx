import { MarketplaceListingPage } from "@/components/marketplace/marketplace-listing-page";

export default function FeaturedMusicPage() {
  return (
    <MarketplaceListingPage
      title="Featured Music"
      description="Editor-picked tracks and albums"
      apiQuery="?mediaCategory=music&featured=true"
      detailHrefPrefix="/marketplace/books/"
      kind="music"
    />
  );
}
