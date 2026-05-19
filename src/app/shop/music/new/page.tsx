import { MarketplaceListingPage } from "@/components/marketplace/marketplace-listing-page";

export default function NewMusicPage() {
  return (
    <MarketplaceListingPage
      title="New Releases"
      description="The latest tracks from independent artists"
      apiQuery="?mediaCategory=music"
      detailHrefPrefix="/shop/books/"
      kind="music"
    />
  );
}
