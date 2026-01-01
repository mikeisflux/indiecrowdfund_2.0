import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { sendPasswordResetEmail } from "@/lib/email";

// Force dynamic - this route uses auth/headers
export const dynamic = "force-dynamic";

// Helper to check admin role
async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 };
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  });

  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden - Admin access required", status: 403 };
  }

  return { user: session.user, role: user.role };
}

// GET - Get users list
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(req.url);

    // Validate and sanitize pagination parameters
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));

    const search = searchParams.get("search") || "";
    const role = searchParams.get("role") || "all";

    // Whitelist allowed sort fields to prevent information disclosure
    const allowedSortFields = ["createdAt", "name", "email", "role"];
    const requestedSortBy = searchParams.get("sortBy") || "createdAt";
    const sortBy = allowedSortFields.includes(requestedSortBy) ? requestedSortBy : "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } }
      ];
    }

    if (role !== "all") {
      where.role = role;
    }

    // Get users with stats
    const [users, total, roleCounts] = await Promise.all([
      db.user.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          role: true,
          retailerAccess: true,
          createdAt: true,
          emailVerified: true,
          lockedAt: true,
          lockedReason: true,
          _count: {
            select: {
              createdProjects: true,
              pledges: true
            }
          }
        }
      }),
      db.user.count({ where }),
      Promise.all([
        db.user.count({ where: { role: "USER" } }),
        db.user.count({ where: { role: "COOL_KIDS" } }),
        db.user.count({ where: { role: "ADMIN" } }),
        db.user.count({ where: { role: "SUPER_ADMIN" } })
      ])
    ]);

    // Transform users data
    const usersWithStats = users.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
      retailerAccess: user.retailerAccess,
      createdAt: user.createdAt,
      emailVerified: user.emailVerified,
      projectCount: user._count.createdProjects,
      pledgeCount: user._count.pledges
    }));

    // roleCounts: [USER, COOL_KIDS, ADMIN, SUPER_ADMIN]
    const totalUsers = roleCounts[0] + roleCounts[1] + roleCounts[2] + roleCounts[3];

    return NextResponse.json({
      users: usersWithStats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      stats: {
        total: totalUsers,
        users: roleCounts[0] + roleCounts[1], // Regular users + Cool Kids
        admins: roleCounts[2],
        superAdmins: roleCounts[3]
      }
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// PATCH - Update user
export async function PATCH(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await req.json();
    const { userId, action, data } = body;

    if (!userId || !action) {
      return NextResponse.json(
        { error: "User ID and action are required" },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    switch (action) {
      case "UPDATE_ROLE":
        // Only SUPER_ADMIN can change roles
        if (authResult.role !== "SUPER_ADMIN") {
          return NextResponse.json(
            { error: "Only super admins can change roles" },
            { status: 403 }
          );
        }
        if (!data?.role || !["USER", "COOL_KIDS", "ADMIN", "SUPER_ADMIN"].includes(data.role)) {
          return NextResponse.json(
            { error: "Invalid role" },
            { status: 400 }
          );
        }
        updateData.role = data.role;
        break;

      case "UPDATE_INFO":
        if (data?.name !== undefined) updateData.name = data.name;
        if (data?.email !== undefined) {
          const newEmail = data.email.toLowerCase().trim();
          const oldEmail = user.email.toLowerCase();

          // Check if new email is already taken by another user
          if (newEmail !== oldEmail) {
            const existingUser = await db.user.findUnique({
              where: { email: newEmail }
            });
            if (existingUser) {
              return NextResponse.json(
                { error: "This email is already in use by another account" },
                { status: 400 }
              );
            }

            // Update email in related tables and clean up old references
            await db.$transaction(async (tx) => {
              // Update collaborator records that use the old email
              await tx.projectCollaborator.updateMany({
                where: { email: oldEmail },
                data: { email: newEmail }
              });

              // Delete any password reset tokens for the old email
              await tx.passwordResetToken.deleteMany({
                where: { email: oldEmail }
              });

              // Update project followers that used the old email (if any)
              await tx.projectFollower.updateMany({
                where: { email: oldEmail },
                data: { email: newEmail }
              });
            });

            console.log(`Updated email from ${oldEmail} to ${newEmail} and cleaned up related records`);
          }

          updateData.email = newEmail;
        }
        break;

      case "TOGGLE_RETAILER_ACCESS":
        updateData.retailerAccess = data?.retailerAccess === true;
        break;

      case "VERIFY_EMAIL":
        updateData.emailVerified = new Date();
        break;

      case "SET_PASSWORD":
        // Only SUPER_ADMIN can set passwords directly
        if (authResult.role !== "SUPER_ADMIN") {
          return NextResponse.json(
            { error: "Only super admins can set passwords directly" },
            { status: 403 }
          );
        }
        if (!data?.password || data.password.length < 8) {
          return NextResponse.json(
            { error: "Password must be at least 8 characters" },
            { status: 400 }
          );
        }
        updateData.password = await bcrypt.hash(data.password, 12);
        break;

      case "SEND_RESET_EMAIL":
        // Send a password reset email to the user
        try {
          // Delete any existing tokens for this email
          await db.passwordResetToken.deleteMany({
            where: { email: user.email },
          });

          // Generate a secure token
          const token = crypto.randomUUID();
          const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

          // Create the reset token
          await db.passwordResetToken.create({
            data: {
              email: user.email,
              token,
              expires,
            },
          });

          // Send the reset email
          const emailResult = await sendPasswordResetEmail(user.email, token);

          if (!emailResult.success) {
            return NextResponse.json(
              { error: "Failed to send reset email. Email may not be configured." },
              { status: 500 }
            );
          }

          return NextResponse.json({
            success: true,
            message: `Password reset email sent to ${user.email}`,
          });
        } catch (error) {
          console.error("Error sending reset email:", error);
          return NextResponse.json(
            { error: "Failed to send reset email" },
            { status: 500 }
          );
        }

      case "LOCK_ACCOUNT":
        // Only SUPER_ADMIN can lock accounts
        if (authResult.role !== "SUPER_ADMIN") {
          return NextResponse.json(
            { error: "Only super admins can lock accounts" },
            { status: 403 }
          );
        }
        // Can't lock your own account
        if (userId === authResult.user.id) {
          return NextResponse.json(
            { error: "Cannot lock your own account" },
            { status: 400 }
          );
        }
        updateData.lockedAt = new Date();
        updateData.lockedReason = data?.reason || "Account locked by administrator";
        updateData.lockedById = authResult.user.id;
        break;

      case "UNLOCK_ACCOUNT":
        // Only SUPER_ADMIN can unlock accounts
        if (authResult.role !== "SUPER_ADMIN") {
          return NextResponse.json(
            { error: "Only super admins can unlock accounts" },
            { status: 403 }
          );
        }
        updateData.lockedAt = null;
        updateData.lockedReason = null;
        updateData.lockedById = null;
        break;

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        retailerAccess: true,
        emailVerified: true,
        lockedAt: true,
        lockedReason: true,
      }
    });

    return NextResponse.json({
      success: true,
      user: updatedUser
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

// POST - Create new user
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await req.json();
    const { email, name, password, role, retailerAccess } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 400 }
      );
    }

    // Validate role if provided
    const validRoles = ["USER", "COOL_KIDS", "ADMIN", "SUPER_ADMIN"];
    const userRole = role && validRoles.includes(role) ? role : "USER";

    // Only SUPER_ADMIN can create admin users
    if ((userRole === "ADMIN" || userRole === "SUPER_ADMIN") && authResult.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only super admins can create admin users" },
        { status: 403 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const newUser = await db.user.create({
      data: {
        email,
        name: name || null,
        password: hashedPassword,
        role: userRole,
        retailerAccess: retailerAccess === true,
        emailVerified: new Date(), // Admin-created users are pre-verified
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        retailerAccess: true,
        createdAt: true,
        emailVerified: true,
      }
    });

    return NextResponse.json({
      success: true,
      user: newUser,
      message: "User created successfully"
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}

// DELETE - Delete user and ALL associated data
export async function DELETE(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    // Only SUPER_ADMIN can delete users
    if (authResult.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only super admins can delete users" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Can't delete yourself
    if (userId === authResult.user.id) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    // Get user info before deletion
    const userToDelete = await db.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });

    if (!userToDelete) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Get user's projects to delete
    const userProjects = await db.project.findMany({
      where: { creatorId: userId },
      select: { id: true }
    });

    const projectIds = userProjects.map(p => p.id);

    // Get user's marketplace books
    const userBooks = await db.marketplaceBook.findMany({
      where: { creatorId: userId },
      select: { id: true }
    });
    const bookIds = userBooks.map((b: { id: string }) => b.id);

    // Use a transaction to delete everything
    await db.$transaction(async (tx) => {
      // =====================================================
      // PHASE 1: Delete Marketplace data
      // =====================================================
      if (bookIds.length > 0) {
        // Delete marketplace book reviews
        await tx.marketplaceBookReview.deleteMany({
          where: { bookId: { in: bookIds } }
        });

        // Delete marketplace purchases
        await tx.marketplacePurchase.deleteMany({
          where: { bookId: { in: bookIds } }
        });

        // Delete the marketplace books
        await tx.marketplaceBook.deleteMany({
          where: { id: { in: bookIds } }
        });
      }

      // Delete company profile
      await tx.companyProfile.deleteMany({
        where: { userId }
      });

      // Delete marketplace book reviews made BY this user (as reviewer)
      await tx.marketplaceBookReview.deleteMany({
        where: { reviewerId: userId }
      });

      // Delete marketplace purchases made BY this user (as buyer)
      await tx.marketplacePurchase.deleteMany({
        where: { buyerId: userId }
      });

      // =====================================================
      // PHASE 2: Delete Project-related records
      // =====================================================
      if (projectIds.length > 0) {
        // Delete survey responses first (depend on surveys)
        await tx.surveyResponse.deleteMany({
          where: { survey: { projectId: { in: projectIds } } }
        });

        // Delete survey item variants
        await tx.surveyItemVariant.deleteMany({
          where: { surveyItemQuestion: { survey: { projectId: { in: projectIds } } } }
        });

        // Delete survey item questions
        await tx.surveyItemQuestion.deleteMany({
          where: { survey: { projectId: { in: projectIds } } }
        });

        // Delete survey item custom questions
        await tx.surveyItemCustomQuestion.deleteMany({
          where: { survey: { projectId: { in: projectIds } } }
        });

        // Delete survey backer questions
        await tx.surveyBackerQuestion.deleteMany({
          where: { survey: { projectId: { in: projectIds } } }
        });

        // Delete surveys
        await tx.survey.deleteMany({
          where: { projectId: { in: projectIds } }
        });

        // Delete distribution rules (depend on digital files)
        await tx.distributionRule.deleteMany({
          where: { projectId: { in: projectIds } }
        });

        // Delete digital distributions
        await tx.digitalDistribution.deleteMany({
          where: { file: { projectId: { in: projectIds } } }
        });

        // Delete rewards and their related items
        await tx.rewardItem.deleteMany({
          where: { reward: { projectId: { in: projectIds } } }
        });
        await tx.reward.deleteMany({
          where: { projectId: { in: projectIds } }
        });

        // Delete pledge addons
        await tx.pledgeAddon.deleteMany({
          where: { pledge: { projectId: { in: projectIds } } }
        });

        // Delete pledges
        await tx.pledge.deleteMany({
          where: { projectId: { in: projectIds } }
        });

        // Delete payouts
        await tx.payout.deleteMany({
          where: { projectId: { in: projectIds } }
        });

        // Delete comments on updates first
        await tx.comment.deleteMany({
          where: { update: { projectId: { in: projectIds } } }
        });

        // Delete comments on projects
        await tx.comment.deleteMany({
          where: { projectId: { in: projectIds } }
        });

        // Delete updates (correct model name)
        await tx.update.deleteMany({
          where: { projectId: { in: projectIds } }
        });

        // Delete followers and collaborators
        await tx.projectFollower.deleteMany({
          where: { projectId: { in: projectIds } }
        });
        await tx.projectCollaborator.deleteMany({
          where: { projectId: { in: projectIds } }
        });

        // Delete project reviews
        await tx.projectReview.deleteMany({
          where: { projectId: { in: projectIds } }
        });

        // Delete project items
        await tx.projectItem.deleteMany({
          where: { projectId: { in: projectIds } }
        });

        // Delete project tags
        await tx.projectTag.deleteMany({
          where: { projectId: { in: projectIds } }
        });

        // Delete project similarity scores
        await tx.projectSimilarity.deleteMany({
          where: { OR: [
            { projectId: { in: projectIds } },
            { similarProjectId: { in: projectIds } }
          ]}
        });

        // Delete digital files
        await tx.digitalFile.deleteMany({
          where: { projectId: { in: projectIds } }
        });

        // Delete media files for projects
        await tx.mediaFile.deleteMany({
          where: { projectId: { in: projectIds } }
        });

        // Delete messages related to projects
        await tx.message.deleteMany({
          where: { projectId: { in: projectIds } }
        });

        // Delete backer notes
        await tx.backerNote.deleteMany({
          where: { projectId: { in: projectIds } }
        });

        // Delete notification preferences for these projects
        await tx.projectNotificationPreference.deleteMany({
          where: { projectId: { in: projectIds } }
        });

        // Delete project views
        await tx.projectView.deleteMany({
          where: { projectId: { in: projectIds } }
        });

        // Delete referral trackers
        await tx.referralTracker.deleteMany({
          where: { projectId: { in: projectIds } }
        });

        // Delete fulfillment activities
        await tx.fulfillmentActivity.deleteMany({
          where: { projectId: { in: projectIds } }
        });

        // Delete fulfillment products
        await tx.fulfillmentProduct.deleteMany({
          where: { projectId: { in: projectIds } }
        });

        // Delete backer segments
        await tx.backerSegment.deleteMany({
          where: { projectId: { in: projectIds } }
        });

        // Delete email campaigns
        await tx.emailCampaignClick.deleteMany({
          where: { campaign: { projectId: { in: projectIds } } }
        });
        await tx.emailCampaign.deleteMany({
          where: { projectId: { in: projectIds } }
        });

        // Delete project collection items
        await tx.projectCollectionItem.deleteMany({
          where: { projectId: { in: projectIds } }
        });

        // Delete custom pages
        await tx.customPage.deleteMany({
          where: { projectId: { in: projectIds } }
        });

        // Finally delete the projects
        await tx.project.deleteMany({
          where: { id: { in: projectIds } }
        });
      }

      // =====================================================
      // PHASE 3: Delete User-specific records (not project-related)
      // =====================================================

      // Delete email list subscribers created by this user
      await tx.emailListSubscriber.deleteMany({
        where: { creatorId: userId }
      });

      // Delete messages sent or received by user (that aren't tied to projects)
      await tx.message.deleteMany({
        where: { OR: [
          { senderId: userId },
          { recipientId: userId }
        ]}
      });

      // Delete creator follows (both directions)
      await tx.creatorFollow.deleteMany({
        where: { OR: [
          { followerId: userId },
          { creatorId: userId }
        ]}
      });

      // Delete Stripe config
      await tx.stripeConfig.deleteMany({
        where: { userId }
      });

      // Delete password reset tokens
      await tx.passwordResetToken.deleteMany({
        where: { email: userToDelete.email }
      });

      // Delete reports created by user
      await tx.report.deleteMany({
        where: { reporterId: userId }
      });

      // Delete user behavior data
      await tx.userBehavior.deleteMany({
        where: { userId }
      });

      // Delete analytics events
      await tx.analyticsEvent.deleteMany({
        where: { userId }
      });

      // Delete email logs
      await tx.emailLog.deleteMany({
        where: { userId }
      });

      // Delete email campaign clicks
      await tx.emailCampaignClick.deleteMany({
        where: { userId }
      });

      // Get the retailer associated with this user (if any)
      const userRetailer = await tx.retailer.findUnique({
        where: { userId },
        select: { id: true }
      });

      if (userRetailer) {
        // Delete retailer satisfaction surveys
        await tx.retailerSatisfactionSurvey.deleteMany({
          where: { retailerId: userRetailer.id }
        });

        // Delete retailer pledges
        await tx.retailerPledge.deleteMany({
          where: { retailerId: userRetailer.id }
        });

        // Delete retailer
        await tx.retailer.delete({
          where: { id: userRetailer.id }
        });
      }

      // Delete API keys created by user
      await tx.apiKey.deleteMany({
        where: { createdById: userId }
      });

      // Delete mailboxes
      await tx.mailbox.deleteMany({
        where: { userId }
      });

      // Delete admin emails sent by user
      await tx.adminEmail.deleteMany({
        where: { sentById: userId }
      });

      // =====================================================
      // PHASE 4: Delete the user (cascading relations handle the rest)
      // These will be auto-deleted due to onDelete: Cascade:
      // - Account, Session, DivinityCoinBankAccount, DivinityCoinRedemption,
      // - DivinityCoinTransaction, UserInterestProfile, UserPreference,
      // - IDVerification, Notification, UserAchievement, RedemptionBonusLedger,
      // - RedemptionBonusApplication, UserAddress, ProjectCollection,
      // - ProjectNotificationPreference
      // =====================================================
      await tx.user.delete({
        where: { id: userId }
      });
    });

    return NextResponse.json({
      success: true,
      message: `User and all associated data deleted successfully (${projectIds.length} project(s), ${bookIds.length} marketplace book(s))`
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Failed to delete user. Please check server logs for details." },
      { status: 500 }
    );
  }
}
