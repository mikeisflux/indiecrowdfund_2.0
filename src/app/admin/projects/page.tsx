"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FolderKanban,
  Clock,
  History,
  Flag,
  RefreshCw,
  Loader2,
  Zap,
  Sparkles,
  Archive,
  FileEdit,
} from "lucide-react";
import {
  ReviewStatsCards,
  ProjectListItem,
  ProjectDetailPanel,
  ActiveProjectPanel,
  ReviewHistoryTab,
  ReviewDialog,
  RejectDialog,
  DeactivateDialog,
  MakeLiveDialog,
  ProjectsFilterBar,
  PrelaunchProjectCard,
  PrelaunchDetailPanel,
  UnsubmittedProjectCard,
  UnsubmittedDetailPanel,
  FlaggedTab,
} from "./components";
import { useProjectsData } from "./hooks/useProjectsData";

export default function ProjectsPage() {
  const {
    // data
    activeProjects,
    closedProjects,
    prelaunchProjects,
    prelaunchReviewProjects,
    unsubmittedProjects,
    reviewHistory,
    stats,
    // selected / dialog state
    selectedProject,
    setSelectedProject,
    showReviewDialog,
    setShowReviewDialog,
    showRejectDialog,
    setShowRejectDialog,
    showDeactivateDialog,
    setShowDeactivateDialog,
    showMakeLiveDialog,
    setShowMakeLiveDialog,
    reviewAction,
    // form state
    reviewNotes,
    setReviewNotes,
    internalNotes,
    setInternalNotes,
    rejectionReason,
    setRejectionReason,
    sendEmail,
    setSendEmail,
    // loading state
    isLoading,
    isSubmitting,
    isSyncingStats,
    // filters
    searchQuery,
    setSearchQuery,
    categoryFilter,
    setCategoryFilter,
    activeTab,
    setActiveTab,
    // pagination
    activePage,
    setActivePage,
    closedPage,
    setClosedPage,
    PROJECTS_PER_PAGE,
    // prelaunch vanity
    showPrelaunchVanityDialog,
    setShowPrelaunchVanityDialog,
    prelaunchVanityUrl,
    setPrelaunchVanityUrl,
    // derived/filtered
    filteredProjects,
    filteredActiveProjects,
    filteredClosedProjects,
    filteredPrelaunchProjects,
    filteredPrelaunchReviewProjects,
    filteredUnsubmittedProjects,
    flaggedProjects,
    paginatedActiveProjects,
    paginatedClosedProjects,
    activePageCount,
    closedPageCount,
    // actions
    handleApprove,
    handleReject,
    handleRequestChanges,
    handleDeactivate,
    handleMakeLive,
    submitReview,
    submitDeactivate,
    submitMakeLive,
    syncAllProjectStats,
    fetchProjects,
  } = useProjectsData();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-muted-foreground">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">Project Review Center</h1>
          <p className="text-muted-foreground">Review and approve project submissions</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="outline"
            onClick={syncAllProjectStats}
            disabled={isSyncingStats}
            className="flex-1 sm:flex-none"
          >
            {isSyncingStats ? (
              <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 sm:mr-2" />
            )}
            <span className="hidden sm:inline">{isSyncingStats ? "Syncing..." : "Sync All Stats"}</span>
          </Button>
          <Button variant="outline" onClick={() => setActiveTab("history")} className="flex-1 sm:flex-none">
            <History className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Review History</span>
          </Button>
          <Button variant="outline" onClick={() => fetchProjects()} className="flex-1 sm:flex-none">
            <RefreshCw className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <ReviewStatsCards stats={stats} flaggedCount={flaggedProjects.length} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto pb-1"><TabsList className="inline-flex w-max min-w-full">
          <TabsTrigger value="pending">
            <Clock className="mr-2 h-4 w-4" />
            Project Review
            {filteredProjects.length > 0 && (
              <Badge variant="destructive" className="ml-2">{filteredProjects.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="prelaunchReview">
            <Sparkles className="mr-2 h-4 w-4" />
            Prelaunch Review
            {prelaunchReviewProjects.length > 0 && (
              <Badge variant="destructive" className="ml-2">{prelaunchReviewProjects.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="active">
            <Zap className="mr-2 h-4 w-4" />
            Active Campaigns
            {activeProjects.length > 0 && (
              <Badge variant="default" className="ml-2 bg-emerald-600">{activeProjects.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="prelaunch">
            <Sparkles className="mr-2 h-4 w-4" />
            Active Prelaunch
            {prelaunchProjects.length > 0 && (
              <Badge variant="default" className="ml-2 bg-amber-500">{prelaunchProjects.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="closed">
            <Archive className="mr-2 h-4 w-4" />
            Closed Campaigns
            {closedProjects.length > 0 && (
              <Badge variant="secondary" className="ml-2">{closedProjects.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="unsubmitted">
            <FileEdit className="mr-2 h-4 w-4" />
            Unsubmitted Projects
            {unsubmittedProjects.length > 0 && (
              <Badge variant="secondary" className="ml-2">{unsubmittedProjects.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="flagged">
            <Flag className="mr-2 h-4 w-4" />
            Flagged
            {flaggedProjects.length > 0 && (
              <Badge variant="secondary" className="ml-2">{flaggedProjects.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="mr-2 h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList></div>

        {/* Pending Review Tab */}
        <TabsContent value="pending" className="mt-6 space-y-4">
          <ProjectsFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            categoryFilter={categoryFilter}
            onCategoryChange={setCategoryFilter}
            searchPlaceholder="Search projects..."
          />

          {filteredProjects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-medium text-zinc-900 dark:text-white mb-2">No projects pending review</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  All submitted projects have been reviewed. New submissions will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4">
                {filteredProjects.map((project) => (
                  <ProjectListItem
                    key={project.id}
                    project={project}
                    isSelected={selectedProject?.id === project.id}
                    onClick={() => setSelectedProject(project)}
                  />
                ))}
              </div>

              <ProjectDetailPanel
                project={selectedProject}
                onApprove={handleApprove}
                onReject={handleReject}
                onRequestChanges={handleRequestChanges}
              />
            </div>
          )}
        </TabsContent>

        {/* Active Campaigns Tab */}
        <TabsContent value="active" className="mt-6 space-y-4">
          <ProjectsFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            categoryFilter={categoryFilter}
            onCategoryChange={setCategoryFilter}
            searchPlaceholder="Search active campaigns..."
          />

          {activeProjects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Zap className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-medium text-zinc-900 dark:text-white mb-2">No active campaigns</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  There are no live campaigns currently running.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4">
                {paginatedActiveProjects.map((project) => (
                  <ProjectListItem
                    key={project.id}
                    project={project}
                    isSelected={selectedProject?.id === project.id}
                    onClick={() => setSelectedProject(project)}
                    showStatus
                    showFunding
                  />
                ))}
                {activePageCount > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {(activePage - 1) * PROJECTS_PER_PAGE + 1}-{Math.min(activePage * PROJECTS_PER_PAGE, filteredActiveProjects.length)} of {filteredActiveProjects.length}
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={activePage <= 1} onClick={() => setActivePage(p => p - 1)}>Previous</Button>
                      <Button variant="outline" size="sm" disabled={activePage >= activePageCount} onClick={() => setActivePage(p => p + 1)}>Next</Button>
                    </div>
                  </div>
                )}
              </div>

              <ActiveProjectPanel
                project={selectedProject}
                onMakeLive={handleMakeLive}
                onDeactivate={handleDeactivate}
              />
            </div>
          )}
        </TabsContent>

        {/* Prelaunch Review Tab */}
        <TabsContent value="prelaunchReview" className="mt-6 space-y-4">
          <ProjectsFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            categoryFilter={categoryFilter}
            onCategoryChange={setCategoryFilter}
            searchPlaceholder="Search prelaunch submissions..."
          />

          {filteredPrelaunchReviewProjects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-medium text-zinc-900 dark:text-white mb-2">No prelaunch pages pending review</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  All prelaunch submissions have been reviewed. New submissions will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4">
                {filteredPrelaunchReviewProjects.map((project) => (
                  <ProjectListItem
                    key={project.id}
                    project={project}
                    isSelected={selectedProject?.id === project.id}
                    onClick={() => setSelectedProject(project)}
                    badge={<Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">Prelaunch</Badge>}
                  />
                ))}
              </div>

              <ProjectDetailPanel
                project={selectedProject}
                onApprove={handleApprove}
                onReject={handleReject}
                onRequestChanges={handleRequestChanges}
                isPrelaunch
              />
            </div>
          )}
        </TabsContent>

        {/* Active Prelaunch Tab */}
        <TabsContent value="prelaunch" className="mt-6 space-y-4">
          <ProjectsFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            categoryFilter={categoryFilter}
            onCategoryChange={setCategoryFilter}
            searchPlaceholder="Search prelaunch projects..."
            includeComics
          />

          {prelaunchProjects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Sparkles className="h-12 w-12 text-amber-300 mb-4" />
                <h3 className="font-medium text-zinc-900 dark:text-white mb-2">No prelaunch pages</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  There are no active prelaunch pages currently published.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4">
                {filteredPrelaunchProjects.map((project) => (
                  <PrelaunchProjectCard
                    key={project.id}
                    project={project}
                    isSelected={selectedProject?.id === project.id}
                    onClick={() => setSelectedProject(project)}
                  />
                ))}
              </div>

              <PrelaunchDetailPanel
                selectedProject={selectedProject}
                prelaunchVanityUrl={prelaunchVanityUrl}
                showPrelaunchVanityDialog={showPrelaunchVanityDialog}
                onShowPrelaunchVanityDialogChange={setShowPrelaunchVanityDialog}
                onVanityUrlSuccess={(newVanityUrl) => setPrelaunchVanityUrl(newVanityUrl)}
                onDeactivated={() => fetchProjects()}
              />
            </div>
          )}
        </TabsContent>

        {/* Closed Campaigns Tab */}
        <TabsContent value="closed" className="mt-6 space-y-4">
          <ProjectsFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            categoryFilter={categoryFilter}
            onCategoryChange={setCategoryFilter}
            searchPlaceholder="Search closed campaigns..."
            includeComics
          />

          {closedProjects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Archive className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-medium text-zinc-900 dark:text-white mb-2">No closed campaigns</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Campaigns that have ended will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4">
                {paginatedClosedProjects.map((project) => (
                  <ProjectListItem
                    key={project.id}
                    project={project}
                    isSelected={selectedProject?.id === project.id}
                    onClick={() => setSelectedProject(project)}
                    showStatus
                    showFunding
                    badge={<Badge variant="secondary" className="text-xs">Ended</Badge>}
                  />
                ))}
                {closedPageCount > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {(closedPage - 1) * PROJECTS_PER_PAGE + 1}-{Math.min(closedPage * PROJECTS_PER_PAGE, filteredClosedProjects.length)} of {filteredClosedProjects.length}
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={closedPage <= 1} onClick={() => setClosedPage(p => p - 1)}>Previous</Button>
                      <Button variant="outline" size="sm" disabled={closedPage >= closedPageCount} onClick={() => setClosedPage(p => p + 1)}>Next</Button>
                    </div>
                  </div>
                )}
              </div>

              <ActiveProjectPanel
                project={selectedProject}
                onMakeLive={handleMakeLive}
                onDeactivate={handleDeactivate}
              />
            </div>
          )}
        </TabsContent>

        {/* Unsubmitted Projects Tab */}
        <TabsContent value="unsubmitted" className="mt-6 space-y-4">
          <ProjectsFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            categoryFilter={categoryFilter}
            onCategoryChange={setCategoryFilter}
            searchPlaceholder="Search unsubmitted projects..."
            includeComics
          />

          {filteredUnsubmittedProjects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <FileEdit className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-medium text-zinc-900 dark:text-white mb-2">No unsubmitted projects</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  There are no saved draft projects that haven&apos;t been submitted for review.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4">
                {filteredUnsubmittedProjects.map((project) => (
                  <UnsubmittedProjectCard
                    key={project.id}
                    project={project}
                    isSelected={selectedProject?.id === project.id}
                    onClick={() => setSelectedProject(project)}
                  />
                ))}
              </div>

              <UnsubmittedDetailPanel selectedProject={selectedProject} />
            </div>
          )}
        </TabsContent>

        {/* Flagged Tab */}
        <TabsContent value="flagged" className="mt-6">
          <FlaggedTab
            flaggedProjects={flaggedProjects}
            onReviewProject={(project) => {
              setSelectedProject(project);
              setActiveTab("pending");
            }}
          />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-6">
          <ReviewHistoryTab reviewHistory={reviewHistory} />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ReviewDialog
        open={showReviewDialog}
        onOpenChange={setShowReviewDialog}
        reviewAction={reviewAction === "reject" ? null : reviewAction}
        reviewNotes={reviewNotes}
        onReviewNotesChange={setReviewNotes}
        internalNotes={internalNotes}
        onInternalNotesChange={setInternalNotes}
        sendEmail={sendEmail}
        onSendEmailChange={setSendEmail}
        isSubmitting={isSubmitting}
        onSubmit={submitReview}
      />

      <RejectDialog
        open={showRejectDialog}
        onOpenChange={setShowRejectDialog}
        rejectionReason={rejectionReason}
        onRejectionReasonChange={setRejectionReason}
        reviewNotes={reviewNotes}
        onReviewNotesChange={setReviewNotes}
        internalNotes={internalNotes}
        onInternalNotesChange={setInternalNotes}
        sendEmail={sendEmail}
        onSendEmailChange={setSendEmail}
        isSubmitting={isSubmitting}
        onSubmit={submitReview}
      />

      <DeactivateDialog
        open={showDeactivateDialog}
        onOpenChange={setShowDeactivateDialog}
        isSubmitting={isSubmitting}
        onSubmit={submitDeactivate}
      />

      <MakeLiveDialog
        open={showMakeLiveDialog}
        onOpenChange={setShowMakeLiveDialog}
        sendEmail={sendEmail}
        onSendEmailChange={setSendEmail}
        isSubmitting={isSubmitting}
        onSubmit={submitMakeLive}
      />
    </div>
  );
}
