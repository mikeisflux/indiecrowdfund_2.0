import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t py-12 bg-background">
      <div className="container">
        <div className="grid gap-8 md:grid-cols-3 lg:grid-cols-5">
          <div>
            <h4 className="mb-4 font-semibold">IndieCrowdfund</h4>
            <p className="text-sm text-muted-foreground">
              Empowering creators to bring their ideas to life through community funding.
            </p>
          </div>
          <div>
            <h4 className="mb-4 font-semibold">Discover</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/discover" className="hover:text-foreground">All Projects</Link></li>
              <li><Link href="/marketplace" className="hover:text-foreground">Digital Marketplace</Link></li>
              <li><Link href="/discover?category=games" className="hover:text-foreground">Games</Link></li>
              <li><Link href="/discover?category=technology" className="hover:text-foreground">Technology</Link></li>
              <li><Link href="/discover?category=art" className="hover:text-foreground">Art</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 font-semibold">For Creators</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/projects/new" className="hover:text-foreground">Start a Project</Link></li>
              <li><Link href="/creator-handbook" className="hover:text-foreground">Creator Handbook</Link></li>
              <li><Link href="/marketplace-handbook/creators" className="hover:text-foreground">Marketplace Handbook</Link></li>
              <li><Link href="/fees" className="hover:text-foreground">Fees & Pricing</Link></li>
              <li><Link href="/success-stories" className="hover:text-foreground">Success Stories</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 font-semibold">For Backers</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/backer-handbook" className="hover:text-foreground">Backer Handbook</Link></li>
              <li><Link href="/marketplace-handbook/backers" className="hover:text-foreground">Marketplace Handbook</Link></li>
              <li><Link href="/what-is-divinitycoin" className="hover:text-foreground">What is DivinityCoin?</Link></li>
              <li><Link href="/backer-handbook#stripe" className="hover:text-foreground">Paying with Card</Link></li>
              <li><Link href="/backer-handbook#divinitycoin" className="hover:text-foreground">Paying with DivinityCoin</Link></li>
              <li><Link href="/dashboard/backer" className="hover:text-foreground">My Pledges</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 font-semibold">Support</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/help" className="hover:text-foreground">Help Center</Link></li>
              <li><Link href="/faq" className="hover:text-foreground">FAQ</Link></li>
              <li><Link href="/contact" className="hover:text-foreground">Contact Us</Link></li>
              <li><Link href="/about-us" className="hover:text-foreground">About Us</Link></li>
              <li><Link href="/terms" className="hover:text-foreground">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} IndieCrowdfund. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
