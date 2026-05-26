import { MarketplaceListingPage } from "@/components/marketplace/marketplace-listing-page";

export default function StaffPickComicsPage() {
  return (
    <MarketplaceListingPage
      title="Staff Picks"
      description="Comics our team is loving right now"
      apiQuery="?mediaCategory=comics&staffPick=true"
      detailHrefPrefix="/shop/books/"
      kind="comics"
    />
  );
}
