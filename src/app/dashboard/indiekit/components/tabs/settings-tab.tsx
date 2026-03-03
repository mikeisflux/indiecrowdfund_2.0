"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Settings,
  FileText,
  Truck,
  CreditCard,
  Bell,
  Plug,
  Users,
  Key,
} from "lucide-react";
import {
  GeneralSection,
  SurveySection,
  ShippingSection,
  PaymentsSection,
  NotificationsSection,
  IntegrationsSection,
  ShopifyCredentialsSection,
  ShippingProvidersSection,
  TeamSection,
} from "./settings-sections";

type SettingsSection = "general" | "survey" | "shipping" | "payments" | "notifications" | "integrations" | "shopify" | "shipstation" | "shippo" | "easypost" | "stamps" | "team";

interface SettingsTabProps {
  projectName?: string;
  currency?: string;
  timezone?: string;
  projectId?: string;
  onRefresh?: () => void;
}

const settingsNav = [
  { id: "general", label: "General", icon: Settings },
  { id: "survey", label: "Survey", icon: FileText },
  { id: "shipping", label: "Shipping", icon: Truck },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "shopify", label: "Shopify API Key", icon: Key },
  { id: "shipstation", label: "ShipStation API", icon: Key },
  { id: "shippo", label: "Shippo API", icon: Key },
  { id: "easypost", label: "EasyPost API", icon: Key },
  { id: "stamps", label: "Stamps.com API", icon: Key },
  { id: "team", label: "Team", icon: Users },
] as const;

export function SettingsTab({
  projectName,
  currency,
  timezone,
  projectId,
  onRefresh,
}: SettingsTabProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("general");

  // Shopify status is shared between IntegrationsSection and ShopifyCredentialsSection
  const [shopifyStatus, setShopifyStatus] = useState<{
    connected: boolean;
    loading: boolean;
    shopName: string | null;
  }>({ connected: false, loading: true, shopName: null });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-teal-600" />
          <div>
            <h3 className="text-lg font-semibold">Project Settings</h3>
            <p className="text-sm text-muted-foreground">
              Configure your project settings and preferences
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Settings Navigation */}
        <Card>
          <CardContent className="p-2">
            <nav className="space-y-1">
              {settingsNav.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <Button
                    key={item.id}
                    variant={isActive ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setActiveSection(item.id as SettingsSection)}
                  >
                    <Icon className={`h-4 w-4 mr-2 ${isActive ? "text-teal-600" : ""}`} />
                    {item.label}
                  </Button>
                );
              })}
            </nav>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="space-y-6">
          {activeSection === "general" && (
            <GeneralSection
              projectId={projectId}
              projectName={projectName}
              currency={currency}
              timezone={timezone}
              onRefresh={onRefresh}
            />
          )}

          {activeSection === "survey" && (
            <SurveySection projectId={projectId} />
          )}

          {activeSection === "shipping" && (
            <ShippingSection projectId={projectId} />
          )}

          {activeSection === "payments" && (
            <PaymentsSection projectId={projectId} />
          )}

          {activeSection === "notifications" && (
            <NotificationsSection projectId={projectId} />
          )}

          {activeSection === "integrations" && (
            <IntegrationsSection
              projectId={projectId}
              onRefresh={onRefresh}
              shopifyStatus={shopifyStatus}
              setShopifyStatus={setShopifyStatus}
            />
          )}

          {activeSection === "shopify" && (
            <ShopifyCredentialsSection
              shopifyStatus={shopifyStatus}
              setShopifyStatus={setShopifyStatus}
            />
          )}

          <ShippingProvidersSection activeSection={activeSection} />

          {activeSection === "team" && <TeamSection />}
        </div>
      </div>
    </div>
  );
}
