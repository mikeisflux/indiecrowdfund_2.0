"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Trash2, Edit, UserPlus } from "lucide-react"

interface Collaborator {
  id: string
  role: string
  permissions: {
    canEdit: boolean
    canManageRewards: boolean
    canManageBackers: boolean
    canPostUpdates: boolean
    canRespondToMessages: boolean
  }
  createdAt: string
  user: {
    id: string
    name: string | null
    username: string | null
    email: string
    avatar: string | null
  }
}

export default function CollaboratorsPage() {
  const params = useParams()
  const { toast } = useToast()
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingCollaborator, setEditingCollaborator] = useState<Collaborator | null>(null)

  // Add form state
  const [userIdentifier, setUserIdentifier] = useState("")
  const [role, setRole] = useState("CONTRIBUTOR")
  const [permissions, setPermissions] = useState({
    canEdit: false,
    canManageRewards: false,
    canManageBackers: false,
    canPostUpdates: true,
    canRespondToMessages: true,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetchCollaborators()
  }, [])

  const fetchCollaborators = async () => {
    try {
      const response = await fetch(`/api/projects/${params.id}/collaborators`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch collaborators")
      }

      setCollaborators(data)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load collaborators",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const addCollaborator = async () => {
    if (!userIdentifier.trim()) {
      toast({
        title: "Error",
        description: "Please enter an email or username",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/projects/${params.id}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIdentifier: userIdentifier.trim(),
          role,
          permissions,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to add collaborator")
      }

      toast({
        title: "Success",
        description: "Collaborator added successfully",
      })

      setShowAddDialog(false)
      resetAddForm()
      fetchCollaborators()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add collaborator",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateCollaborator = async () => {
    if (!editingCollaborator) return

    setIsSubmitting(true)

    try {
      const response = await fetch(
        `/api/projects/${params.id}/collaborators/${editingCollaborator.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role,
            permissions,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update collaborator")
      }

      toast({
        title: "Success",
        description: "Collaborator updated successfully",
      })

      setShowEditDialog(false)
      setEditingCollaborator(null)
      fetchCollaborators()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update collaborator",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const removeCollaborator = async (collaboratorId: string) => {
    if (!confirm("Are you sure you want to remove this collaborator?")) return

    try {
      const response = await fetch(
        `/api/projects/${params.id}/collaborators/${collaboratorId}`,
        {
          method: "DELETE",
        }
      )

      if (!response.ok) {
        throw new Error("Failed to remove collaborator")
      }

      toast({
        title: "Success",
        description: "Collaborator removed successfully",
      })

      fetchCollaborators()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove collaborator",
        variant: "destructive",
      })
    }
  }

  const openEditDialog = (collaborator: Collaborator) => {
    setEditingCollaborator(collaborator)
    setRole(collaborator.role)
    setPermissions(collaborator.permissions)
    setShowEditDialog(true)
  }

  const resetAddForm = () => {
    setUserIdentifier("")
    setRole("CONTRIBUTOR")
    setPermissions({
      canEdit: false,
      canManageRewards: false,
      canManageBackers: false,
      canPostUpdates: true,
      canRespondToMessages: true,
    })
  }

  const getRoleBadge = (role: string) => {
    const colors: Record<string, any> = {
      ADMIN: "default",
      EDITOR: "secondary",
      CONTRIBUTOR: "outline",
    }

    return <Badge variant={colors[role] || "outline"}>{role}</Badge>
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading collaborators...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Collaborators</h1>
          <p className="text-muted-foreground">
            Manage team members who can help with this project
          </p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Collaborator
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Collaborator</DialogTitle>
              <DialogDescription>
                Invite a team member to help manage this project
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div>
                <Label htmlFor="userIdentifier">Email or Username</Label>
                <Input
                  id="userIdentifier"
                  value={userIdentifier}
                  onChange={(e) => setUserIdentifier(e.target.value)}
                  placeholder="user@example.com or username"
                />
              </div>

              <div>
                <Label htmlFor="role">Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin - Full access</SelectItem>
                    <SelectItem value="EDITOR">Editor - Can edit and manage</SelectItem>
                    <SelectItem value="CONTRIBUTOR">Contributor - Can post updates</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-4 block">Permissions</Label>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Edit Project</p>
                      <p className="text-sm text-muted-foreground">
                        Can edit project details and settings
                      </p>
                    </div>
                    <Switch
                      checked={permissions.canEdit}
                      onCheckedChange={(checked) =>
                        setPermissions({ ...permissions, canEdit: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Manage Rewards</p>
                      <p className="text-sm text-muted-foreground">
                        Can create and edit rewards
                      </p>
                    </div>
                    <Switch
                      checked={permissions.canManageRewards}
                      onCheckedChange={(checked) =>
                        setPermissions({ ...permissions, canManageRewards: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Manage Backers</p>
                      <p className="text-sm text-muted-foreground">
                        Can view and manage backer information
                      </p>
                    </div>
                    <Switch
                      checked={permissions.canManageBackers}
                      onCheckedChange={(checked) =>
                        setPermissions({ ...permissions, canManageBackers: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Post Updates</p>
                      <p className="text-sm text-muted-foreground">
                        Can create and publish project updates
                      </p>
                    </div>
                    <Switch
                      checked={permissions.canPostUpdates}
                      onCheckedChange={(checked) =>
                        setPermissions({ ...permissions, canPostUpdates: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Respond to Messages</p>
                      <p className="text-sm text-muted-foreground">
                        Can reply to backer messages
                      </p>
                    </div>
                    <Switch
                      checked={permissions.canRespondToMessages}
                      onCheckedChange={(checked) =>
                        setPermissions({ ...permissions, canRespondToMessages: checked })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={addCollaborator} disabled={isSubmitting}>
                {isSubmitting ? "Adding..." : "Add Collaborator"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Collaborators List */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            People who can help manage this project
          </CardDescription>
        </CardHeader>
        <CardContent>
          {collaborators.length === 0 ? (
            <div className="text-center py-12">
              <UserPlus className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">
                No collaborators added yet
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Collaborator
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {collaborators.map((collaborator) => (
                    <TableRow key={collaborator.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                            {collaborator.user.avatar ? (
                              <img
                                src={collaborator.user.avatar}
                                alt=""
                                className="w-full h-full rounded-full"
                              />
                            ) : (
                              collaborator.user.name?.[0] ||
                              collaborator.user.username?.[0] ||
                              "U"
                            )}
                          </div>
                          <div>
                            <p className="font-medium">
                              {collaborator.user.name || collaborator.user.username}
                            </p>
                            {collaborator.user.username && (
                              <p className="text-sm text-muted-foreground">
                                @{collaborator.user.username}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{collaborator.user.email}</TableCell>
                      <TableCell>{getRoleBadge(collaborator.role)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {collaborator.permissions.canEdit && (
                            <Badge variant="outline" className="text-xs">Edit</Badge>
                          )}
                          {collaborator.permissions.canManageRewards && (
                            <Badge variant="outline" className="text-xs">Rewards</Badge>
                          )}
                          {collaborator.permissions.canManageBackers && (
                            <Badge variant="outline" className="text-xs">Backers</Badge>
                          )}
                          {collaborator.permissions.canPostUpdates && (
                            <Badge variant="outline" className="text-xs">Updates</Badge>
                          )}
                          {collaborator.permissions.canRespondToMessages && (
                            <Badge variant="outline" className="text-xs">Messages</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => openEditDialog(collaborator)}
                            size="sm"
                            variant="ghost"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => removeCollaborator(collaborator.id)}
                            size="sm"
                            variant="ghost"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Collaborator</DialogTitle>
            <DialogDescription>
              Update permissions for {editingCollaborator?.user.name || editingCollaborator?.user.username}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div>
              <Label htmlFor="edit-role">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin - Full access</SelectItem>
                  <SelectItem value="EDITOR">Editor - Can edit and manage</SelectItem>
                  <SelectItem value="CONTRIBUTOR">Contributor - Can post updates</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-4 block">Permissions</Label>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Edit Project</p>
                    <p className="text-sm text-muted-foreground">
                      Can edit project details and settings
                    </p>
                  </div>
                  <Switch
                    checked={permissions.canEdit}
                    onCheckedChange={(checked) =>
                      setPermissions({ ...permissions, canEdit: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Manage Rewards</p>
                    <p className="text-sm text-muted-foreground">
                      Can create and edit rewards
                    </p>
                  </div>
                  <Switch
                    checked={permissions.canManageRewards}
                    onCheckedChange={(checked) =>
                      setPermissions({ ...permissions, canManageRewards: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Manage Backers</p>
                    <p className="text-sm text-muted-foreground">
                      Can view and manage backer information
                    </p>
                  </div>
                  <Switch
                    checked={permissions.canManageBackers}
                    onCheckedChange={(checked) =>
                      setPermissions({ ...permissions, canManageBackers: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Post Updates</p>
                    <p className="text-sm text-muted-foreground">
                      Can create and publish project updates
                    </p>
                  </div>
                  <Switch
                    checked={permissions.canPostUpdates}
                    onCheckedChange={(checked) =>
                      setPermissions({ ...permissions, canPostUpdates: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Respond to Messages</p>
                    <p className="text-sm text-muted-foreground">
                      Can reply to backer messages
                    </p>
                  </div>
                  <Switch
                    checked={permissions.canRespondToMessages}
                    onCheckedChange={(checked) =>
                      setPermissions({ ...permissions, canRespondToMessages: checked })
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={updateCollaborator} disabled={isSubmitting}>
              {isSubmitting ? "Updating..." : "Update Collaborator"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
