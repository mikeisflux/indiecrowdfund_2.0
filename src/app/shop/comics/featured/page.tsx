import { MarketplaceListingPage } from "@/components/marketplace/marketplace-listing-page";

export default function FeaturedComicsPage() {
  return (
    <MarketplaceListingPage
      title="Featured Comics"
      description="Editor-picked comics from independent creators"
      apiQuery="?mediaCategory=comics&featured=true"
      detailHrefPrefix="/shop/books/"
      kind="comics"
    />
  );
}
