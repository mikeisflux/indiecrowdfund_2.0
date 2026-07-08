import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  ArrowLeft,
  CheckCircle,
  Globe,
  Smartphone,
} from "lucide-react";
import { Footer } from "@/components/footer";

const emailClients = [
  {
    name: "Gmail",
    color: "from-red-500 to-red-600",
    steps: [
      "Open an email from us",
      "Click on the three dots (More) in the top right of the email",
      "Select \"Add [sender] to Contacts list\"",
      "Or drag the email from Spam/Promotions to your Primary inbox",
    ],
    extraTip: "You can also create a filter: Settings → Filters → Create filter → \"Never send to spam\"",
  },
  {
    name: "Outlook / Hotmail",
    color: "from-blue-500 to-blue-600",
    steps: [
      "Open an email from us",
      "Right-click on the sender's email address",
      "Select \"Add to Outlook Contacts\" or \"Add to Safe Senders\"",
      "Click \"Save\"",
    ],
    extraTip: "Settings → View all Outlook settings → Mail → Junk email → Add to Safe senders",
  },
  {
    name: "Yahoo Mail",
    color: "from-purple-500 to-purple-600",
    steps: [
      "Open an email from us",
      "Click on the sender's name or email address",
      "Click \"Add to Contacts\"",
      "Save the contact",
    ],
    extraTip: "You can also mark our emails as \"Not Spam\" if they end up in your Spam folder",
  },
  {
    name: "Apple Mail (macOS/iOS)",
    color: "from-sky-500 to-sky-600",
    steps: [
      "Open an email from us",
      "Tap or click on the sender's name at the top",
      "Tap \"Add to Contacts\" or \"Add to VIPs\"",
      "Adding to VIPs ensures our emails appear in your VIP mailbox",
    ],
    extraTip: "On iOS: Tap the sender → Tap \"Create New Contact\" or \"Add to Existing Contact\"",
  },
  {
    name: "ProtonMail",
    color: "from-violet-500 to-violet-600",
    steps: [
      "Open an email from us",
      "Click on the sender's email address",
      "Click \"Create new contact\" or add to existing contact",
      "Our emails will now bypass spam filters",
    ],
    extraTip: "ProtonMail trusts contacts by default, so adding us ensures delivery",
  },
  {
    name: "Other Email Clients",
    color: "from-gray-500 to-gray-600",
    steps: [
      "Look for an \"Add to Contacts\" or \"Add to Address Book\" option",
      "Check your spam/junk folder settings for a \"Safe Senders\" list",
      "Mark our emails as \"Not Spam\" if they end up in junk",
      "Create a filter to always deliver our emails to inbox",
    ],
    extraTip: "Most email clients have similar options in their settings or when right-clicking on a sender",
  },
];

export default function WhitelistPage() {
  const senderEmail = process.env.NEXT_PUBLIC_EMAIL_FROM || "noreply@indiecrowdfund.com";

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      {/* Back Link */}
      <div className="container mx-auto px-4 pt-6">
        <Link
          href="/help"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Help Center
        </Link>
      </div>

      {/* Floating orbs background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb absolute -top-40 -right-40 w-[600px] h-[600px] bg-green-500/15" />
        <div className="floating-orb absolute top-1/3 -left-40 w-[500px] h-[500px] bg-emerald-500/10" style={{ animationDelay: '-8s' }} />
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/90 via-green-600/90 to-teal-700/90" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Badge className="mb-4 bg-white/20 text-white hover:bg-white/30 border-0">
              <Mail className="mr-1 h-3 w-3" />
              Email Deliverability
            </Badge>
            <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white">
              How to Whitelist Our Emails
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-xl text-green-100">
              Add us to your contacts to ensure you never miss important updates about your pledges, campaigns, and rewards.
            </p>

            {/* Sender Email Display */}
            <div
              className="mx-auto mt-10 max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700"
              style={{ animationDelay: '200ms' }}
            >
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <p className="text-green-100 text-sm mb-2">Add this email to your contacts:</p>
                <code className="text-xl font-mono font-bold text-white bg-white/20 px-4 py-2 rounded-lg inline-block">
                  {senderEmail}
                </code>
              </div>
            </div>
          </div>
        </div>

        {/* Wave decoration */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" className="fill-background"/>
          </svg>
        </div>
      </section>

      {/* Why Whitelist Section */}
      <section className="relative py-12 border-b">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold">Why Whitelist?</h2>
            <p className="mt-2 text-muted-foreground">
              Email providers sometimes filter legitimate emails. Whitelisting ensures you receive:
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-8 text-center">
            {[
              { icon: CheckCircle, label: "Pledge confirmations & receipts" },
              { icon: Globe, label: "Project updates from creators" },
              { icon: Smartphone, label: "Reward & shipping notifications" },
            ].map((item, index) => (
              <div
                key={item.label}
                className="glass-card rounded-2xl p-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-center justify-center gap-2 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <p className="mt-2 text-sm font-medium">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Email Client Instructions */}
      <section className="relative py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Instructions by Email Provider
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Select your email provider below to see specific instructions
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {emailClients.map((client, index) => (
              <Card
                key={client.name}
                className="glass-card border shadow-lg hover:shadow-xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
              >
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${client.color} shadow-lg`}>
                      <Mail className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{client.name}</CardTitle>
                      <CardDescription>Whitelisting instructions</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-2 list-decimal list-inside">
                    {client.steps.map((step, stepIndex) => (
                      <li key={stepIndex} className="text-sm text-muted-foreground">
                        {step}
                      </li>
                    ))}
                  </ol>
                  {client.extraTip && (
                    <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        <strong>Tip:</strong> {client.extraTip}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Still Having Issues */}
      <section className="relative py-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />

        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            Still Not Receiving Emails?
          </h2>
          <p className="mt-4 text-xl text-green-100 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '100ms' }}>
            If you&apos;ve whitelisted us but still aren&apos;t receiving emails, please contact our support team.
          </p>
          <div
            className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center animate-in fade-in slide-in-from-bottom-4 duration-500"
            style={{ animationDelay: '200ms' }}
          >
            <Link href="/contact">
              <Button size="lg" className="bg-white text-emerald-600 hover:bg-emerald-50 shadow-xl">
                Contact Support
                <Mail className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/help">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                Back to Help Center
                <ArrowLeft className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
