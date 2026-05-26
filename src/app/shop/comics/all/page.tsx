import { MarketplaceListingPage } from "@/components/marketplace/marketplace-listing-page";

export default function AllComicsPage() {
  return (
    <MarketplaceListingPage
      title="All Comics"
      description="Every comic on the platform, newest first"
      apiQuery="?mediaCategory=comics"
      detailHrefPrefix="/shop/books/"
      kind="comics"
    />
  );
}
