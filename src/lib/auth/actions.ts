"use server";

import { signIn, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export async function register(formData: FormData) {
  const validatedFields = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors };
  }

  const { name, email, password } = validatedFields.data;

  // Check if user already exists
  const existingUser = await db.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return { error: { email: ["Email already registered"] } };
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Create user
  try {
    await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });
  } catch {
    return { error: { _form: ["Something went wrong. Please try again."] } };
  }

  // Auto sign in after registration
  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: { _form: ["Account created but login failed. Please try logging in."] } };
    }
    throw error;
  }

  // Redirect after successful login
  redirect("/dashboard");
}

export async function login(formData: FormData, callbackUrl?: string) {
  const validatedFields = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors };
  }

  const { email, password } = validatedFields.data;
  const redirectTo = callbackUrl || "/dashboard";

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: { _form: ["Invalid email or password"] } };
        default:
          return { error: { _form: ["Something went wrong. Please try again."] } };
      }
    }
    throw error;
  }

  // Return success with redirect URL for client-side navigation
  return { success: true, redirectTo };
}

export async function loginWithGoogle(callbackUrl?: string) {
  const redirectTo = callbackUrl || "/dashboard";
  await signIn("google", { redirectTo });
}

export async function logout() {
  await signOut({ redirectTo: "/" });
}

// Password reset schemas
const requestResetSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export async function requestPasswordReset(formData: FormData) {
  const validatedFields = requestResetSchema.safeParse({
    email: formData.get("email"),
  });

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors };
  }

  const { email } = validatedFields.data;

  try {
    // Check if user exists
    const user = await db.user.findUnique({
      where: { email },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return { success: true };
    }

    // Delete any existing tokens for this email
    await db.passwordResetToken.deleteMany({
      where: { email },
    });

    // Generate a secure token
    const token = crypto.randomUUID();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Create the reset token
    await db.passwordResetToken.create({
      data: {
        email,
        token,
        expires,
      },
    });

    // Send the reset email
    const { sendPasswordResetEmail } = await import("@/lib/email");
    await sendPasswordResetEmail(email, token);

    return { success: true };
  } catch (error) {
    console.error("Error requesting password reset:", error);
    return { error: { _form: ["Something went wrong. Please try again."] } };
  }
}

export async function verifyResetToken(token: string) {
  try {
    const resetToken = await db.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      return { valid: false };
    }

    if (resetToken.expires < new Date()) {
      // Token expired, delete it
      await db.passwordResetToken.delete({
        where: { token },
      });
      return { valid: false };
    }

    return { valid: true, email: resetToken.email };
  } catch {
    return { valid: false };
  }
}

export async function resetPassword(formData: FormData, token: string) {
  const validatedFields = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors };
  }

  const { password } = validatedFields.data;

  try {
    // Verify token
    const resetToken = await db.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken || resetToken.expires < new Date()) {
      return { error: { _form: ["Invalid or expired reset link. Please request a new one."] } };
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update the user's password
    await db.user.update({
      where: { email: resetToken.email },
      data: { password: hashedPassword },
    });

    // Delete the used token
    await db.passwordResetToken.delete({
      where: { token },
    });

    return { success: true };
  } catch (error) {
    console.error("Error resetting password:", error);
    return { error: { _form: ["Something went wrong. Please try again."] } };
  }
}
