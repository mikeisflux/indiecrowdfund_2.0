import { MarketplaceListingPage } from "@/components/marketplace/marketplace-listing-page";

export default function DollarBinComicsPage() {
  return (
    <MarketplaceListingPage
      title="The Dollar Bin"
      description="Comics priced under $5.00"
      apiQuery="?mediaCategory=comics&dollarBin=true"
      detailHrefPrefix="/shop/books/"
      kind="movie"
    />
  );
}
