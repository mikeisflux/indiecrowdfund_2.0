import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="container flex h-14 items-center">
        <Link href="/" className="flex items-center space-x-2">
          <span className="text-xl font-bold text-primary">IndieCrowdfund</span>
        </Link>
      </header>
      <main>{children}</main>
    </div>
  );
}
