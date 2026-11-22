"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, ClipboardPen, Loader2, Package, MapPin, Save, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch, fetchWithRetry } from "@/lib/fetch-utils";
import { ALL_COUNTRIES } from "@/types";
import { QuestionInput } from "@/app/dashboard/pledges/[pledgeId]/survey/components/QuestionInput";
import { unitKey, unitLabel, type ItemResponses } from "@/lib/surveys/item-units";

interface Data {
  survey: { id: string; collectAddresses: boolean; status: string } | null;
  pledge: {
    id: string;
    rewardTitle: string;
    backerName?: string;
    backerEmail?: string;
    addons: { id: string; title: string; quantity?: number }[];
    pledgeShippingAddress?: Address | null;
  };
  questions: {
    itemQuestions: {
      id: string;
      itemName: string;
      itemDescription?: string;
      variants: { id: string; variantType: string; options: string[] }[];
      customQuestions: { id: string; question: string; description?: string; questionType: string; options: string[]; isRequired?: boolean }[];
    }[];
    backerQuestions: { id: string; question: string; description?: string; questionType: string; displayType?: string | null; options: string[]; isRequired?: boolean }[];
  };
  relevantItemQuestions?: { id: string; quantity: number; imageUrl: string | null }[];
  response: {
    itemResponses?: ItemResponses;
    backerResponses?: Record<string, string | string[]>;
    shippingAddress?: Address | null;
    isComplete: boolean;
    completedBy?: string | null;
  } | null;
}

interface Address {
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
}

const EMPTY_ADDRESS: Required<Address> = { name: "", line1: "", line2: "", city: "", state: "", postalCode: "", country: "US", phone: "" };

// Fill in a backer's survey for them. Same questions the backer would see
// (one card per unit for add-ons bought in quantity, with the item image),
// saved as the backer's response and marked as entered by the creator.
export default function FillSurveyForBackerPage() {
  const params = useParams();
  const router = useRouter();
  const pledgeId = params?.pledgeId as string;

  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [itemResponses, setItemResponses] = useState<ItemResponses>({});
  const [backerResponses, setBackerResponses] = useState<Record<string, string | string[]>>({});
  const [address, setAddress] = useState<Required<Address>>(EMPTY_ADDRESS);
  const [includeAddress, setIncludeAddress] = useState(true);
  const [notifyBacker, setNotifyBacker] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithRetry(`/api/creator/indiekit/surveys/${pledgeId}`);
      if (!res.ok) throw new Error("Could not load this backer's survey");
      const d: Data = await res.json();
      setData(d);
      setItemResponses(d.response?.itemResponses || {});
      setBackerResponses(d.response?.backerResponses || {});
      const addr = d.response?.shippingAddress || d.pledge.pledgeShippingAddress || null;
      if (addr) setAddress({ ...EMPTY_ADDRESS, ...Object.fromEntries(Object.entries(addr).filter(([, v]) => typeof v === "string")) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load survey");
    } finally {
      setLoading(false);
    }
  }, [pledgeId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/creator/indiekit/surveys/${pledgeId}`, {
        method: "PUT",
        json: {
          itemResponses,
          backerResponses,
          shippingAddress: includeAddress && address.line1.trim() ? address : null,
          notifyBacker,
        },
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Failed to save");
      toast.success(`Survey saved for ${data.pledge.backerName || data.pledge.backerEmail || "this backer"}`);
      router.push(`/dashboard/indiekit/survey/${pledgeId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data) return null;

  const relevantById = new Map((data.relevantItemQuestions || []).map((r) => [r.id, r]));
  const itemQuestions = data.questions.itemQuestions.filter((q) => relevantById.has(q.id));
  const { pledge } = data;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/dashboard/indiekit/survey/${pledgeId}`} className="mb-2 inline-flex items-center text-sm text-muted-foreground hover:underline">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to this backer&apos;s survey
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ClipboardPen className="h-6 w-6 text-teal-600" />
            Fill out survey for {pledge.backerName || pledge.backerEmail || "backer"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {pledge.rewardTitle}
            {pledge.addons.length ? ` + ${pledge.addons.map((a) => `${a.title}${(a.quantity || 1) > 1 ? ` ×${a.quantity}` : ""}`).join(", ")}` : ""}
          </p>
        </div>
      </div>

      {!data.survey ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            This campaign has no survey yet. Build one in Pledge Manager first, then come back here.
          </CardContent>
        </Card>
      ) : (
        <>
          {data.response?.isComplete && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              This backer already has a {data.response.completedBy === "CREATOR" ? "creator-entered" : "submitted"} survey. Saving here replaces those answers.
            </div>
          )}

          {itemQuestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Package className="h-5 w-5 text-teal-600" /> Item choices
                </CardTitle>
                <CardDescription>One card per unit the backer holds. They can all be different.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {itemQuestions.map((item) => {
                  const meta = relevantById.get(item.id)!;
                  const quantity = Math.max(1, meta.quantity || 1);
                  return Array.from({ length: quantity }, (_, unit) => {
                    const key = unitKey(item.id, unit);
                    const resp = itemResponses[key];
                    return (
                      <div key={key} className="rounded-lg border p-4">
                        <div className="mb-3 flex gap-3">
                          {meta.imageUrl && (
                            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                              <Image src={meta.imageUrl} alt={item.itemName} fill sizes="64px" className="object-cover" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{unitLabel(item.itemName, unit, quantity)}</p>
                            {item.itemDescription && <p className="text-xs text-muted-foreground">{item.itemDescription}</p>}
                          </div>
                        </div>
                        <div className="space-y-3">
                          {item.variants.map((variant) => (
                            <div key={variant.id} className="space-y-1">
                              <Label>{variant.variantType}</Label>
                              <Select
                                value={resp?.variants?.[variant.id] || resp?.variants?.[variant.variantType] || ""}
                                onValueChange={(value) =>
                                  setItemResponses((prev) => ({
                                    ...prev,
                                    [key]: { ...prev[key], variants: { ...prev[key]?.variants, [variant.id]: value, [variant.variantType]: value } },
                                  }))
                                }
                              >
                                <SelectTrigger><SelectValue placeholder={`Select ${variant.variantType}`} /></SelectTrigger>
                                <SelectContent>
                                  {variant.options.map((opt) => (
                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ))}
                          {item.customQuestions.map((q) => (
                            <div key={q.id} className="space-y-1">
                              <Label>
                                {q.question}
                                {q.isRequired && <span className="ml-1 text-red-500">*</span>}
                              </Label>
                              {q.description && <p className="text-xs text-muted-foreground">{q.description}</p>}
                              <QuestionInput
                                questionId={`${key}-${q.id}`}
                                type={q.questionType}
                                options={q.options}
                                value={resp?.customAnswers?.[q.id]}
                                onChange={(value) =>
                                  setItemResponses((prev) => ({
                                    ...prev,
                                    [key]: { ...prev[key], customAnswers: { ...prev[key]?.customAnswers, [q.id]: value } },
                                  }))
                                }
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  });
                })}
              </CardContent>
            </Card>
          )}

          {data.questions.backerQuestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="h-5 w-5 text-teal-600" /> Backer questions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.questions.backerQuestions.map((q) => (
                  <div key={q.id} className="space-y-1">
                    <Label>
                      {q.question}
                      {q.isRequired && <span className="ml-1 text-red-500">*</span>}
                    </Label>
                    {q.description && <p className="text-xs text-muted-foreground">{q.description}</p>}
                    <QuestionInput
                      questionId={`bq-${q.id}`}
                      type={q.questionType}
                      displayType={q.displayType}
                      options={q.options}
                      value={backerResponses[q.id]}
                      onChange={(value) => setBackerResponses((prev) => ({ ...prev, [q.id]: value }))}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5 text-teal-600" /> Shipping address
              </CardTitle>
              <CardDescription>
                Prefilled from the backer&apos;s saved address. Untick to leave their address as it is.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={includeAddress} onCheckedChange={(c) => setIncludeAddress(!!c)} /> Save this address with the survey
              </label>
              {includeAddress && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2"><Label>Full name</Label><Input value={address.name} onChange={(e) => setAddress({ ...address, name: e.target.value })} /></div>
                  <div className="sm:col-span-2"><Label>Address line 1</Label><Input value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} /></div>
                  <div className="sm:col-span-2"><Label>Address line 2</Label><Input value={address.line2} onChange={(e) => setAddress({ ...address, line2: e.target.value })} /></div>
                  <div><Label>City</Label><Input value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} /></div>
                  <div><Label>State / Province</Label><Input value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} /></div>
                  <div><Label>Postal code</Label><Input value={address.postalCode} onChange={(e) => setAddress({ ...address, postalCode: e.target.value })} /></div>
                  <div>
                    <Label>Country</Label>
                    <Select value={address.country} onValueChange={(v) => setAddress({ ...address, country: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ALL_COUNTRIES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2"><Label>Phone</Label><Input value={address.phone} onChange={(e) => setAddress({ ...address, phone: e.target.value })} /></div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={notifyBacker} onCheckedChange={(c) => setNotifyBacker(!!c)} /> Email the backer a copy of what was recorded
            </label>
            <Button onClick={save} disabled={saving} className="bg-teal-600 hover:bg-teal-700">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save survey for backer
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
