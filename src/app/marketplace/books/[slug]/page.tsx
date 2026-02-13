"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getCSRFHeaders } from "@/lib/csrf";
import { sanitizeHtml } from "@/lib/utils/sanitize";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BookOpen,
  Star,
  Sparkles,
  ShoppingCart,
  CheckCircle,
  Play,
  Building2,
  User,
  Eye,
  Download,
  ArrowLeft,
  Share2,
  Loader2,
  Coins,
  CreditCard,
  Library,
  Ticket,
  X,
  Gift,
  ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Book {
  id: string;
  title: string;
  slug: string;
  description: string;
  shortDescription: string | null;
  coverImage: string | null;
  videoUrl: string | null;
  galleryImages: string[] | null;
  price: number;
  currency: string;
  category: string | null;
  tags: string[];
  stats: { purchases: number; views: number };
  isFeatured: boolean;
  isStaffPick: boolean;
  publishedAt: string | null;
  hasAdultContent: boolean;
  hasRiskyContent: boolean;
  paymentProcessor: "STRIPE" | "DIVINITYCOIN";
  creator: {
    id: string;
    name: string | null;
    avatar: string | null;
    bio: string | null;
  };
  company: {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
    banner: string | null;
    tagline: string | null;
    physicalMediaUrl: string | null;
  } | null;
}

export default function BookDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const router = useRouter();
  const [book, setBook] = useState<Book | null>(null);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [validatingCode, setValidatingCode] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discountAmount: number;
    finalPrice: number;
    creatorName: string;
  } | null>(null);

  useEffect(() => {
    fetchBook();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const fetchBook = async () => {
    try {
      const res = await fetch(`/api/marketplace/books/${slug}`);
      if (!res.ok) {
        if (res.status === 404) {
          router.push("/marketplace");
          return;
        }
        throw new Error("Failed to fetch book");
      }
      const data = await res.json();
      setBook(data.book);
      setHasPurchased(data.hasPurchased);
    } catch (error) {
      console.error("Error fetching book:", error);
      toast.error("Failed to load book");
    } finally {
      setLoading(false);
    }
  };

  const validatePromoCode = async () => {
    if (!promoCode.trim() || !book) return;

    setValidatingCode(true);
    try {
      const res = await fetch("/api/marketplace/validate-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCSRFHeaders(),
        },
        body: JSON.stringify({
          code: promoCode.trim(),
          bookId: book.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Invalid promo code");
        setAppliedPromo(null);
        return;
      }

      setAppliedPromo({
        code: data.code,
        discountAmount: data.discountAmount,
        finalPrice: data.finalPrice,
        creatorName: data.creatorName,
      });
      toast.success(`Promo code applied! You save $${data.discountAmount.toFixed(2)}`);
    } catch (error) {
      console.error("Error validating promo code:", error);
      toast.error("Failed to validate promo code");
      setAppliedPromo(null);
    } finally {
      setValidatingCode(false);
    }
  };

  const clearPromoCode = () => {
    setPromoCode("");
    setAppliedPromo(null);
  };

  const handlePurchase = async (paymentMethod: "stripe" | "divinitycoin") => {
    if (!book) return;

    setPurchasing(true);
    setShowPaymentModal(false);

    try {
      // If there's a free promo code applied, use a special endpoint
      if (appliedPromo && appliedPromo.finalPrice === 0) {
        const res = await fetch("/api/marketplace/redeem-code", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getCSRFHeaders(),
          },
          body: JSON.stringify({
            bookId: book.id,
            code: appliedPromo.code,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to redeem promo code");
        }

        if (data.success) {
          setHasPurchased(true);
          setShowSuccessModal(true);
          clearPromoCode();
        }
        return;
      }

      if (paymentMethod === "stripe") {
        // Use Stripe Checkout
        const res = await fetch("/api/marketplace/checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getCSRFHeaders(),
          },
          body: JSON.stringify({
            bookId: book.id,
            promoCode: appliedPromo?.code,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to create checkout session");
        }

        if (data.checkoutUrl) {
          toast.info("Redirecting to payment...");
          window.location.href = data.checkoutUrl;
          return;
        }
      } else {
        // DivinityCoin payment
        const res = await fetch("/api/marketplace/purchase", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getCSRFHeaders(),
          },
          body: JSON.stringify({
            bookId: book.id,
            paymentMethod,
            promoCode: appliedPromo?.code,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Purchase failed");
        }

        if (data.success) {
          setHasPurchased(true);
          setShowSuccessModal(true);
          clearPromoCode();
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Purchase failed");
    } finally {
      setPurchasing(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: book?.title,
          text: book?.shortDescription || "",
          url,
        });
      } catch {
        // User cancelled or error
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard!");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container py-8">
          <Skeleton className="h-8 w-32 mb-8" />
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="aspect-video rounded-2xl" />
              <Skeleton className="h-64 rounded-xl" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-48 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!book) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <div className="container relative py-8">
        {/* Back Button */}
        <Link href="/marketplace" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Marketplace
        </Link>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Cover Image / Video */}
            {book.videoUrl ? (
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-gradient-to-br from-purple-900/50 to-indigo-900/50 border border-border">
                <div className="relative w-full h-full">
                  <video
                    src={book.videoUrl}
                    poster={book.coverImage && typeof book.coverImage === 'string' ? book.coverImage : undefined}
                    controls
                    className="w-full h-full object-cover"
                  />
                  {!book.coverImage && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <Play className="w-16 h-16 text-white/80" />
                    </div>
                  )}
                </div>
                {/* Badges */}
                <div className="absolute top-4 left-4 flex gap-2">
                  {book.isFeatured && (
                    <Badge className="bg-amber-500/90 text-white border-0 backdrop-blur-sm">
                      <Star className="w-3 h-3 mr-1 fill-current" />
                      Featured
                    </Badge>
                  )}
                  {book.isStaffPick && (
                    <Badge className="bg-purple-500/90 text-white border-0 backdrop-blur-sm">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Staff Pick
                    </Badge>
                  )}
                  {book.hasAdultContent && (
                    <Badge className="bg-red-500/90 text-white border-0 backdrop-blur-sm">
                      18+
                    </Badge>
                  )}
                </div>
              </div>
            ) : (
              <div className="relative aspect-[2/3] max-w-md rounded-2xl overflow-hidden bg-gradient-to-br from-purple-900/50 to-indigo-900/50 border border-border">
                {book.coverImage && typeof book.coverImage === 'string' ? (
                  <Image
                    src={book.coverImage}
                    alt={book.title}
                    fill
                    className="object-cover"
                    priority
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <BookOpen className="w-24 h-24 text-muted-foreground/50" />
                  </div>
                )}
                {/* Badges */}
                <div className="absolute top-4 left-4 flex gap-2">
                  {book.isFeatured && (
                    <Badge className="bg-amber-500/90 text-white border-0 backdrop-blur-sm">
                      <Star className="w-3 h-3 mr-1 fill-current" />
                      Featured
                    </Badge>
                  )}
                  {book.isStaffPick && (
                    <Badge className="bg-purple-500/90 text-white border-0 backdrop-blur-sm">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Staff Pick
                    </Badge>
                  )}
                  {book.hasAdultContent && (
                    <Badge className="bg-red-500/90 text-white border-0 backdrop-blur-sm">
                      18+
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Gallery */}
            {book.galleryImages && book.galleryImages.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {(book.galleryImages as string[]).slice(0, 4).map((img, i) => (
                  <div key={i} className="relative aspect-video rounded-lg overflow-hidden border border-border">
                    <Image src={img} alt={`Gallery ${i + 1}`} fill className="object-cover" />
                  </div>
                ))}
              </div>
            )}

            {/* Description */}
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">About this book</h2>
                <div
                  className="prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(book.description || "") }}
                />
              </CardContent>
            </Card>

            {/* Creator/Company Info */}
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">
                  About the {book.company ? "Publisher" : "Creator"}
                </h2>
                {book.company ? (
                  <Link href={`/marketplace/companies/${book.company.slug}`}>
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-muted hover:bg-muted/80 transition-colors">
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted-foreground/10 flex items-center justify-center">
                        {book.company.logo ? (
                          <Image
                            src={book.company.logo}
                            alt={book.company.name}
                            width={64}
                            height={64}
                            className="object-cover"
                          />
                        ) : (
                          <Building2 className="w-8 h-8 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{book.company.name}</h3>
                        {book.company.tagline && (
                          <p className="text-muted-foreground text-sm">{book.company.tagline}</p>
                        )}
                      </div>
                    </div>
                  </Link>
                ) : (
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-muted">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-muted-foreground/10 flex items-center justify-center">
                      {book.creator.avatar ? (
                        <Image
                          src={book.creator.avatar}
                          alt={book.creator.name || "Creator"}
                          width={64}
                          height={64}
                          className="object-cover"
                        />
                      ) : (
                        <User className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{book.creator.name}</h3>
                      {book.creator.bio && (
                        <p className="text-muted-foreground text-sm line-clamp-2">{book.creator.bio}</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Purchase Card */}
            <Card className="bg-card backdrop-blur-md border-border sticky top-24">
              <CardContent className="p-6 space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-foreground mb-2">{book.title}</h1>
                  {book.category && (
                    <Badge variant="outline" className="text-muted-foreground border-border">
                      {book.category}
                    </Badge>
                  )}
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-emerald-500 dark:text-emerald-400">
                    ${(book.price ?? 0).toFixed(2)}
                  </span>
                  <span className="text-muted-foreground">{book.currency}</span>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Download className="w-4 h-4" />
                    {book.stats?.purchases ?? 0} purchases
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    {book.stats?.views ?? 0} views
                  </span>
                </div>

                {/* Payment Processor Notice */}
                {book.paymentProcessor === "DIVINITYCOIN" && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700">
                    <Coins className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                      DivinityCoin payment only
                    </span>
                  </div>
                )}
                {/* Purchase Button */}
                {hasPurchased ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                      <span className="text-sm text-emerald-300">You own this book</span>
                    </div>
                    <Link href="/dashboard/backer?tab=digital-library">
                      <Button className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                        <Library className="w-4 h-4 mr-2" />
                        Read in Digital Library
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <Button
                    className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 h-12 text-lg"
                    onClick={() => setShowPaymentModal(true)}
                    disabled={purchasing}
                  >
                    {purchasing ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="w-5 h-5 mr-2" />
                        Buy Now
                      </>
                    )}
                  </Button>
                )}

                {/* Order Physical Copy Button */}
                {book.company?.physicalMediaUrl && (
                  <a
                    href={book.company.physicalMediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full"
                  >
                    <Button
                      variant="outline"
                      className="w-full border-amber-500/50 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Order Physical Copy
                    </Button>
                  </a>
                )}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleShare}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>

                {/* Tags */}
                {book.tags && book.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {book.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="text-muted-foreground text-xs"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Payment Method Modal */}
      <Dialog open={showPaymentModal} onOpenChange={(open) => {
        setShowPaymentModal(open);
        if (!open) {
          // Don't clear promo code when closing
        }
      }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>
              {appliedPromo && appliedPromo.finalPrice === 0 ? "Get Your Free Book" : "Choose Payment Method"}
            </DialogTitle>
            <DialogDescription>
              {appliedPromo && appliedPromo.finalPrice === 0
                ? `Redeem your promo code to get "${book?.title}" for free!`
                : `Select how you'd like to pay for "${book?.title}"`
              }
            </DialogDescription>
          </DialogHeader>

          {/* Price Summary */}
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-muted-foreground">Original Price</span>
              <span className={appliedPromo ? "line-through text-muted-foreground" : "font-semibold text-foreground"}>
                ${(book?.price ?? 0).toFixed(2)}
              </span>
            </div>
            {appliedPromo && (
              <>
                <div className="flex items-center justify-between mb-2 text-emerald-500">
                  <span className="flex items-center gap-2">
                    <Gift className="w-4 h-4" />
                    Promo Discount
                  </span>
                  <span>-${appliedPromo.discountAmount.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="font-semibold text-foreground">You Pay</span>
                  <span className="text-xl font-bold text-emerald-500">
                    {appliedPromo.finalPrice === 0 ? "FREE" : `$${appliedPromo.finalPrice.toFixed(2)}`}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Promo Code Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Ticket className="w-4 h-4" />
              Have a promo code?
            </label>
            {appliedPromo ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                <div className="flex-1">
                  <code className="font-mono font-bold">{appliedPromo.code}</code>
                  <p className="text-xs text-muted-foreground">from {appliedPromo.creatorName}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={clearPromoCode}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Enter promo code"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  className="font-mono"
                  onKeyDown={(e) => e.key === "Enter" && validatePromoCode()}
                />
                <Button
                  variant="outline"
                  onClick={validatePromoCode}
                  disabled={validatingCode || !promoCode.trim()}
                >
                  {validatingCode ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Apply"
                  )}
                </Button>
              </div>
            )}
          </div>

          <div className="grid gap-4 py-2">
            {/* If free with promo code, show single button */}
            {appliedPromo && appliedPromo.finalPrice === 0 ? (
              <Button
                className="h-16 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600"
                onClick={() => handlePurchase("stripe")}
                disabled={purchasing}
              >
                {purchasing ? (
                  <Loader2 className="w-6 h-6 mr-4 animate-spin" />
                ) : (
                  <Gift className="w-6 h-6 mr-4" />
                )}
                <div className="text-left">
                  <div className="font-semibold">Get Free Book</div>
                  <div className="text-sm opacity-80">Redeem your promo code</div>
                </div>
              </Button>
            ) : (
              <>
                {book?.paymentProcessor !== "DIVINITYCOIN" && (
                  <Button
                    variant="outline"
                    className="h-16 justify-start"
                    onClick={() => handlePurchase("stripe")}
                    disabled={purchasing}
                  >
                    <CreditCard className="w-6 h-6 mr-4" />
                    <div className="text-left">
                      <div className="font-semibold">Credit/Debit Card</div>
                      <div className="text-sm text-muted-foreground">Pay with Stripe</div>
                    </div>
                  </Button>
                )}
                <Button
                  className="h-16 bg-[#0066FF] hover:bg-[#0052CC] justify-start"
                  onClick={() => handlePurchase("divinitycoin")}
                  disabled={purchasing}
                >
                  <Coins className="w-6 h-6 mr-4" />
                  <div className="text-left">
                    <div className="font-semibold">DivinityCoin</div>
                    <div className="text-sm opacity-80">
                      Pay from your wallet balance
                    </div>
                  </div>
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="bg-card border-border text-center">
          <div className="py-6">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-emerald-500 dark:text-emerald-400" />
            </div>
            <DialogTitle className="text-2xl mb-2">Purchase Successful!</DialogTitle>
            <DialogDescription className="text-base">
              &quot;{book?.title}&quot; has been delivered to your Digital Library.
            </DialogDescription>
          </div>
          <div className="grid gap-3">
            <Link href="/dashboard/backer?tab=digital-library">
              <Button className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                <Library className="w-4 h-4 mr-2" />
                Go Read It Now
              </Button>
            </Link>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowSuccessModal(false)}
            >
              Continue Browsing
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
