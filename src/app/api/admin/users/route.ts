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
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const role = searchParams.get("role") || "all";
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";
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

    return NextResponse.json({
      users: usersWithStats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      stats: {
        total: roleCounts[0] + roleCounts[1] + roleCounts[2],
        users: roleCounts[0],
        admins: roleCounts[1],
        superAdmins: roleCounts[2]
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
        if (data?.email !== undefined) updateData.email = data.email;
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
        emailVerified: true
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

// DELETE - Delete user
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

    await db.user.delete({
      where: { id: userId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
