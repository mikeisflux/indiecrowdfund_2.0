import { MarketplaceListingPage } from "@/components/marketplace/marketplace-listing-page";

export default function HotMusicPage() {
  return (
    <MarketplaceListingPage
      title="Hot Songs"
      description="Most-played tracks across the platform"
      apiQuery="?mediaCategory=music&sort=hot"
      detailHrefPrefix="/marketplace/books/"
      kind="music"
    />
  );
}
