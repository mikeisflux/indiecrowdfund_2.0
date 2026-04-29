import { MarketplaceListingPage } from "@/components/marketplace/marketplace-listing-page";

export default function StaffPickMusicPage() {
  return (
    <MarketplaceListingPage
      title="Staff Picks"
      description="Music our team is loving right now"
      apiQuery="?mediaCategory=music&staffPick=true"
      detailHrefPrefix="/marketplace/books/"
      kind="music"
    />
  );
}
