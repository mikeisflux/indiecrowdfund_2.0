import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Books & Comics Marketplace - Indie Creator Bookstore",
  description:
    "Browse and buy indie books, comics, and graphic novels from independent creators on IndieCrowdfund. Support creators directly with every purchase.",
};

export default function MarketplaceBooksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
