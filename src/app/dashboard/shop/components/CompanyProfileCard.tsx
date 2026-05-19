"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Building2, Edit } from "lucide-react";
import { CompanyProfile } from "./types";

export function CompanyProfileCard({ company }: { company: CompanyProfile }) {
  return (
    <Card className="bg-card border-border mb-8 overflow-hidden">
      {/* Banner */}
      <div className="relative h-32">
        {company.banner ? (
          <Image
            src={company.banner}
            alt={company.name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/50" />
        )}
        <div className="absolute inset-0 bg-black/10 dark:bg-black/30" />
      </div>

      {/* Logo & Info */}
      <div className="relative px-6 pb-6">
        <div className="absolute -top-10 left-6">
          <div className="w-20 h-20 rounded-xl bg-card backdrop-blur-md border border-border overflow-hidden flex items-center justify-center">
            {company.logo ? (
              <Image
                src={company.logo}
                alt={company.name}
                width={80}
                height={80}
                className="object-cover"
              />
            ) : (
              <Building2 className="h-10 w-10 text-muted-foreground/50" />
            )}
          </div>
        </div>

        <div className="pt-14">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-foreground">{company.name}</h2>
                {company.isVerified && (
                  <Badge className="bg-primary/20 text-primary border-primary/30">
                    Verified
                  </Badge>
                )}
              </div>
              {company.tagline && (
                <p className="text-muted-foreground mt-1">{company.tagline}</p>
              )}
            </div>
            <Link href="/dashboard/marketplace/company">
              <Button variant="outline" size="sm">
                <Edit className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
            </Link>
          </div>

          {/* Company Stats */}
          {company.stats && (
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="p-4 rounded-xl bg-muted">
                <p className="text-2xl font-bold text-foreground">{company.stats.books ?? 0}</p>
                <p className="text-sm text-muted-foreground">Published Books</p>
              </div>
              <div className="p-4 rounded-xl bg-muted">
                <p className="text-2xl font-bold text-foreground">{company.stats.totalSales ?? 0}</p>
                <p className="text-sm text-muted-foreground">Total Sales</p>
              </div>
              <div className="p-4 rounded-xl bg-muted">
                <p className="text-2xl font-bold text-emerald-500 dark:text-emerald-400">${(company.stats.totalRevenue ?? 0).toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
