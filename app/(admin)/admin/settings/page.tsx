"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

export default function AdminSettingsPage() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [settings, setSettings] = useState({
    siteName: "Indiecrowdfund",
    siteUrl: "http://localhost:3000",
    platformFeePercent: "5.0",
    primaryColor: "#000000",
    secondaryColor: "#ffffff",
    metaTitle: "Indiecrowdfund - Fund Comic Books & Graphic Novels",
    metaDescription: "The premier crowdfunding platform for comic books and graphic novels.",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // API call would go here
      await new Promise((resolve) => setTimeout(resolve, 1000))

      toast({
        title: "Settings saved",
        description: "Your changes have been saved successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold mb-2">Site Settings</h1>
        <p className="text-muted-foreground">
          Configure general platform settings
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
            <CardDescription>Basic platform configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="siteName">Site Name</Label>
              <Input
                id="siteName"
                value={settings.siteName}
                onChange={(e) =>
                  setSettings({ ...settings, siteName: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="siteUrl">Site URL</Label>
              <Input
                id="siteUrl"
                type="url"
                value={settings.siteUrl}
                onChange={(e) =>
                  setSettings({ ...settings, siteUrl: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="platformFeePercent">Platform Fee (%)</Label>
              <Input
                id="platformFeePercent"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={settings.platformFeePercent}
                onChange={(e) =>
                  setSettings({ ...settings, platformFeePercent: e.target.value })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle>Theme Colors</CardTitle>
            <CardDescription>Customize the platform's appearance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="primaryColor"
                    type="color"
                    value={settings.primaryColor}
                    onChange={(e) =>
                      setSettings({ ...settings, primaryColor: e.target.value })
                    }
                    className="w-20"
                  />
                  <Input
                    type="text"
                    value={settings.primaryColor}
                    onChange={(e) =>
                      setSettings({ ...settings, primaryColor: e.target.value })
                    }
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="secondaryColor">Secondary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="secondaryColor"
                    type="color"
                    value={settings.secondaryColor}
                    onChange={(e) =>
                      setSettings({ ...settings, secondaryColor: e.target.value })
                    }
                    className="w-20"
                  />
                  <Input
                    type="text"
                    value={settings.secondaryColor}
                    onChange={(e) =>
                      setSettings({ ...settings, secondaryColor: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SEO Settings */}
        <Card>
          <CardHeader>
            <CardTitle>SEO Settings</CardTitle>
            <CardDescription>Search engine optimization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="metaTitle">Meta Title</Label>
              <Input
                id="metaTitle"
                value={settings.metaTitle}
                onChange={(e) =>
                  setSettings({ ...settings, metaTitle: e.target.value })
                }
                maxLength={60}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {settings.metaTitle.length}/60 characters
              </p>
            </div>

            <div>
              <Label htmlFor="metaDescription">Meta Description</Label>
              <Textarea
                id="metaDescription"
                value={settings.metaDescription}
                onChange={(e) =>
                  setSettings({ ...settings, metaDescription: e.target.value })
                }
                maxLength={160}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {settings.metaDescription.length}/160 characters
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </form>
    </div>
  )
}
