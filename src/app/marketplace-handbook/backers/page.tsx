'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Search,
  CreditCard,
  Library,
  BookOpen,
  ShoppingCart,
  Star,
  Heart,
  Gift,
  Info,
  ArrowRight,
  ArrowLeft,
  Smartphone,
  Monitor,
  FileText,
  Users,
  Shield,
} from 'lucide-react';
import { Footer } from "@/components/footer";

interface Step {
  title: string;
  description: string;
  tip?: string;
  example?: string;
}

interface FAQ {
  question: string;
  answer: string;
}

const tabs = [
  { id: 'overview', label: 'Overview', icon: BookOpen },
  { id: 'browsing', label: 'Browsing', icon: Search },
  { id: 'purchasing', label: 'Purchasing', icon: ShoppingCart },
  { id: 'library', label: 'Your Library', icon: Library },
  { id: 'reading', label: 'Reading', icon: Monitor },
  { id: 'support', label: 'Supporting Creators', icon: Heart },
];

const overviewSteps: Step[] = [
  {
    title: 'What is the Digital Marketplace?',
    description: 'The Digital Marketplace is IndieCrowdfund\'s dedicated storefront for digital content created by indie creators. Unlike our crowdfunding campaigns where you pledge toward a project goal, the marketplace offers completed digital works that are available for immediate purchase and instant download.',
    tip: 'Think of it as a bookstore for indie digital content - browse, buy, and read in minutes.',
  },
  {
    title: 'How is it Different from Crowdfunding?',
    description: 'With crowdfunding, you\'re supporting a project before it\'s complete and may wait months for delivery. With the marketplace, creators list finished products that you can purchase and access immediately. Your payment is charged right away, and there\'s no waiting for funding goals or delivery.',
    example: 'Crowdfunding: "Back my upcoming graphic novel!" → Marketplace: "Buy my completed graphic novel now!"',
  },
  {
    title: 'What\'s Available?',
    description: 'The marketplace currently features digital books including graphic novels, comics, art books, novels, guides, and more. All content is delivered as high-quality PDF files that you can read online or download to your devices.',
    tip: 'More content types may be added in the future. Follow your favorite creators to be notified of new releases.',
  },
  {
    title: 'Who Creates the Content?',
    description: 'All marketplace content is created by independent creators who have been verified on our platform. Many are the same creators who run successful crowdfunding campaigns. By purchasing from the marketplace, you\'re directly supporting indie creators.',
    example: 'A creator who crowdfunded their first book might release sequels directly on the marketplace.',
  },
];

const browsingSteps: Step[] = [
  {
    title: 'Accessing the Marketplace',
    description: 'Click "Digital Marketplace" in the main navigation or visit /marketplace directly. You\'ll see the marketplace homepage featuring collections, new releases, and popular titles.',
    tip: 'The marketplace link is available in the main navigation and in the footer under "Discover".',
  },
  {
    title: 'Exploring Featured Collections',
    description: 'The homepage displays curated collections including Staff Picks (hand-selected by our team), New Releases (recently added titles), and Popular titles. Scroll through these to discover quality content.',
    example: 'Staff Picks might feature a beautifully illustrated art book, while New Releases shows the latest uploads from creators.',
  },
  {
    title: 'Browsing All Books',
    description: 'Click "Browse All Books" to see the complete marketplace catalog. Books are displayed in a grid view showing the cover, title, creator, price, and average rating.',
    tip: 'Use this view when you want to explore everything available rather than curated selections.',
  },
  {
    title: 'Using Search',
    description: 'Use the search bar to find specific titles, creators, or topics. Search results show matching books with their covers, prices, and ratings for easy comparison.',
    example: 'Search for "fantasy" to find fantasy novels and comics, or search an author\'s name to find all their works.',
  },
  {
    title: 'Viewing Book Details',
    description: 'Click on any book to see its full details page. Here you\'ll find the complete description, preview pages, creator information, reviews from other readers, and purchase options.',
    tip: 'Always read the description and check the preview before purchasing to make sure it\'s what you\'re looking for.',
  },
  {
    title: 'Checking Previews',
    description: 'Most books offer a preview so you can see sample pages before buying. Click the "Preview" button on the book detail page to view sample content. This gives you a feel for the art style, writing, and quality.',
    example: 'A comic might show the first 5 pages, while an art book might display sample artwork from different sections.',
  },
];

const purchasingSteps: Step[] = [
  {
    title: 'Adding to Cart or Direct Purchase',
    description: 'On the book detail page, click "Purchase" or "Add to Cart" to begin checkout. Some books offer both options - direct purchase for single-book buying, or cart for multiple purchases.',
    tip: 'If you\'re buying multiple books, adding to cart lets you check out once for all of them.',
  },
  {
    title: 'Reviewing Your Purchase',
    description: 'Before payment, you\'ll see a summary showing the book title, price, and total. Review this to confirm you\'re purchasing the correct item at the expected price.',
    example: '"Digital Art Techniques Vol. 1" by Jane Creator - $9.99. Subtotal: $9.99',
  },
  {
    title: 'Payment Options',
    description: 'The marketplace accepts credit and debit cards through Stripe, our secure payment processor. Enter your card details to complete the purchase. All payments are encrypted and secure.',
    tip: 'Save your card for faster future purchases. Your card details are stored securely by Stripe, not on our servers.',
  },
  {
    title: 'Instant Delivery',
    description: 'Once your payment is processed, the book is immediately added to your Digital Library. There\'s no waiting - you can start reading within seconds of completing your purchase.',
    example: 'Complete checkout at 2:00 PM → Book appears in your library at 2:00 PM → Start reading at 2:01 PM',
  },
  {
    title: 'Purchase Confirmation',
    description: 'You\'ll receive an email confirmation with your purchase details and a link to access your Digital Library. This serves as your receipt and proof of purchase.',
    tip: 'Check your spam folder if you don\'t see the confirmation email within a few minutes.',
  },
  {
    title: 'Using Discount Codes',
    description: 'Some creators offer discount codes for free or reduced-price books. Enter the code at checkout in the "Promo Code" field to apply the discount before completing your purchase.',
    example: 'A creator might share code "THANKYOU" with their newsletter subscribers for a free book.',
  },
];

const librarySteps: Step[] = [
  {
    title: 'Accessing Your Digital Library',
    description: 'Your Digital Library is located in your Backer Dashboard. Go to Dashboard → Digital Library to see all your purchased content. All marketplace purchases appear here automatically.',
    tip: 'Bookmark your Digital Library page for quick access: /dashboard/backer?tab=library',
  },
  {
    title: 'Viewing Your Collection',
    description: 'Your library displays all purchased books with their covers, titles, and creators. Books are organized with the most recent purchases first. You can see your entire digital collection at a glance.',
    example: 'If you\'ve purchased 5 books over the past month, they\'ll all appear in your library sorted by purchase date.',
  },
  {
    title: 'Book Status Indicators',
    description: 'Each book in your library shows its status. "New" indicates recently purchased items you haven\'t read yet. "Downloaded" shows books you\'ve saved to your device.',
    tip: 'Use these indicators to keep track of what you\'ve read and what\'s waiting in your backlog.',
  },
  {
    title: 'Quick Actions',
    description: 'Each book in your library has quick action buttons: Read (opens in browser), Download (saves PDF to device), and View Details (shows purchase info and creator links).',
    example: 'Commuting? Hit "Read" to read in your browser. At home? Hit "Download" to save for offline reading on your tablet.',
  },
  {
    title: 'Purchase History',
    description: 'Click on any book to see its purchase details including the date, price paid, and order number. This information is useful if you ever need to reference a purchase.',
    tip: 'Your complete purchase history is available even for books purchased months or years ago.',
  },
  {
    title: 'Cross-Device Access',
    description: 'Your library syncs across all devices. Log in on your phone, tablet, laptop, or desktop and you\'ll see the same library. Your purchases follow you everywhere.',
    example: 'Buy a book on your laptop, start reading on your phone during lunch, continue on your tablet at home.',
  },
];

const readingSteps: Step[] = [
  {
    title: 'Reading in Your Browser',
    description: 'Click the "Read" button on any book in your library to open it in our web-based reader. The reader is optimized for digital books with features like zoom, page navigation, and fullscreen mode.',
    tip: 'The web reader works on any device with a modern browser - no app installation required.',
  },
  {
    title: 'Downloading for Offline Reading',
    description: 'Click "Download" to save the PDF file to your device. Downloaded files can be opened with any PDF reader app and don\'t require an internet connection to read.',
    example: 'Download before a flight, and read offline during your trip. The PDF is yours to keep permanently.',
  },
  {
    title: 'Recommended PDF Readers',
    description: 'For the best offline reading experience, we recommend Adobe Acrobat Reader (free), Apple Books (Mac/iOS), or any PDF reader on your preferred device. These apps offer bookmarking, annotation, and comfortable reading features.',
    tip: 'iPad with Apple Books or a tablet with a good PDF reader provides a book-like reading experience.',
  },
  {
    title: 'Zoom and Navigation',
    description: 'In the web reader, use pinch-to-zoom on touch devices or the zoom controls on desktop. Navigate pages using arrow keys, clicking page edges, or the page slider. Jump to any page using the page number input.',
    example: 'Reading a detailed art book? Zoom in to appreciate the fine details. Reading a comic? Zoom to panel level.',
  },
  {
    title: 'Reading on Different Devices',
    description: 'The web reader adapts to your screen size. On phones, pages display in single-page mode. On tablets and desktops, you can choose single or two-page spread view for a book-like experience.',
    tip: 'Rotate your phone to landscape for wider page views. Use portrait on tablets for full-page reading.',
  },
  {
    title: 'Saving Your Place',
    description: 'Downloaded PDFs save your reading position in your PDF app. Use bookmarks in your PDF reader to mark important pages or where you stopped reading.',
    example: 'Reading a 200-page graphic novel over several sessions? Bookmark your current page in your PDF reader.',
  },
];

const supportSteps: Step[] = [
  {
    title: 'Direct Creator Support',
    description: 'Every marketplace purchase directly supports the creator. Unlike traditional publishing where authors receive a small royalty, indie creators on our marketplace receive the majority of each sale.',
    tip: 'Buying from the marketplace is one of the best ways to support indie creators financially.',
  },
  {
    title: 'Leaving Reviews',
    description: 'After reading a book, leave a review to help other readers discover great content. Rate the book and write a brief review describing what you liked. Honest reviews help creators improve and help readers make informed decisions.',
    example: '"Loved the artwork and storytelling! The dragon designs were incredibly detailed. 5 stars."',
  },
  {
    title: 'Following Creators',
    description: 'Click the "Follow" button on a creator\'s profile to get notified when they release new content. Following is free and helps you stay updated on your favorite creators\' latest works.',
    tip: 'Following creators means you\'ll never miss a new release from someone whose work you enjoy.',
  },
  {
    title: 'Sharing with Friends',
    description: 'If you love a book, share it! Use the share buttons on the book page to post to social media, or copy the link to send directly to friends. Word of mouth is incredibly valuable for indie creators.',
    example: 'Tweet: "Just finished @CreatorName\'s new comic on @IndieCrowdfund - absolutely stunning art! Check it out: [link]"',
  },
  {
    title: 'Backing Their Crowdfunding Campaigns',
    description: 'Many marketplace creators also run crowdfunding campaigns for new projects. If you enjoyed their marketplace content, consider backing their next campaign to get early access to new works and exclusive rewards.',
    tip: 'Visit a creator\'s profile to see if they have any active or upcoming crowdfunding campaigns.',
  },
  {
    title: 'Finding Physical Editions',
    description: 'Prefer physical books? Some creators offer printed editions through their own stores. Look for the "Order Physical Copies" link on the creator\'s profile page to find where you can purchase print versions.',
    example: 'A creator might sell prints through their personal website or a print-on-demand service.',
  },
];

const faqs: FAQ[] = [
  {
    question: 'Can I get a refund on a digital purchase?',
    answer: 'Due to the nature of digital content (which cannot be "returned" once accessed), refunds are evaluated on a case-by-case basis. If you accidentally made a duplicate purchase or encountered a technical issue preventing access, contact support within 48 hours.',
  },
  {
    question: 'Do my purchases expire?',
    answer: 'No! Once you purchase a book, it\'s yours forever. Your Digital Library purchases never expire, and downloaded PDFs are permanent files you can keep on your devices indefinitely.',
  },
  {
    question: 'Can I share my purchased books with others?',
    answer: 'Purchased books are licensed for personal use only. Each purchase is for a single user. If you want to share a book with someone, encourage them to purchase their own copy to support the creator.',
  },
  {
    question: 'What file format are the books in?',
    answer: 'All books are delivered as PDF files, which is compatible with virtually every device and PDF reader. PDFs maintain the original layout, formatting, and image quality.',
  },
  {
    question: 'Can I read on my e-reader like Kindle?',
    answer: 'You can transfer PDF files to most e-readers, though the reading experience varies by device. E-ink readers work best with text-heavy PDFs. For graphic-heavy content like comics or art books, tablets or computers provide a better experience.',
  },
  {
    question: 'What if I have trouble downloading or accessing a book?',
    answer: 'First, try refreshing your Digital Library page and attempting the download again. If issues persist, check your internet connection and ensure you\'re logged into the correct account. Still having trouble? Contact our support team with your order details.',
  },
  {
    question: 'Are marketplace purchases separate from crowdfunding pledges?',
    answer: 'Yes, they\'re completely separate. Marketplace purchases appear in your Digital Library, while crowdfunding pledge rewards are managed through your Backer Dashboard\'s pledge section. You might receive digital content from both sources.',
  },
  {
    question: 'Can I pay with DivinityCoin in the marketplace?',
    answer: 'Currently, the marketplace accepts credit/debit cards and promo codes from creators. DivinityCoin is used for crowdfunding pledges. Check the payment options at checkout for the most current accepted methods.',
  },
];

function StepCard({ step, number }: { step: Step; number: number }) {
  return (
    <div className="rounded-lg border border-border bg-card/80 backdrop-blur-sm p-5 hover:shadow-lg transition-all duration-300">
      <div className="flex items-start gap-4">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
          {number}
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-foreground">{step.title}</h4>
          <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
          {step.example && (
            <div className="mt-3 flex gap-2 rounded-lg bg-muted p-3">
              <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <p className="text-sm text-muted-foreground italic">{step.example}</p>
            </div>
          )}
          {step.tip && (
            <div className="mt-3 flex gap-2 rounded-lg bg-primary/10 p-3">
              <Info className="h-4 w-4 flex-shrink-0 text-primary" />
              <p className="text-sm text-primary">{step.tip}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FAQItem({ faq }: { faq: FAQ }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border bg-card/80 backdrop-blur-sm overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
      >
        <span className="font-medium text-foreground">{faq.question}</span>
        <ArrowRight className={`h-5 w-5 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      {isOpen && (
        <div className="border-t border-border px-4 py-3 bg-muted/50">
          <p className="text-sm text-muted-foreground">{faq.answer}</p>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h3 className="text-2xl font-bold text-foreground">{title}</h3>
      <p className="mt-2 text-muted-foreground">{description}</p>
    </div>
  );
}

export default function MarketplaceBackerHandbookPage() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 relative overflow-hidden">
      {/* Floating Orbs */}
      <div className="floating-orb w-96 h-96 bg-primary/10 -top-48 -right-48" style={{ animationDelay: "0s" }} />
      <div className="floating-orb w-80 h-80 bg-primary/5 top-1/3 -left-40" style={{ animationDelay: "2s" }} />
      <div className="floating-orb w-64 h-64 bg-primary/10 bottom-40 right-1/4" style={{ animationDelay: "4s" }} />

      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 py-16 text-center text-primary-foreground relative overflow-hidden">
        <div className="relative z-10 px-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <ShoppingCart className="h-10 w-10" />
            <BookOpen className="h-10 w-10" />
          </div>
          <h1 className="text-4xl font-bold">Digital Marketplace Handbook</h1>
          <p className="mt-2 text-primary-foreground/80 text-lg">
            For Backers & Readers
          </p>
          <p className="mt-4 max-w-2xl mx-auto text-primary-foreground/70">
            Your complete guide to discovering, purchasing, and enjoying digital content from indie creators
          </p>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/backer-handbook" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Backer Handbook
        </Link>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
        {/* Tab Navigation */}
        <div className="mb-8 flex flex-wrap gap-2 rounded-xl bg-card/80 backdrop-blur-sm p-2 shadow-sm border border-border">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="space-y-8">
          {activeTab === 'overview' && (
            <>
              <SectionHeader
                title="Understanding the Digital Marketplace"
                description="Learn what the marketplace is, how it works, and what makes it different from crowdfunding."
              />
              <div className="mb-6 rounded-lg border border-primary/30 bg-primary/10 p-4">
                <div className="flex gap-3">
                  <Shield className="h-5 w-5 flex-shrink-0 text-primary" />
                  <div>
                    <h4 className="font-medium text-foreground">Instant Access to Indie Content</h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      The Digital Marketplace offers completed works from verified indie creators. Buy once, own forever, and read on any device.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                {overviewSteps.map((step, index) => (
                  <StepCard key={step.title} step={step} number={index + 1} />
                ))}
              </div>
            </>
          )}

          {activeTab === 'browsing' && (
            <>
              <SectionHeader
                title="Browsing the Marketplace"
                description="How to find and explore digital books and content from indie creators."
              />
              <div className="space-y-4">
                {browsingSteps.map((step, index) => (
                  <StepCard key={step.title} step={step} number={index + 1} />
                ))}
              </div>
            </>
          )}

          {activeTab === 'purchasing' && (
            <>
              <SectionHeader
                title="Making a Purchase"
                description="Step-by-step guide to purchasing digital content from the marketplace."
              />
              <div className="mb-6 rounded-lg border border-primary/30 bg-primary/10 p-4">
                <div className="flex gap-3">
                  <CreditCard className="h-5 w-5 flex-shrink-0 text-primary" />
                  <div>
                    <h4 className="font-medium text-foreground">Secure & Instant</h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      All payments are processed securely through Stripe. Once payment completes, your content is available immediately in your Digital Library.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                {purchasingSteps.map((step, index) => (
                  <StepCard key={step.title} step={step} number={index + 1} />
                ))}
              </div>
            </>
          )}

          {activeTab === 'library' && (
            <>
              <SectionHeader
                title="Your Digital Library"
                description="Managing and accessing your purchased content."
              />
              <div className="mb-6 rounded-lg border border-primary/30 bg-primary/10 p-4">
                <div className="flex gap-3">
                  <Library className="h-5 w-5 flex-shrink-0 text-primary" />
                  <div>
                    <h4 className="font-medium text-foreground">Your Books, Forever</h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Every purchase is added to your Digital Library instantly. Access your entire collection anytime, from any device, with no expiration.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                {librarySteps.map((step, index) => (
                  <StepCard key={step.title} step={step} number={index + 1} />
                ))}
              </div>
            </>
          )}

          {activeTab === 'reading' && (
            <>
              <SectionHeader
                title="Reading Your Books"
                description="How to read and enjoy your digital content across all your devices."
              />
              <div className="mb-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-border bg-card/80 p-4">
                  <div className="flex gap-3">
                    <Monitor className="h-5 w-5 flex-shrink-0 text-primary" />
                    <div>
                      <h4 className="font-medium text-foreground">Browser Reading</h4>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Read directly in your web browser - no app needed. Works on any device.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-card/80 p-4">
                  <div className="flex gap-3">
                    <Smartphone className="h-5 w-5 flex-shrink-0 text-primary" />
                    <div>
                      <h4 className="font-medium text-foreground">Offline Reading</h4>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Download PDFs for offline reading in your favorite reader app.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                {readingSteps.map((step, index) => (
                  <StepCard key={step.title} step={step} number={index + 1} />
                ))}
              </div>
            </>
          )}

          {activeTab === 'support' && (
            <>
              <SectionHeader
                title="Supporting Indie Creators"
                description="Beyond purchases: how to help creators succeed and grow."
              />
              <div className="mb-6 rounded-lg border border-primary/30 bg-primary/10 p-4">
                <div className="flex gap-3">
                  <Users className="h-5 w-5 flex-shrink-0 text-primary" />
                  <div>
                    <h4 className="font-medium text-foreground">Indie Creators Depend on You</h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Unlike traditional publishing, indie creators receive the majority of each sale. Your purchase, review, and recommendation directly supports their ability to keep creating.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                {supportSteps.map((step, index) => (
                  <StepCard key={step.title} step={step} number={index + 1} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* FAQ Section */}
        <div className="mt-16">
          <SectionHeader
            title="Frequently Asked Questions"
            description="Common questions about the Digital Marketplace."
          />
          <div className="space-y-3">
            {faqs.map((faq) => (
              <FAQItem key={faq.question} faq={faq} />
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 rounded-2xl bg-gradient-to-r from-primary to-primary/80 p-8 text-center text-primary-foreground">
          <h3 className="text-2xl font-bold">Ready to Explore?</h3>
          <p className="mt-2 text-primary-foreground/80">Discover amazing digital content from indie creators.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 rounded-lg bg-background px-6 py-3 font-medium text-foreground hover:bg-muted transition-colors"
            >
              <ShoppingCart className="h-5 w-5" />
              Visit Marketplace
            </Link>
            <Link
              href="/dashboard/backer"
              className="inline-flex items-center gap-2 rounded-lg border-2 border-primary-foreground px-6 py-3 font-medium text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
            >
              <Library className="h-5 w-5" />
              My Digital Library
            </Link>
          </div>
        </div>

        {/* Related Links */}
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <Link
            href="/marketplace-handbook/creators"
            className="rounded-lg border border-border bg-card/80 p-4 hover:border-primary/50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2 group-hover:bg-primary/20 transition-colors">
                <Star className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-medium text-foreground">Creator Handbook</h4>
                <p className="text-sm text-muted-foreground">Learn how creators list and sell content</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground ml-auto group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
          <Link
            href="/backer-handbook"
            className="rounded-lg border border-border bg-card/80 p-4 hover:border-primary/50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2 group-hover:bg-primary/20 transition-colors">
                <Gift className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-medium text-foreground">Backer Handbook</h4>
                <p className="text-sm text-muted-foreground">Learn about crowdfunding campaigns</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground ml-auto group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  );
}
