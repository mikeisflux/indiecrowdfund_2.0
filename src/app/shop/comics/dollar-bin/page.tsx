import { MarketplaceListingPage } from "@/components/marketplace/marketplace-listing-page";

export default function DollarBinComicsPage() {
  return (
    <MarketplaceListingPage
      title="The Dollar Bin"
      description="Comics priced $5.00 or less"
      apiQuery="?mediaCategory=comics&dollarBin=true"
      detailHrefPrefix="/shop/books/"
      kind="comics"
    />
  );
}
