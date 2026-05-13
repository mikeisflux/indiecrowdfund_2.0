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
    description: 'A store that sells finished digital books, comics, and art packs. You buy a book and get the file right away — no waiting.',
    tip: 'Think of it as a bookstore for indie creators. Click, pay, read.',
  },
  {
    title: 'How is it different from crowdfunding?',
    description: 'Crowdfunding is when you help pay for a book that is not made yet. You wait for it to be made and shipped. The Marketplace is for books that are already done. You pay and you get them right now.',
    example: 'Crowdfunding: "Help me make a comic next year." → Marketplace: "Buy my finished comic today."',
  },
  {
    title: 'What can you buy?',
    description: 'Right now: digital books. That means PDF files. Comics, graphic novels, art books, novels, how-to guides — anything a creator wants to sell as a digital file.',
    tip: 'New types of files may be added later. Follow your favorite creators so you hear when they release something new.',
  },
  {
    title: 'Who makes the books?',
    description: 'Real indie creators, the same kind of people who run crowdfunding campaigns on this site. They get paid most of the money from each sale, so buying here helps them keep making things.',
    example: 'A creator might run a Kickstarter for Book 1, then sell Book 1 on the Marketplace once it is finished.',
  },
];

const browsingSteps: Step[] = [
  {
    title: 'Open the Marketplace',
    description: 'Click "Digital Marketplace" in the top menu. Or just type /marketplace in the address bar. The home page shows new releases, staff picks, and the most popular books.',
    tip: 'You can also reach the Marketplace from the footer of any page on the site.',
  },
  {
    title: 'Look at the featured shelves',
    description: 'The home page has rows of books picked by us: Staff Picks (our favorites), New Releases (just added), and Popular (other people are buying these). Scroll through and see what catches your eye.',
    example: 'Staff Picks might show a beautiful art book. New Releases might show what dropped this week.',
  },
  {
    title: 'Browse the full catalog',
    description: 'Click "Browse All Books" to see every book on the Marketplace. Each book shows the cover, title, who made it, the price, and the star rating.',
    tip: 'Use this when you are not sure what you want and just want to look around.',
  },
  {
    title: 'Search for something specific',
    description: 'Type a title, a creator name, or a topic into the search bar at the top. The list updates as you type.',
    example: 'Type "fantasy" to find every fantasy book. Type a creator\'s name to see all of their books.',
  },
  {
    title: 'Open a book\'s page',
    description: 'Click any book cover. You will see the full description, sample pages, the creator\'s name, reviews from other readers, and the Buy button.',
    tip: 'Always read the description AND check the sample pages before you buy.',
  },
  {
    title: 'Read a free preview',
    description: 'Most books let you read a few sample pages without paying. Click the "Preview" button on the book page. This is the best way to make sure the book is what you want before you spend money.',
    example: 'A comic might let you read the first 5 pages. An art book might show sample pages from each section.',
  },
];

const purchasingSteps: Step[] = [
  {
    title: 'Click Buy',
    description: 'On the book page, click "Purchase" (or "Add to Cart" if you want to buy more than one book at the same time). Both options work — Cart is best for buying several books in one go.',
    tip: 'Buying several books? Add them all to the cart, then check out once. One charge instead of many.',
  },
  {
    title: 'Check your order',
    description: 'A summary screen shows the book title, price, and total. Read it carefully and make sure everything is right before you pay.',
    example: '"Digital Art Techniques Vol. 1" by Jane Creator — $9.99. Total: $9.99.',
  },
  {
    title: 'Enter your card',
    description: 'The Marketplace processes card payments through DivinityCoin, PayPal, or Whop depending on the creator\'s setup. Type your credit or debit card number, expiration, and CVV in the form. Your card details are encrypted in your browser and sent straight to the processor — they never touch IndieCrowdfund servers.',
    tip: 'Save your card to make next time faster. Saved cards are stored on the processor\'s side, never on IndieCrowdfund servers.',
  },
  {
    title: 'Get the book right away',
    description: 'When the payment goes through, the book lands in your account in seconds. No waiting. No shipping. You can start reading immediately.',
    example: 'Pay at 2:00 PM → book in your library at 2:00 PM → read at 2:01 PM.',
  },
  {
    title: 'Save your receipt',
    description: 'You will get a confirmation email with your order details and a link to your library. Keep it — it is your proof of purchase.',
    tip: 'Don\'t see the email after a few minutes? Check your spam folder.',
  },
  {
    title: 'Use a discount code',
    description: 'Some creators give out promo codes for free or cheaper books. Type the code into the "Promo Code" box at checkout before you pay. The price updates right away.',
    example: 'A creator might share code "THANKYOU" with their newsletter for a free download.',
  },
];

const librarySteps: Step[] = [
  {
    title: 'Find your books in your dashboard',
    description: 'Open your Backer Dashboard at /dashboard/backer. Two tabs hold your Marketplace books. The Downloads tab (/dashboard/backer?tab=downloads) shows everything you own — Marketplace books at the top as cover tiles, plus any files from crowdfunding campaigns below. The Digital Library tab (/dashboard/backer?tab=digital-library) is where you actually read books in your browser.',
    tip: 'Easy way to remember: Downloads = "see all my files." Digital Library = "open and read a book."',
  },
  {
    title: 'See your whole collection',
    description: 'In the Downloads tab, every Marketplace book you have ever bought shows up as a cover tile. Newest at the top. You can see your whole digital bookshelf at a glance.',
    example: 'Bought 5 books in the last month? All 5 show up here in order, newest first.',
  },
  {
    title: 'See what\'s new and what you\'ve read',
    description: 'Each book has little labels. "New" means you bought it but haven\'t opened it yet. "Downloaded" means you saved a copy to your device. The labels help you keep track of what is waiting on your reading list.',
    tip: 'Treat the "New" labels like a reminder — they are a list of books you have already paid for and might want to read next.',
  },
  {
    title: 'Read or download with one click',
    description: 'Each book has buttons. "Read" opens it in your browser. "Download" saves the PDF to your computer or phone. "View Details" shows when you bought it and who made it.',
    example: 'On the bus? Tap Read. At home with WiFi? Tap Download to save it for offline reading later.',
  },
  {
    title: 'Look up a past purchase',
    description: 'Click a book and you can see when you bought it, what you paid, and the order number. Useful if you ever need to check an old purchase.',
    tip: 'Even books you bought a year ago are still in your library. Nothing expires.',
  },
  {
    title: 'Use it on any device',
    description: 'Sign in on your phone, your tablet, your laptop — your library is the same everywhere. The books follow you.',
    example: 'Buy on your laptop, start reading on your phone at lunch, finish on your tablet at home.',
  },
];

const readingSteps: Step[] = [
  {
    title: 'Read in your browser',
    description: 'Click "Read" on any book in your library and it opens in our built-in reader. The reader has zoom, page-turning, bookmarks, and full-screen mode. It works on any phone, tablet, or computer with a modern browser. No app to download.',
    tip: 'The browser reader saves your place automatically, so you can pick up where you left off later.',
  },
  {
    title: 'Download for offline reading',
    description: 'Click "Download" on any book to save the PDF to your device. Once saved, you can open it without internet — on a plane, in the woods, anywhere.',
    example: 'Going on a long flight? Download a few books before you go.',
  },
  {
    title: 'Apps that open PDF files',
    description: 'Free PDF apps that work great: Adobe Acrobat Reader, Apple Books (Mac/iPhone/iPad), or any PDF reader on Android. Most phones already have one built in.',
    tip: 'A tablet (iPad or Android) with Apple Books or a good PDF reader gives you the closest thing to a real book experience.',
  },
  {
    title: 'Zoom and turn pages',
    description: 'Pinch to zoom on a touch screen. Use the zoom buttons on a desktop. Turn pages with arrow keys, by clicking the edges of the page, or by dragging the page slider. Type a page number to jump straight to it.',
    example: 'Reading a comic? Zoom in to read individual panels. Reading an art book? Zoom in to look at the brush strokes.',
  },
  {
    title: 'Reading on any size screen',
    description: 'On a phone the reader shows one page at a time. On a tablet or laptop you can see two pages side by side, like an open book.',
    tip: 'Turn your phone sideways for wider pages. Hold a tablet upright (portrait) for tall pages.',
  },
  {
    title: 'Bookmark your spot',
    description: 'In the browser reader, your reading position saves automatically. In a downloaded PDF, use bookmarks in your PDF app to mark important pages or where you stopped reading.',
    example: 'Reading a 200-page graphic novel over a few nights? Bookmark each stopping point so you don\'t lose your place.',
  },
];

const supportSteps: Step[] = [
  {
    title: 'Buying directly helps the creator',
    description: 'Most online stores keep a big chunk of every sale. Indie creators on this Marketplace keep most of theirs. When you buy a book here, the creator actually gets paid.',
    tip: 'Buying from this Marketplace is one of the most direct ways to help an indie creator.',
  },
  {
    title: 'Leave a review',
    description: 'After you read a book, give it a star rating and write a few sentences about what you liked. Other readers use reviews to decide what to buy, and creators use them to know what works.',
    example: '"Loved the artwork and storytelling. The dragon designs were amazing. 5 stars."',
  },
  {
    title: 'Follow the creator',
    description: 'Click the "Follow" button on a creator\'s profile. You will get an email when they release something new — Marketplace book or crowdfunding campaign.',
    tip: 'Following is free. It just means you hear about new stuff first.',
  },
  {
    title: 'Tell your friends',
    description: 'If you love a book, share it. Use the share buttons on the book page to post on social, or copy the link and send it directly. A recommendation from a friend is the best advertising an indie creator can get.',
    example: '"Just finished @CreatorName\'s new comic on @IndieCrowdfund — incredible art, check it out: [link]"',
  },
  {
    title: 'Back their next campaign',
    description: 'Many Marketplace creators also run crowdfunding campaigns. If you loved their book, look at their profile to see if they have a campaign running, and back it.',
    tip: 'Backing campaigns gets you stuff you can\'t buy in the Marketplace — early-bird tiers, signed copies, exclusive add-ons.',
  },
  {
    title: 'Get a physical copy',
    description: 'Want a printed book to hold? Look for the "Order Physical Copy" button on the book page (right above the share buttons). It opens the creator\'s store where you can buy a printed version.',
    example: 'Click "Order Physical Copy" on Dragon\'s Legacy Vol. 1 → opens the creator\'s shop where you can buy the print edition.',
  },
];

const faqs: FAQ[] = [
  {
    question: 'Can I get my money back if I change my mind?',
    answer: 'Digital files cannot really be returned once you have downloaded them, so refunds are looked at one by one. If you bought the same book twice by accident, or if a file is broken and you cannot open it, contact support within 48 hours and we will help.',
  },
  {
    question: 'Will my books expire?',
    answer: 'No. Once you buy a book, it is yours forever. Your library never expires. Downloaded PDFs are files on your device — they stay there as long as you keep them.',
  },
  {
    question: 'Can I share a book with a friend?',
    answer: 'Each purchase is for one person. If you want to share with a friend, the best way is to tell them about it so they can buy their own copy and help support the creator.',
  },
  {
    question: 'What kind of file is a book?',
    answer: 'All Marketplace books are PDF files. PDFs work on almost every device — phone, tablet, laptop, e-reader — with the original layout, fonts, and pictures.',
  },
  {
    question: 'Can I read on a Kindle?',
    answer: 'You can copy a PDF to most Kindles and read it. PDFs work best on Kindles for text-only books. For comics or art books with lots of color, a tablet or computer is much better.',
  },
  {
    question: 'I cannot download a book. What do I do?',
    answer: 'First try refreshing the Downloads tab and clicking download again. If that does not work, check that you are signed in to the right account and that your internet is working. Still stuck? Email support with your order number.',
  },
  {
    question: 'Are Marketplace books the same as crowdfunding rewards?',
    answer: 'No, they are separate. Marketplace books appear in your Downloads tab as Marketplace Books at the top. Crowdfunding rewards (digital files from a campaign you backed) appear below in the same tab. Same place, two sources.',
  },
  {
    question: 'How is my card processed?',
    answer: 'The Marketplace processes card payments through DivinityCoin, PayPal, or Whop, depending on which one the creator selected. You enter your card on the checkout page, it is encrypted in your browser, and the processor charges it right away. IndieCrowdfund servers never see your full card number. The checkout experience looks slightly different for each processor, but the result is the same — book in your library, receipt in your inbox.',
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
      <div className="bg-gradient-to-r from-primary to-primary/80 py-12 text-center text-primary-foreground relative overflow-hidden">
        <div className="relative z-10 px-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <ShoppingCart className="h-10 w-10" />
            <BookOpen className="h-10 w-10" />
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold">Digital Marketplace Handbook</h1>
          <p className="mt-2 text-primary-foreground/80 text-lg">
            For Backers & Readers
          </p>
          <p className="mt-4 max-w-2xl mx-auto text-primary-foreground/70">
            Your complete guide to discovering, purchasing, and enjoying digital content from indie creators
          </p>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/backer-handbook" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Backer Handbook
        </Link>
      </div>

      {/* Content with Sidebar */}
      <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Vertical Sidebar Navigation */}
          <div className="lg:w-64 flex-shrink-0">
            <div className="lg:sticky lg:top-4">
              <nav className="flex flex-col gap-1 rounded-xl bg-card/80 backdrop-blur-sm p-3 shadow-sm border border-border">
                <h3 className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sections</h3>
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      id={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
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
                          All payments are processed securely through DivinityCoin, PayPal, or Whop. As soon as you pay, your book lands in your Downloads tab — no waiting.
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
                          Every book you buy lands in your Downloads tab right away. Your library never expires. Read on any device, any time.
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
                  href="/dashboard/backer?tab=downloads"
                  className="inline-flex items-center gap-2 rounded-lg border-2 border-primary-foreground px-6 py-3 font-medium text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
                >
                  <Library className="h-5 w-5" />
                  My Downloads
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
        </div>
      </div>

      <Footer />
    </div>
  );
}
