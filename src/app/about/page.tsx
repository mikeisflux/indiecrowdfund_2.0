import { Rocket, DollarSign, Users, Globe } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold text-center mb-8">About Us</h1>

      {/* Statistics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 mb-3">
            <Rocket className="h-6 w-6 text-indigo-600" aria-hidden="true" />
          </div>
          <p className="text-3xl font-bold text-zinc-900">10,000+</p>
          <p className="text-zinc-500">Projects Funded</p>
        </div>

        <div className="text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 mb-3">
            <DollarSign className="h-6 w-6 text-indigo-600" aria-hidden="true" />
          </div>
          <p className="text-3xl font-bold text-zinc-900">$50M+</p>
          <p className="text-zinc-500">Total Raised</p>
        </div>

        <div className="text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 mb-3">
            <Users className="h-6 w-6 text-indigo-600" aria-hidden="true" />
          </div>
          <p className="text-3xl font-bold text-zinc-900">500K+</p>
          <p className="text-zinc-500">Happy Backers</p>
        </div>

        <div className="text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 mb-3">
            <Globe className="h-6 w-6 text-indigo-600" aria-hidden="true" />
          </div>
          <p className="text-3xl font-bold text-zinc-900">180+</p>
          <p className="text-zinc-500">Countries</p>
        </div>
      </div>
    </div>
  );
}
