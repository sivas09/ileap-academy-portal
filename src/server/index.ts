import "dotenv/config";
import { AccessMode, AccountStatus, PrismaClient, Resource, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import cors from "cors";
import crypto from "crypto";
import express from "express";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import multer from "multer";
import nodemailer from "nodemailer";
import OpenAI from "openai";
import path from "path";
import Stripe from "stripe";
import { z } from "zod";
import { deleteStoredFile, downloadStoredFile, saveUploadedFile } from "./services/storage.js";

const prisma = new PrismaClient();
const app = express();
const port = Number(process.env.PORT ?? 4000);
const jwtSecret = process.env.JWT_SECRET ?? "local-development-secret";
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const appUrl = process.env.APP_URL ?? "http://localhost:5174";
const defaultNotificationEmail = process.env.DEFAULT_SUBMISSION_NOTIFICATION_EMAIL ?? "ileap.academy.icat@gmail.com";
const defaultSiteContent = {
  heroEyebrow: "English Writing Program for Children",
  heroTitle: "Writing coaching, level-based resources, and teacher-guided feedback in one portal.",
  heroSubtitle: "Students access their writing level, complete assignments, use worksheets and video lessons, and receive clear feedback from iLEAP Academy teachers.",
  announcement: "Welcome to the iLEAP Academy English Writing Portal.",
  loginTitle: "Portal Login",
  loginHint: "Use the email and password provided by iLEAP Academy.",
  signupTitle: "Student Signup",
  signupHint: "Create an account only if iLEAP Academy has asked you to register for the English Writing Program.",
  grade2Title: "Foundations",
  grade2Text: "Build sentence confidence, story ideas, grammar basics, and early paragraph writing.",
  grade456Title: "Paragraph Builder",
  grade456Text: "Practice topic sentences, supporting details, structure, transitions, and stronger vocabulary.",
  grade789Title: "Essay Mastery",
  grade789Text: "Develop organized essays, persuasive writing, academic vocabulary, and revision habits."
};
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "image/jpeg",
      "image/png"
    ]);
    cb(null, allowed.has(file.mimetype));
  }
});

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));

app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    res.status(503).json({ error: "Stripe webhook is not configured" });
    return;
  }

  const signature = req.headers["stripe-signature"];
  if (!signature) {
    res.status(400).json({ error: "Missing Stripe signature" });
    return;
  }

  let event: any;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Invalid Stripe webhook signature" });
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    const orderId = session.metadata?.orderId;
    if (orderId) {
      await prisma.order.updateMany({
        where: { id: orderId },
        data: {
          stripeCheckoutSession: session.id,
          stripePaymentIntent: typeof session.payment_intent === "string" ? session.payment_intent : null
        }
      });
      await unlockOrderEntitlements(orderId);
    }
  }

  res.json({ received: true });
});

app.use(express.json({ limit: "2mb" }));

type AuthUser = {
  id: string;
  role: Role;
  email: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function signToken(user: AuthUser) {
  return jwt.sign(user, jwtSecret, { expiresIn: "8h" });
}

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Missing authorization token" });
    return;
  }

  try {
    req.user = jwt.verify(token, jwtSecret) as AuthUser;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireRole(...roles: Role[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "You do not have permission to perform this action" });
      return;
    }
    next();
  };
}

async function requireActiveAccount(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: "Missing authorization token" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { status: true }
  });

  if (!user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  if (user.status === AccountStatus.PENDING_APPROVAL) {
    res.status(403).json({ error: "Your account is waiting for iLEAP Academy approval before this feature is available." });
    return;
  }

  if (user.status !== AccountStatus.ACTIVE) {
    res.status(403).json({ error: "This account is disabled. Contact iLEAP Academy for help." });
    return;
  }

  next();
}

async function writeAudit(actorId: string | undefined, action: "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "ACCESS_CHANGE" | "PROMPT_CHANGE" | "PAYMENT_EVENT", entityType: string, entityId?: string, metadata?: unknown) {
  await prisma.auditLog.create({
    data: {
      actorId,
      action,
      entityType,
      entityId,
      metadata: metadata ? JSON.stringify(metadata) : null
    }
  });
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");
}

function publicUser(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: string;
  student?: { level?: { id: string; code: string; name: string; gradeBand: string } } | null;
}) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    status: user.status,
    level: user.student?.level ?? null
  };
}

async function getStudentLevelId(userId: string) {
  const profile = await prisma.studentProfile.findUnique({ where: { userId } });
  return profile?.levelId ?? null;
}

type CurriculumScoped = {
  topic?: { id: string; levelId: string; isPublished: boolean } | null;
  lesson?: { id: string; isPublished: boolean; topic?: { id: string; levelId: string; isPublished: boolean } | null } | null;
};

function isCurriculumPublished(item: CurriculumScoped) {
  if (item.lesson) return Boolean(item.lesson.isPublished && item.lesson.topic?.isPublished);
  if (item.topic) return item.topic.isPublished;
  return true;
}

function canAccessResource(resource: Resource & CurriculumScoped, studentLevelId: string | null, entitlementIds: Set<string>) {
  if (!resource.isPublished) return false;
  if (!isCurriculumPublished(resource)) return false;
  if (resource.levelId && resource.levelId !== studentLevelId) return false;
  if (resource.accessMode === AccessMode.FREE) return true;
  if (resource.accessMode === AccessMode.LEVEL_ASSIGNED) return Boolean(resource.levelId && resource.levelId === studentLevelId);
  return entitlementIds.has(resource.id);
}

function resourceForClient<T extends Resource>(resource: T, isAccessible: boolean) {
  return {
    ...resource,
    isAccessible,
    url: isAccessible ? resource.url : null,
    fileKey: isAccessible ? resource.fileKey : null,
    originalFileName: isAccessible ? resource.originalFileName : null
  };
}

function productResourceForClient<T extends { resource: Resource }>(item: T) {
  return {
    ...item,
    resource: resourceForClient(item.resource, false)
  };
}

async function validateCurriculumScope(input: { levelId?: string | null; topicId?: string | null; lessonId?: string | null }) {
  const topicId = input.topicId || null;
  const lessonId = input.lessonId || null;
  const levelId = input.levelId || null;

  if (lessonId) {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { topic: true }
    });
    if (!lesson) return { error: "Selected lesson does not exist" };
    if (topicId && topicId !== lesson.topicId) return { error: "Selected lesson does not belong to the selected topic" };
    if (levelId && lesson.topic.levelId !== levelId) return { error: "Selected lesson does not belong to the selected level" };
  }

  if (topicId) {
    const topic = await prisma.topic.findUnique({ where: { id: topicId } });
    if (!topic) return { error: "Selected topic does not exist" };
    if (levelId && topic.levelId !== levelId) return { error: "Selected topic does not belong to the selected level" };
  }

  return { error: null };
}

async function resolveCurriculumLevelId(input: { levelId?: string | null; topicId?: string | null; lessonId?: string | null }) {
  if (input.levelId) return input.levelId;
  if (input.lessonId) {
    const lesson = await prisma.lesson.findUnique({ where: { id: input.lessonId }, include: { topic: true } });
    return lesson?.topic.levelId ?? null;
  }
  if (input.topicId) {
    const topic = await prisma.topic.findUnique({ where: { id: input.topicId } });
    return topic?.levelId ?? null;
  }
  return null;
}

async function validateTeacherLevelAccess(user: AuthUser, input: { levelId?: string | null; topicId?: string | null; lessonId?: string | null }) {
  if (user.role === "ADMIN") return null;

  const levelId = await resolveCurriculumLevelId(input);
  if (!levelId) return "Teachers must choose one of their assigned levels.";

  const teacher = await prisma.teacherProfile.findUnique({
    where: { userId: user.id },
    include: { levels: true }
  });
  const allowedLevelIds = teacher?.levels.map((item) => item.levelId) ?? [];
  return allowedLevelIds.includes(levelId) ? null : "You cannot manage resources for this level.";
}

function safeDownloadName(resource: Pick<Resource, "title" | "fileKey" | "originalFileName">) {
  const sourceName = resource.originalFileName || resource.title;
  const ext = resource.fileKey ? path.extname(resource.fileKey) : "";
  const hasExtension = path.extname(sourceName).length > 0;
  const filename = hasExtension ? sourceName : `${sourceName}${ext}`;
  return filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, "-").slice(0, 180) || `resource${ext}`;
}

function getMailTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

function hashResetToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function sendPasswordResetEmail(input: { to: string; name: string; resetUrl: string }) {
  const transport = getMailTransport();
  if (!transport) {
    console.warn("Password reset email skipped: SMTP_HOST, SMTP_USER, and SMTP_PASS are not configured.");
    return false;
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to: input.to,
    subject: "Reset your iLEAP Academy portal password",
    text: [
      `Hello ${input.name},`,
      "",
      "Use this link to reset your iLEAP Academy portal password. It expires in 1 hour and can be used only once.",
      "",
      input.resetUrl,
      "",
      "If you did not request this, you can ignore this email."
    ].join("\n")
  });

  return true;
}

async function sendSubmissionNotification(input: {
  to: string;
  studentName: string;
  studentEmail: string;
  assignmentTitle: string;
  levelName: string;
  wordCount: number;
  submittedText: string;
}) {
  const transport = getMailTransport();
  if (!transport) {
    console.warn("Submission notification skipped: SMTP_HOST, SMTP_USER, and SMTP_PASS are not configured.");
    return false;
  }

  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  const subject = `New iLEAP submission: ${input.assignmentTitle}`;
  const preview = input.submittedText.length > 1800 ? `${input.submittedText.slice(0, 1800)}...` : input.submittedText;

  await transport.sendMail({
    from,
    to: input.to,
    replyTo: input.studentEmail,
    subject,
    text: [
      "A student submitted homework in the iLEAP English Writing Portal.",
      "",
      `Student: ${input.studentName}`,
      `Student email: ${input.studentEmail}`,
      `Assignment: ${input.assignmentTitle}`,
      `Level: ${input.levelName}`,
      `Word count: ${input.wordCount}`,
      "",
      "Submission preview:",
      preview,
      "",
      `Portal: ${appUrl}`
    ].join("\n")
  });

  return true;
}

async function assertResourceAccess(resourceId: string, user: AuthUser) {
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    include: { topic: true, lesson: { include: { topic: true } } }
  });
  if (!resource) return null;
  if (user.role === "ADMIN" || user.role === "TEACHER") return resource;

  const studentLevelId = await getStudentLevelId(user.id);
  const entitlement = await prisma.entitlement.findFirst({
    where: { userId: user.id, resourceId: resource.id, isActive: true }
  });

  return canAccessResource(resource, studentLevelId, new Set(entitlement ? [resource.id] : [])) ? resource : null;
}

async function unlockOrderEntitlements(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: {
            include: { resources: true }
          }
        }
      }
    }
  });

  if (!order) return null;

  await prisma.order.update({ where: { id: order.id }, data: { status: "PAID" } });

  for (const item of order.items) {
    for (const productResource of item.product.resources) {
      await prisma.entitlement.upsert({
        where: {
          userId_resourceId_source: {
            userId: order.userId,
            resourceId: productResource.resourceId,
            source: "PURCHASE"
          }
        },
        update: { isActive: true },
        create: {
          userId: order.userId,
          resourceId: productResource.resourceId,
          source: "PURCHASE",
          isActive: true
        }
      });
    }
  }

  await writeAudit(undefined, "PAYMENT_EVENT", "Order", order.id, { status: "PAID" });
  return order;
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const forgotPasswordSchema = z.object({
  email: z.string().email()
});

const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8)
});

const resourceSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(2),
  type: z.enum(["DOCUMENT", "PDF", "WORKSHEET", "VIDEO_LINK", "BOOK"]),
  accessMode: z.enum(["FREE", "LEVEL_ASSIGNED", "INDIVIDUAL_PURCHASE", "BUNDLE_PURCHASE"]),
  url: z.string().url().optional().nullable(),
  fileKey: z.string().optional().nullable(),
  levelId: z.string().optional().nullable(),
  topicId: z.string().optional().nullable(),
  lessonId: z.string().optional().nullable(),
  isPublished: z.boolean().default(false)
});

const uploadedResourceSchema = resourceSchema.extend({
  isPublished: z.union([z.boolean(), z.string()]).transform((value) => value === true || value === "true")
});

const bulkUploadedResourcesSchema = z.object({
  description: z.string().min(2),
  type: z.enum(["DOCUMENT", "PDF", "WORKSHEET", "VIDEO_LINK", "BOOK"]),
  accessMode: z.enum(["FREE", "LEVEL_ASSIGNED"]),
  levelId: z.string().optional().nullable(),
  topicId: z.string().optional().nullable(),
  lessonId: z.string().optional().nullable(),
  isPublished: z.union([z.boolean(), z.string()]).transform((value) => value === true || value === "true")
});

const assignmentSchema = z.object({
  title: z.string().min(2),
  instructions: z.string().min(10),
  wordCountGuidance: z.string().max(80).optional().nullable(),
  levelId: z.string().min(1),
  topicId: z.string().optional().nullable(),
  lessonId: z.string().optional().nullable(),
  isPublished: z.boolean().default(false),
  isArchived: z.boolean().default(false),
  dueAt: z.string().optional().nullable()
});

const topicSchema = z.object({
  levelId: z.string().min(1),
  title: z.string().trim().min(2).max(120),
  description: z.string().max(500).optional().nullable(),
  sortOrder: z.coerce.number().int().min(1).default(1),
  isPublished: z.boolean().default(false)
});

const lessonSchema = z.object({
  topicId: z.string().min(1),
  title: z.string().trim().min(2).max(120),
  description: z.string().max(500).optional().nullable(),
  sortOrder: z.coerce.number().int().min(1).default(1),
  startsAt: z.string().optional().nullable(),
  endsAt: z.string().optional().nullable(),
  isPublished: z.boolean().default(false)
});

const productSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(2),
  type: z.enum(["INDIVIDUAL", "BUNDLE"]),
  priceCents: z.coerce.number().int().min(50),
  currency: z.string().min(3).max(3).default("usd"),
  levelId: z.string().optional().nullable(),
  resourceIds: z.array(z.string()).min(1),
  isActive: z.boolean().default(true)
});

const productUpdateSchema = productSchema.partial().extend({
  resourceIds: z.array(z.string()).min(1).optional()
});

const submissionSchema = z.object({
  studentId: z.string().optional(),
  assignmentId: z.string().optional().nullable(),
  pastedText: z.string().min(20).max(12000)
});

const aiPromptSchema = z.object({
  name: z.string().min(2),
  promptText: z.string().min(20)
});

const siteContentSchema = z.object({
  heroEyebrow: z.string().min(2).max(80),
  heroTitle: z.string().min(8).max(180),
  heroSubtitle: z.string().min(20).max(500),
  announcement: z.string().max(220).optional().nullable(),
  loginTitle: z.string().min(2).max(80),
  loginHint: z.string().min(2).max(220),
  signupTitle: z.string().min(2).max(80),
  signupHint: z.string().max(220).optional().nullable(),
  grade2Title: z.string().min(2).max(80),
  grade2Text: z.string().min(10).max(300),
  grade456Title: z.string().min(2).max(80),
  grade456Text: z.string().min(10).max(300),
  grade789Title: z.string().min(2).max(80),
  grade789Text: z.string().min(10).max(300)
});

const adminCreateUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(["STUDENT", "TEACHER", "ADMIN"]),
  levelId: z.string().optional().nullable(),
  teacherLevelIds: z.array(z.string()).optional().default([]),
  temporaryPassword: z.string().min(8).optional().default("Member123!")
});

const adminUpdateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  role: z.enum(["STUDENT", "TEACHER", "ADMIN"]).optional(),
  status: z.enum(["ACTIVE", "DISABLED", "PENDING_APPROVAL"]).optional(),
  levelId: z.string().optional().nullable(),
  teacherLevelIds: z.array(z.string()).optional()
});

const adminResetPasswordSchema = z.object({
  temporaryPassword: z.string().min(8).default("Member123!")
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8)
});

const teacherFeedbackSchema = z.object({
  teacherFeedback: z.string().min(1).max(8000)
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/public/levels", async (_req, res) => {
  const levels = await prisma.level.findMany({ orderBy: { sortOrder: "asc" } });
  res.json(levels);
});

app.get("/api/public/site-content", async (_req, res) => {
  const content = await prisma.siteContent.findUnique({ where: { id: "landing" } });
  res.json(content ?? defaultSiteContent);
});

app.get("/api/public/products", async (_req, res) => {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { level: true, resources: { include: { resource: true } } },
    orderBy: { createdAt: "desc" }
  });
  res.json(products.map((product) => ({
    ...product,
    resources: product.resources.map(productResourceForClient)
  })));
});

app.get("/api/public/curriculum", async (_req, res) => {
  const topics = await prisma.topic.findMany({
    where: { isPublished: true },
    include: {
      level: true,
      lessons: {
        where: { isPublished: true },
        orderBy: { sortOrder: "asc" }
      }
    },
    orderBy: [{ level: { sortOrder: "asc" } }, { sortOrder: "asc" }]
  });
  res.json(topics);
});

app.post("/api/auth/signup", async (req, res) => {
  res.status(404).json({ error: "Public student signup is closed. Please contact iLEAP Academy for access." });
});

app.post("/api/auth/login", async (req, res) => {
  const input = loginSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.flatten() });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email: input.data.email.toLowerCase() },
    include: { student: { include: { level: true } } }
  });

  if (!user || user.status === "DISABLED" || !(await bcrypt.compare(input.data.password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const authUser = { id: user.id, role: user.role, email: user.email };
  await writeAudit(user.id, "LOGIN", "User", user.id);

  res.json({ token: signToken(authUser), user: publicUser(user) });
});

app.post("/api/auth/forgot-password", async (req, res) => {
  const input = forgotPasswordSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.flatten() });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email: input.data.email.toLowerCase() } });
  if (user && user.status !== "DISABLED") {
    const token = crypto.randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashResetToken(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000)
      }
    });
    await sendPasswordResetEmail({
      to: user.email,
      name: `${user.firstName} ${user.lastName}`,
      resetUrl: `${appUrl}/?resetToken=${encodeURIComponent(token)}`
    });
    await writeAudit(undefined, "UPDATE", "User", user.id, { forgotPassword: true });
  }

  res.json({ ok: true });
});

app.post("/api/auth/reset-password", async (req, res) => {
  const input = resetPasswordSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.flatten() });
    return;
  }

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(input.data.token) },
    include: { user: true }
  });
  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date() || resetToken.user.status === "DISABLED") {
    res.status(400).json({ error: "This reset link is invalid or expired." });
    return;
  }

  const passwordHash = await bcrypt.hash(input.data.password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.updateMany({
      where: { userId: resetToken.userId, usedAt: null, id: { not: resetToken.id } },
      data: { usedAt: new Date() }
    })
  ]);
  await writeAudit(undefined, "UPDATE", "User", resetToken.userId, { resetPassword: true });
  res.json({ ok: true });
});

app.get("/api/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { student: { include: { level: true } } }
  });
  res.json(user ? publicUser(user) : null);
});

app.post("/api/me/change-password", requireAuth, async (req, res) => {
  const input = changePasswordSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.flatten() });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user || !(await bcrypt.compare(input.data.currentPassword, user.passwordHash))) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }

  const passwordHash = await bcrypt.hash(input.data.newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  await writeAudit(req.user?.id, "UPDATE", "User", user.id, { changePassword: true });
  res.json({ ok: true });
});

app.get("/api/dashboard", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { student: { include: { level: true } }, teacher: { include: { levels: { include: { level: true } } } } }
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const levels = await prisma.level.findMany({ orderBy: { sortOrder: "asc" } });
  const studentLevelId = user.role === "STUDENT" ? user.student?.levelId ?? null : null;
  const teacherLevelIds = user.teacher?.levels.map((item) => item.levelId) ?? [];
  const curriculumWhere =
    user.role === "STUDENT"
      ? { levelId: studentLevelId ?? "", isPublished: true }
      : user.role === "TEACHER"
        ? { levelId: { in: teacherLevelIds } }
        : {};
  const curriculum = await prisma.topic.findMany({
    where: curriculumWhere,
    include: {
      level: true,
      lessons: {
        where: user.role === "STUDENT" ? { isPublished: true } : {},
        orderBy: { sortOrder: "asc" }
      }
    },
    orderBy: [{ level: { sortOrder: "asc" } }, { sortOrder: "asc" }]
  });

  if (user.status === "PENDING_APPROVAL") {
    res.json({
      user: publicUser(user),
      levels,
      teacherLevels: user.teacher?.levels.map((item) => item.level) ?? [],
      curriculum,
      resources: [],
      assignments: [],
      products: [],
      submissions: [],
      notificationRecipients: []
    });
    return;
  }

  if (user.status !== "ACTIVE") {
    res.status(403).json({ error: "This account is disabled. Contact iLEAP Academy for help." });
    return;
  }

  const entitlements = await prisma.entitlement.findMany({
    where: { userId: user.id, isActive: true },
    select: { resourceId: true }
  });
  const entitlementIds = new Set(entitlements.map((item) => item.resourceId));

  const resourceWhere =
    user.role === "STUDENT"
      ? { isPublished: true, OR: [{ levelId: null }, { levelId: studentLevelId ?? "" }] }
      : user.role === "TEACHER"
        ? { levelId: { in: teacherLevelIds } }
        : {};

  const allResources = await prisma.resource.findMany({
    where: resourceWhere,
    include: { level: true, topic: true, lesson: { include: { topic: true } } },
    orderBy: { createdAt: "desc" }
  });

  const resources =
    user.role === "STUDENT"
      ? allResources
          .filter(isCurriculumPublished)
          .map((resource) => resourceForClient(resource, canAccessResource(resource, studentLevelId, entitlementIds)))
      : allResources.map((resource) => resourceForClient(resource, true));

  const assignmentWhere =
    user.role === "STUDENT"
      ? { isPublished: true, isArchived: false, levelId: studentLevelId ?? "" }
      : user.role === "TEACHER"
        ? { levelId: { in: teacherLevelIds } }
        : {};

  const allAssignments = await prisma.assignment.findMany({
    where: assignmentWhere,
    include: { level: true, topic: true, lesson: { include: { topic: true } }, _count: { select: { submissions: true } } },
    orderBy: { createdAt: "desc" }
  });
  const assignments = user.role === "STUDENT" ? allAssignments.filter(isCurriculumPublished) : allAssignments;

  const productWhere =
    user.role === "ADMIN"
      ? {}
      : user.role === "STUDENT"
        ? { isActive: true, OR: [{ levelId: null }, { levelId: studentLevelId ?? "" }] }
        : { isActive: true, OR: [{ levelId: null }, { levelId: { in: teacherLevelIds } }] };
  const products = await prisma.product.findMany({
    where: productWhere,
    include: { level: true, resources: { include: { resource: true } } },
    orderBy: { createdAt: "desc" }
  });
  const productsWithPurchaseStatus = products.map((product) => ({
    ...product,
    resources: product.resources.map(productResourceForClient),
    isPurchased: product.resources.some((item) => entitlementIds.has(item.resourceId))
  }));

  const submissionWhere =
    user.role === "STUDENT"
      ? { studentId: user.id }
      : user.role === "TEACHER"
        ? {
            OR: [
              { levelId: { in: teacherLevelIds } },
              { assignment: { levelId: { in: teacherLevelIds } } }
            ]
          }
        : {};
  const submissions = await prisma.writingSubmission.findMany({
    where: submissionWhere,
    include: {
      assignment: { include: { level: true, topic: true, lesson: { include: { topic: true } } } },
      feedback: true,
      student: user.role === "STUDENT"
        ? false
        : { select: { id: true, firstName: true, lastName: true, email: true, student: { include: { level: true } } } }
    },
    orderBy: { createdAt: "desc" },
    take: user.role === "STUDENT" ? 10 : 50
  });
  const assignedTeachers = studentLevelId
    ? await prisma.user.findMany({
        where: {
          role: "TEACHER",
          status: "ACTIVE",
          teacher: { levels: { some: { levelId: studentLevelId } } }
        },
        select: { id: true, email: true, firstName: true, lastName: true },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }]
      })
    : [];

  res.json({
    user: publicUser(user),
    levels,
    teacherLevels: user.teacher?.levels.map((item) => item.level) ?? [],
    curriculum,
    resources,
    assignments,
    products: productsWithPurchaseStatus,
    submissions,
    notificationRecipients: [
      { id: "office", email: defaultNotificationEmail, firstName: "iLEAP", lastName: "Office" },
      ...assignedTeachers
    ]
  });
});

app.post("/api/admin/topics", requireAuth, requireActiveAccount, requireRole("ADMIN", "TEACHER"), async (req, res) => {
  const input = topicSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.flatten() });
    return;
  }

  if (req.user!.role === "TEACHER") {
    const teacher = await prisma.teacherProfile.findUnique({ where: { userId: req.user!.id }, include: { levels: true } });
    const allowedLevelIds = teacher?.levels.map((item) => item.levelId) ?? [];
    if (!allowedLevelIds.includes(input.data.levelId)) {
      res.status(403).json({ error: "You cannot create topics for this level" });
      return;
    }
  }

  try {
    const topic = await prisma.topic.create({
      data: {
        ...input.data,
        description: input.data.description || null
      },
      include: { level: true, lessons: true }
    });
    await writeAudit(req.user?.id, "CREATE", "Topic", topic.id, { title: topic.title, levelId: topic.levelId });
    res.status(201).json(topic);
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      res.status(409).json({ error: "A topic with this title already exists for this level." });
      return;
    }
    throw err;
  }
});

app.put("/api/admin/topics/:id", requireAuth, requireActiveAccount, requireRole("ADMIN", "TEACHER"), async (req, res) => {
  const input = topicSchema.partial().safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.flatten() });
    return;
  }

  const existing = await prisma.topic.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) {
    res.status(404).json({ error: "Topic not found" });
    return;
  }

  const targetLevelId = input.data.levelId ?? existing.levelId;
  if (req.user!.role === "TEACHER") {
    const teacher = await prisma.teacherProfile.findUnique({ where: { userId: req.user!.id }, include: { levels: true } });
    const allowedLevelIds = teacher?.levels.map((item) => item.levelId) ?? [];
    if (!allowedLevelIds.includes(existing.levelId) || !allowedLevelIds.includes(targetLevelId)) {
      res.status(403).json({ error: "You cannot edit this topic level" });
      return;
    }
  }

  const topic = await prisma.topic.update({
    where: { id: existing.id },
    data: {
      title: input.data.title,
      description: input.data.description === "" ? null : input.data.description,
      sortOrder: input.data.sortOrder,
      levelId: input.data.levelId,
      isPublished: input.data.isPublished
    },
    include: { level: true, lessons: { orderBy: { sortOrder: "asc" } } }
  });
  await writeAudit(req.user?.id, "UPDATE", "Topic", topic.id, { title: topic.title, isPublished: topic.isPublished });
  res.json(topic);
});

app.delete("/api/admin/topics/:id", requireAuth, requireActiveAccount, requireRole("ADMIN"), async (req, res) => {
  const topic = await prisma.topic.findUnique({
    where: { id: String(req.params.id) },
    include: { _count: { select: { resources: true, assignments: true, lessons: true } } }
  });
  if (!topic) {
    res.status(404).json({ error: "Topic not found" });
    return;
  }
  if (topic._count.resources > 0 || topic._count.assignments > 0 || topic._count.lessons > 0) {
    res.status(409).json({ error: "Move or delete this topic's lessons, resources, and assignments before deleting it." });
    return;
  }
  await prisma.topic.delete({ where: { id: topic.id } });
  await writeAudit(req.user?.id, "DELETE", "Topic", topic.id, { title: topic.title });
  res.json({ ok: true });
});

app.post("/api/admin/lessons", requireAuth, requireActiveAccount, requireRole("ADMIN", "TEACHER"), async (req, res) => {
  const input = lessonSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.flatten() });
    return;
  }

  const topic = await prisma.topic.findUnique({ where: { id: input.data.topicId } });
  if (!topic) {
    res.status(400).json({ error: "Selected topic does not exist" });
    return;
  }
  if (req.user!.role === "TEACHER") {
    const teacher = await prisma.teacherProfile.findUnique({ where: { userId: req.user!.id }, include: { levels: true } });
    const allowedLevelIds = teacher?.levels.map((item) => item.levelId) ?? [];
    if (!allowedLevelIds.includes(topic.levelId)) {
      res.status(403).json({ error: "You cannot create lessons for this topic" });
      return;
    }
  }

  try {
    const lesson = await prisma.lesson.create({
      data: {
        title: input.data.title,
        description: input.data.description || null,
        sortOrder: input.data.sortOrder,
        startsAt: input.data.startsAt ? new Date(input.data.startsAt) : null,
        endsAt: input.data.endsAt ? new Date(input.data.endsAt) : null,
        isPublished: input.data.isPublished,
        topicId: input.data.topicId
      },
      include: { topic: { include: { level: true } } }
    });
    await writeAudit(req.user?.id, "CREATE", "Lesson", lesson.id, { title: lesson.title, topicId: lesson.topicId });
    res.status(201).json(lesson);
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      res.status(409).json({ error: "A lesson with this title already exists for this topic." });
      return;
    }
    throw err;
  }
});

app.put("/api/admin/lessons/:id", requireAuth, requireActiveAccount, requireRole("ADMIN", "TEACHER"), async (req, res) => {
  const input = lessonSchema.partial().safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.flatten() });
    return;
  }

  const existing = await prisma.lesson.findUnique({ where: { id: String(req.params.id) }, include: { topic: true } });
  if (!existing) {
    res.status(404).json({ error: "Lesson not found" });
    return;
  }
  const targetTopic = input.data.topicId
    ? await prisma.topic.findUnique({ where: { id: input.data.topicId } })
    : existing.topic;
  if (!targetTopic) {
    res.status(400).json({ error: "Selected topic does not exist" });
    return;
  }
  if (req.user!.role === "TEACHER") {
    const teacher = await prisma.teacherProfile.findUnique({ where: { userId: req.user!.id }, include: { levels: true } });
    const allowedLevelIds = teacher?.levels.map((item) => item.levelId) ?? [];
    if (!allowedLevelIds.includes(existing.topic.levelId) || !allowedLevelIds.includes(targetTopic.levelId)) {
      res.status(403).json({ error: "You cannot edit this lesson topic" });
      return;
    }
  }

  const lesson = await prisma.lesson.update({
    where: { id: existing.id },
    data: {
      title: input.data.title,
      description: input.data.description === "" ? null : input.data.description,
      sortOrder: input.data.sortOrder,
      startsAt: input.data.startsAt ? new Date(input.data.startsAt) : input.data.startsAt === null || input.data.startsAt === "" ? null : undefined,
      endsAt: input.data.endsAt ? new Date(input.data.endsAt) : input.data.endsAt === null || input.data.endsAt === "" ? null : undefined,
      isPublished: input.data.isPublished,
      topicId: input.data.topicId
    },
    include: { topic: { include: { level: true } } }
  });
  await writeAudit(req.user?.id, "UPDATE", "Lesson", lesson.id, { title: lesson.title, isPublished: lesson.isPublished });
  res.json(lesson);
});

app.delete("/api/admin/lessons/:id", requireAuth, requireActiveAccount, requireRole("ADMIN"), async (req, res) => {
  const lesson = await prisma.lesson.findUnique({
    where: { id: String(req.params.id) },
    include: { _count: { select: { resources: true, assignments: true } } }
  });
  if (!lesson) {
    res.status(404).json({ error: "Lesson not found" });
    return;
  }
  if (lesson._count.resources > 0 || lesson._count.assignments > 0) {
    res.status(409).json({ error: "Move or delete this lesson's resources and assignments before deleting it." });
    return;
  }
  await prisma.lesson.delete({ where: { id: lesson.id } });
  await writeAudit(req.user?.id, "DELETE", "Lesson", lesson.id, { title: lesson.title });
  res.json({ ok: true });
});

app.post("/api/admin/resources", requireAuth, requireActiveAccount, requireRole("ADMIN", "TEACHER"), async (req, res) => {
  const input = resourceSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.flatten() });
    return;
  }

  const scope = await validateCurriculumScope(input.data);
  if (scope.error) {
    res.status(400).json({ error: scope.error });
    return;
  }

  const teacherAccessError = await validateTeacherLevelAccess(req.user!, input.data);
  if (teacherAccessError) {
    res.status(403).json({ error: teacherAccessError });
    return;
  }

  const resource = await prisma.resource.create({ data: input.data });
  await writeAudit(req.user?.id, "CREATE", "Resource", resource.id, { title: resource.title });
  res.status(201).json(resource);
});

app.post("/api/admin/resources/upload", requireAuth, requireActiveAccount, requireRole("ADMIN", "TEACHER"), upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "File is required" });
    return;
  }

  const stored = await saveUploadedFile(req.file);
  const input = uploadedResourceSchema.safeParse({
    ...req.body,
    fileKey: stored.fileKey,
    url: req.body.url || null,
    levelId: req.body.levelId || null,
    topicId: req.body.topicId || null,
    lessonId: req.body.lessonId || null
  });

  if (!input.success) {
    res.status(400).json({ error: input.error.flatten() });
    return;
  }

  const scope = await validateCurriculumScope(input.data);
  if (scope.error) {
    res.status(400).json({ error: scope.error });
    return;
  }

  const teacherAccessError = await validateTeacherLevelAccess(req.user!, input.data);
  if (teacherAccessError) {
    res.status(403).json({ error: teacherAccessError });
    return;
  }

  const resource = await prisma.resource.create({
    data: {
      title: input.data.title,
      description: input.data.description,
      type: input.data.type,
      accessMode: input.data.accessMode,
      url: input.data.url,
      fileKey: input.data.fileKey,
      originalFileName: stored.originalName,
      levelId: input.data.levelId,
      topicId: input.data.topicId,
      lessonId: input.data.lessonId,
      isPublished: input.data.isPublished
    }
  });

  await writeAudit(req.user?.id, "CREATE", "Resource", resource.id, {
    title: resource.title,
    fileKey: resource.fileKey,
    originalName: stored.originalName,
    mimeType: stored.mimeType,
    size: stored.size
  });
  res.status(201).json(resource);
});

app.post("/api/admin/resources/bulk-upload", requireAuth, requireActiveAccount, requireRole("ADMIN", "TEACHER"), upload.array("files", 30), async (req, res) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    res.status(400).json({ error: "Choose at least one file." });
    return;
  }

  const input = bulkUploadedResourcesSchema.safeParse({
    ...req.body,
    levelId: req.body.levelId || null,
    topicId: req.body.topicId || null,
    lessonId: req.body.lessonId || null
  });
  if (!input.success) {
    res.status(400).json({ error: input.error.flatten() });
    return;
  }

  const scope = await validateCurriculumScope(input.data);
  if (scope.error) {
    res.status(400).json({ error: scope.error });
    return;
  }

  const teacherAccessError = await validateTeacherLevelAccess(req.user!, input.data);
  if (teacherAccessError) {
    res.status(403).json({ error: teacherAccessError });
    return;
  }

  const created = [];
  for (const file of files) {
    const stored = await saveUploadedFile(file);
    const title = path.basename(stored.originalName, path.extname(stored.originalName)).replace(/[_-]+/g, " ").trim() || stored.originalName;
    const resource = await prisma.resource.create({
      data: {
        title,
        description: input.data.description,
        type: input.data.type,
        accessMode: input.data.accessMode,
        fileKey: stored.fileKey,
        originalFileName: stored.originalName,
        levelId: input.data.levelId,
        topicId: input.data.topicId,
        lessonId: input.data.lessonId,
        isPublished: input.data.isPublished
      }
    });
    created.push(resource);
    await writeAudit(req.user?.id, "CREATE", "Resource", resource.id, {
      title: resource.title,
      fileKey: resource.fileKey,
      originalName: stored.originalName,
      bulkUpload: true
    });
  }

  res.status(201).json(created);
});

app.put("/api/admin/resources/:id", requireAuth, requireActiveAccount, requireRole("ADMIN", "TEACHER"), async (req, res) => {
  const input = resourceSchema.partial().safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.flatten() });
    return;
  }

  const resource = await prisma.resource.findUnique({ where: { id: String(req.params.id) } });
  if (!resource) {
    res.status(404).json({ error: "Resource not found" });
    return;
  }

  if (req.user!.role === "TEACHER") {
    const teacher = await prisma.teacherProfile.findUnique({
      where: { userId: req.user!.id },
      include: { levels: true }
    });
    const allowedLevelIds = teacher?.levels.map((item) => item.levelId) ?? [];
    const targetLevelId = input.data.levelId ?? resource.levelId;
    if ((resource.levelId && !allowedLevelIds.includes(resource.levelId)) || (targetLevelId && !allowedLevelIds.includes(targetLevelId))) {
      res.status(403).json({ error: "You cannot edit this resource level" });
      return;
    }
  }

  const scope = await validateCurriculumScope({
    levelId: input.data.levelId ?? resource.levelId,
    topicId: input.data.topicId ?? resource.topicId,
    lessonId: input.data.lessonId ?? resource.lessonId
  });
  if (scope.error) {
    res.status(400).json({ error: scope.error });
    return;
  }

  const updated = await prisma.resource.update({
    where: { id: resource.id },
    data: input.data,
    include: { level: true, topic: true, lesson: { include: { topic: true } } }
  });

  await writeAudit(req.user?.id, "UPDATE", "Resource", updated.id, {
    title: updated.title,
    isPublished: updated.isPublished
  });
  res.json({ ...updated, isAccessible: true });
});

app.delete("/api/admin/resources/:id", requireAuth, requireActiveAccount, requireRole("ADMIN"), async (req, res) => {
  const resource = await prisma.resource.findUnique({
    where: { id: String(req.params.id) },
    include: {
      _count: { select: { products: true, entitlements: true } }
    }
  });
  if (!resource) {
    res.status(404).json({ error: "Resource not found" });
    return;
  }

  await prisma.resource.delete({ where: { id: resource.id } });
  if (resource.fileKey) {
    await deleteStoredFile(resource.fileKey);
  }
  await writeAudit(req.user?.id, "DELETE", "Resource", resource.id, {
    title: resource.title,
    removedProductLinks: resource._count.products,
    removedAccessRecords: resource._count.entitlements
  });
  res.json({ ok: true });
});

app.get("/api/resources/:id/open", requireAuth, requireActiveAccount, async (req, res) => {
  const resource = await assertResourceAccess(String(req.params.id), req.user!);
  if (!resource) {
    res.status(404).json({ error: "Resource not found or not accessible" });
    return;
  }

  if (resource.url && !resource.fileKey) {
    res.json({ type: "url", url: resource.url });
    return;
  }

  if (!resource.fileKey) {
    res.status(404).json({ error: "Resource file is not available" });
    return;
  }

  try {
    const downloaded = await downloadStoredFile(resource.fileKey);
    if (downloaded.contentType) res.type(downloaded.contentType);
    res.attachment(safeDownloadName(resource));
    res.send(downloaded.buffer);
  } catch (error) {
    console.error("Resource download failed", error);
    res.status(400).json({ error: "Resource file could not be downloaded" });
  }
});

app.post("/api/admin/assignments", requireAuth, requireActiveAccount, requireRole("ADMIN", "TEACHER"), async (req, res) => {
  const input = assignmentSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.flatten() });
    return;
  }

  const scope = await validateCurriculumScope(input.data);
  if (scope.error) {
    res.status(400).json({ error: scope.error });
    return;
  }

  const assignment = await prisma.assignment.create({
    data: {
      ...input.data,
      wordCountGuidance: input.data.wordCountGuidance || null,
      dueAt: input.data.dueAt ? new Date(input.data.dueAt) : null
    }
  });
  await writeAudit(req.user?.id, "CREATE", "Assignment", assignment.id, { title: assignment.title });
  res.status(201).json(assignment);
});

app.put("/api/admin/assignments/:id", requireAuth, requireActiveAccount, requireRole("ADMIN", "TEACHER"), async (req, res) => {
  const input = assignmentSchema.partial().safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.flatten() });
    return;
  }

  const assignment = await prisma.assignment.findUnique({ where: { id: String(req.params.id) } });
  if (!assignment) {
    res.status(404).json({ error: "Assignment not found" });
    return;
  }

  if (req.user!.role === "TEACHER") {
    const teacher = await prisma.teacherProfile.findUnique({
      where: { userId: req.user!.id },
      include: { levels: true }
    });
    const allowedLevelIds = teacher?.levels.map((item) => item.levelId) ?? [];
    const targetLevelId = input.data.levelId ?? assignment.levelId;
    if (!allowedLevelIds.includes(assignment.levelId) || !allowedLevelIds.includes(targetLevelId)) {
      res.status(403).json({ error: "You cannot edit this assignment level" });
      return;
    }
  }

  const scope = await validateCurriculumScope({
    levelId: input.data.levelId ?? assignment.levelId,
    topicId: input.data.topicId ?? assignment.topicId,
    lessonId: input.data.lessonId ?? assignment.lessonId
  });
  if (scope.error) {
    res.status(400).json({ error: scope.error });
    return;
  }

  const updated = await prisma.assignment.update({
    where: { id: assignment.id },
    data: {
      title: input.data.title,
      instructions: input.data.instructions,
      wordCountGuidance: input.data.wordCountGuidance === "" ? null : input.data.wordCountGuidance,
      levelId: input.data.levelId,
      topicId: input.data.topicId,
      lessonId: input.data.lessonId,
      isPublished: input.data.isPublished,
      isArchived: input.data.isArchived,
      dueAt: input.data.dueAt ? new Date(input.data.dueAt) : input.data.dueAt === null || input.data.dueAt === "" ? null : undefined
    },
    include: { level: true, topic: true, lesson: { include: { topic: true } }, _count: { select: { submissions: true } } }
  });

  await writeAudit(req.user?.id, "UPDATE", "Assignment", updated.id, { title: updated.title });
  res.json(updated);
});

app.delete("/api/admin/assignments/:id", requireAuth, requireActiveAccount, requireRole("ADMIN", "TEACHER"), async (req, res) => {
  const assignment = await prisma.assignment.findUnique({
    where: { id: String(req.params.id) },
    include: { _count: { select: { submissions: true } } }
  });
  if (!assignment) {
    res.status(404).json({ error: "Assignment not found" });
    return;
  }

  if (req.user!.role === "TEACHER") {
    const teacher = await prisma.teacherProfile.findUnique({
      where: { userId: req.user!.id },
      include: { levels: true }
    });
    const allowedLevelIds = teacher?.levels.map((item) => item.levelId) ?? [];
    if (!allowedLevelIds.includes(assignment.levelId)) {
      res.status(403).json({ error: "You cannot delete this assignment level" });
      return;
    }
  }

  if (assignment._count.submissions > 0) {
    res.status(409).json({
      error: "This assignment already has student submissions. Archive it instead of deleting it."
    });
    return;
  }

  await prisma.assignment.delete({ where: { id: assignment.id } });
  await writeAudit(req.user?.id, "DELETE", "Assignment", assignment.id, { title: assignment.title });
  res.json({ ok: true });
});

app.post("/api/admin/products", requireAuth, requireActiveAccount, requireRole("ADMIN"), async (req, res) => {
  const input = productSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.flatten() });
    return;
  }

  const resources = await prisma.resource.findMany({ where: { id: { in: input.data.resourceIds } } });
  if (resources.length !== input.data.resourceIds.length) {
    res.status(400).json({ error: "One or more selected resources do not exist" });
    return;
  }

  const product = await prisma.product.create({
    data: {
      title: input.data.title,
      description: input.data.description,
      type: input.data.type,
      priceCents: input.data.priceCents,
      currency: input.data.currency.toLowerCase(),
      levelId: input.data.levelId,
      isActive: input.data.isActive,
      resources: {
        create: input.data.resourceIds.map((resourceId) => ({ resourceId }))
      }
    },
    include: { level: true, resources: { include: { resource: true } } }
  });

  await writeAudit(req.user?.id, "CREATE", "Product", product.id, { title: product.title, priceCents: product.priceCents });
  res.status(201).json(product);
});

app.put("/api/admin/products/:id", requireAuth, requireActiveAccount, requireRole("ADMIN"), async (req, res) => {
  const input = productUpdateSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.flatten() });
    return;
  }

  const existing = await prisma.product.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  if (input.data.resourceIds) {
    const resources = await prisma.resource.findMany({ where: { id: { in: input.data.resourceIds } } });
    if (resources.length !== input.data.resourceIds.length) {
      res.status(400).json({ error: "One or more selected resources do not exist" });
      return;
    }
  }

  const product = await prisma.product.update({
    where: { id: existing.id },
    data: {
      title: input.data.title,
      description: input.data.description,
      type: input.data.type,
      priceCents: input.data.priceCents,
      currency: input.data.currency?.toLowerCase(),
      levelId: input.data.levelId,
      isActive: input.data.isActive,
      resources: input.data.resourceIds
        ? {
            deleteMany: {},
            create: input.data.resourceIds.map((resourceId) => ({ resourceId }))
          }
        : undefined
    },
    include: { level: true, resources: { include: { resource: true } } }
  });

  await writeAudit(req.user?.id, "UPDATE", "Product", product.id, { title: product.title, priceCents: product.priceCents });
  res.json(product);
});

app.get("/api/admin/orders", requireAuth, requireActiveAccount, requireRole("ADMIN"), async (_req, res) => {
  const orders = await prisma.order.findMany({
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true, student: { include: { level: true } } } },
      items: { include: { product: { include: { level: true, resources: { include: { resource: true } } } } } }
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  res.json(orders);
});

app.post("/api/shop/checkout", requireAuth, requireActiveAccount, requireRole("STUDENT", "ADMIN"), async (req, res) => {
  const input = z.object({ productId: z.string() }).safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.flatten() });
    return;
  }

  if (!stripe) {
    res.status(503).json({ error: "Stripe is not configured. Add STRIPE_SECRET_KEY to the server environment." });
    return;
  }

  const product = await prisma.product.findUnique({
    where: { id: input.data.productId },
    include: { resources: true }
  });
  if (!product || !product.isActive) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  if (req.user!.role === "STUDENT") {
    const studentLevelId = await getStudentLevelId(req.user!.id);
    if (product.levelId && product.levelId !== studentLevelId) {
      res.status(403).json({ error: "This product is not available for your level." });
      return;
    }
  }

  const existingEntitlements = await prisma.entitlement.findMany({
    where: {
      userId: req.user!.id,
      isActive: true,
      resourceId: { in: product.resources.map((item) => item.resourceId) }
    },
    select: { resourceId: true }
  });
  const existingResourceIds = new Set(existingEntitlements.map((item) => item.resourceId));
  if (product.resources.length > 0 && product.resources.every((item) => existingResourceIds.has(item.resourceId))) {
    res.status(409).json({ error: "You already have access to this product." });
    return;
  }

  const order = await prisma.order.create({
    data: {
      userId: req.user!.id,
      totalCents: product.priceCents,
      currency: product.currency,
      items: {
        create: {
          productId: product.id,
          titleSnapshot: product.title,
          priceCentsSnapshot: product.priceCents
        }
      }
    },
    include: { items: true }
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: product.currency,
          unit_amount: product.priceCents,
          product_data: {
            name: product.title,
            description: product.description
          }
        }
      }
    ],
    metadata: {
      orderId: order.id,
      userId: req.user!.id,
      productId: product.id
    },
    success_url: `${appUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/?checkout=cancelled`
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { stripeCheckoutSession: session.id }
  });
  await writeAudit(req.user?.id, "CREATE", "Order", order.id, { productId: product.id, checkoutSession: session.id });

  res.status(201).json({ checkoutUrl: session.url, orderId: order.id });
});

app.post("/api/shop/checkout/confirm", requireAuth, requireActiveAccount, requireRole("STUDENT", "ADMIN"), async (req, res) => {
  const input = z.object({ sessionId: z.string().min(1) }).safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.flatten() });
    return;
  }

  if (!stripe) {
    res.status(503).json({ error: "Stripe is not configured. Add STRIPE_SECRET_KEY to the server environment." });
    return;
  }

  const session = await stripe.checkout.sessions.retrieve(input.data.sessionId);
  const orderId = session.metadata?.orderId;
  const userId = session.metadata?.userId;
  if (!orderId || userId !== req.user!.id) {
    res.status(403).json({ error: "This checkout session does not belong to your account." });
    return;
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.userId !== req.user!.id) {
    res.status(404).json({ error: "Order not found." });
    return;
  }

  if (session.payment_status !== "paid") {
    res.status(409).json({ error: "Payment is not complete yet." });
    return;
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      stripeCheckoutSession: session.id,
      stripePaymentIntent: typeof session.payment_intent === "string" ? session.payment_intent : null
    }
  });
  await unlockOrderEntitlements(order.id);
  res.json({ ok: true });
});

app.get("/api/shop/orders", requireAuth, requireActiveAccount, requireRole("STUDENT", "ADMIN"), async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.user!.id },
    include: {
      items: { include: { product: { include: { level: true, resources: { include: { resource: true } } } } } }
    },
    orderBy: { createdAt: "desc" },
    take: 50
  });
  res.json(orders);
});

app.post("/api/student/homework", requireAuth, requireActiveAccount, requireRole("STUDENT"), async (req, res) => {
  const input = z.object({
    assignmentId: z.string().min(1),
    pastedText: z.string().min(20).max(12000),
    notificationRecipientEmail: z.string().email().optional().nullable()
  }).safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.flatten() });
    return;
  }

  const levelId = await getStudentLevelId(req.user!.id);
  const assignment = await prisma.assignment.findUnique({
    where: { id: input.data.assignmentId },
    include: { level: true, topic: true, lesson: { include: { topic: true } } }
  });
  if (!assignment || !assignment.isPublished || !isCurriculumPublished(assignment) || assignment.levelId !== levelId) {
    res.status(403).json({ error: "Assignment is not available for your level" });
    return;
  }

  const student = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { email: true, firstName: true, lastName: true }
  });
  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }

  let recipientEmail = defaultNotificationEmail;
  if (input.data.notificationRecipientEmail && input.data.notificationRecipientEmail !== defaultNotificationEmail) {
    const teacher = await prisma.user.findFirst({
      where: {
        email: input.data.notificationRecipientEmail.toLowerCase(),
        role: "TEACHER",
        status: "ACTIVE",
        teacher: { levels: { some: { levelId: assignment.levelId } } }
      },
      select: { email: true }
    });
    if (!teacher) {
      res.status(400).json({ error: "Selected teacher is not assigned to this level" });
      return;
    }
    recipientEmail = teacher.email;
  }

  const submission = await prisma.writingSubmission.create({
    data: {
      studentId: req.user!.id,
      assignmentId: assignment.id,
      pastedText: input.data.pastedText,
      levelId
    }
  });

  let notificationSent = false;
  try {
    notificationSent = await sendSubmissionNotification({
      to: recipientEmail,
      studentName: `${student.firstName} ${student.lastName}`,
      studentEmail: student.email,
      assignmentTitle: assignment.title,
      levelName: assignment.level.gradeBand,
      wordCount: input.data.pastedText.trim().split(/\s+/).filter(Boolean).length,
      submittedText: input.data.pastedText
    });
  } catch (err) {
    console.error("Submission notification failed", err);
  }

  await writeAudit(req.user?.id, "CREATE", "WritingSubmission", submission.id, {
    source: "student_homework",
    notificationRecipientEmail: recipientEmail,
    notificationSent
  });
  res.status(201).json({ submission, notificationSent });
});

app.post("/api/student/submissions", requireAuth, requireActiveAccount, requireRole("TEACHER", "ADMIN"), async (req, res) => {
  try {
    const input = submissionSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ error: input.error.flatten() });
      return;
    }

    const targetStudentId = input.data.studentId;
    if (!targetStudentId) {
      res.status(400).json({ error: "studentId is required for AI tutor feedback" });
      return;
    }

    const targetStudent = await prisma.user.findUnique({
      where: { id: targetStudentId },
      include: { student: true }
    });
    if (!targetStudent?.student) {
      res.status(404).json({ error: "Student not found" });
      return;
    }
    if (targetStudent.status !== AccountStatus.ACTIVE) {
      res.status(403).json({ error: "This student account is not active." });
      return;
    }

    if (req.user!.role === "TEACHER") {
      const teacher = await prisma.teacherProfile.findUnique({
        where: { userId: req.user!.id },
        include: { levels: true }
      });
      const allowedLevelIds = teacher?.levels.map((item) => item.levelId) ?? [];
      if (!allowedLevelIds.includes(targetStudent.student.levelId)) {
        res.status(403).json({ error: "You cannot submit AI feedback for this student's level" });
        return;
      }
    }

    const activePrompt = await prisma.aiPrompt.findFirst({ where: { isActive: true }, orderBy: { version: "desc" } });
    const levelId = targetStudent.student.levelId;

    const submission = await prisma.writingSubmission.create({
      data: {
        studentId: targetStudent.id,
        assignmentId: input.data.assignmentId || null,
        pastedText: input.data.pastedText,
        levelId
      }
    });

    const fallbackFeedback = {
      markOutOf10: null,
      content: "AI tutor is not configured yet. Your writing was saved, and this placeholder shows the feedback format.",
      grammarAndPunctuation: "The live AI tutor will identify grammar and punctuation mistakes and explain why they should be corrected.",
      academicVocabulary: "The live AI tutor will suggest stronger academic vocabulary where appropriate.",
      structure: "The live AI tutor will review paragraph and essay structure.",
      goodTransitionWords: "The live AI tutor will suggest useful transition words.",
      overall: "Configure OPENAI_API_KEY and the active prompt to generate live feedback."
    };

    let feedbackJson = JSON.stringify(fallbackFeedback);
    let model: string | null = null;
    let error: string | null = null;

    if (openai && activePrompt) {
      model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
      try {
        const completion = await openai.chat.completions.create({
          model,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                activePrompt.promptText +
                "\nReturn valid JSON only with these exact keys: markOutOf10, content, grammarAndPunctuation, academicVocabulary, structure, goodTransitionWords, overall. markOutOf10 must be a number from 0 to 10. Each feedback section should explain mistakes and why they are mistakes."
            },
            { role: "user", content: input.data.pastedText }
          ]
        });
        feedbackJson = completion.choices[0]?.message.content ?? feedbackJson;
      } catch (err) {
        error = err instanceof Error ? err.message : "AI tutor failed";
      }
    }

    const feedback = await prisma.aiFeedback.create({
      data: {
        submissionId: submission.id,
        promptId: activePrompt?.id,
        feedbackJson,
        model,
        error
      }
    });

    await writeAudit(req.user?.id, "CREATE", "WritingSubmission", submission.id, { promptVersion: activePrompt?.version ?? null, targetStudentId });
    res.status(201).json({ submission, feedback });
  } catch (err) {
    console.error("AI tutor submission failed", err);
    res.status(500).json({ error: err instanceof Error ? `AI feedback failed: ${err.message}` : "AI feedback failed" });
  }
});

app.get("/api/admin/users", requireAuth, requireActiveAccount, requireRole("ADMIN"), async (_req, res) => {
  const users = await prisma.user.findMany({
    include: { student: { include: { level: true } }, teacher: { include: { levels: { include: { level: true } } } } },
    orderBy: { createdAt: "desc" }
  });
  res.json(users.map((user) => ({
    ...publicUser(user),
    teacherLevels: user.teacher?.levels.map((item) => item.level) ?? []
  })));
});

app.post("/api/admin/users", requireAuth, requireActiveAccount, requireRole("ADMIN"), async (req, res) => {
  const input = adminCreateUserSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.flatten() });
    return;
  }

  if (input.data.role === "STUDENT" && !input.data.levelId) {
    res.status(400).json({ error: "Student level is required" });
    return;
  }

  if (input.data.role === "TEACHER" && input.data.teacherLevelIds.length === 0) {
    res.status(400).json({ error: "Teacher must be assigned to at least one level" });
    return;
  }

  let user;
  try {
    const passwordHash = await bcrypt.hash(input.data.temporaryPassword, 12);
    user = await prisma.user.create({
      data: {
        email: input.data.email.toLowerCase(),
        firstName: input.data.firstName,
        lastName: input.data.lastName,
        role: input.data.role,
        passwordHash,
        student: input.data.role === "STUDENT" && input.data.levelId ? { create: { levelId: input.data.levelId } } : undefined,
        teacher: input.data.role === "TEACHER"
          ? { create: { levels: { create: input.data.teacherLevelIds.map((levelId) => ({ levelId })) } } }
          : undefined
      },
      include: { student: { include: { level: true } }, teacher: { include: { levels: { include: { level: true } } } } }
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      res.status(409).json({ error: "A user with this email already exists." });
      return;
    }
    throw err;
  }

  await writeAudit(req.user?.id, "CREATE", "User", user.id, { role: user.role });
  res.status(201).json({
    ...publicUser(user),
    teacherLevels: user.teacher?.levels.map((item) => item.level) ?? []
  });
});

app.put("/api/admin/users/:id", requireAuth, requireActiveAccount, requireRole("ADMIN"), async (req, res) => {
  const input = adminUpdateUserSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.flatten() });
    return;
  }

  const userId = String(req.params.id);
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    include: { student: true, teacher: true }
  });
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const targetRole = input.data.role ?? existing.role;
  if (targetRole === "STUDENT" && (input.data.role === "STUDENT" || input.data.levelId !== undefined) && !input.data.levelId && !existing.student?.levelId) {
    res.status(400).json({ error: "Student level is required" });
    return;
  }

  if (targetRole === "TEACHER" && (input.data.role === "TEACHER" || input.data.teacherLevelIds !== undefined)) {
    const targetTeacherLevelIds = input.data.teacherLevelIds ?? [];
    if (targetTeacherLevelIds.length === 0 && !existing.teacher) {
      res.status(400).json({ error: "Teacher must be assigned to at least one level" });
      return;
    }
    if (input.data.teacherLevelIds && input.data.teacherLevelIds.length === 0) {
      res.status(400).json({ error: "Teacher must be assigned to at least one level" });
      return;
    }
  }

  if (userId === req.user!.id && (targetRole !== "ADMIN" || input.data.status && input.data.status !== "ACTIVE")) {
    res.status(400).json({ error: "You cannot remove your own admin access or disable your own account." });
    return;
  }

  const weakensAdminAccess =
    existing.role === "ADMIN" &&
    (targetRole !== "ADMIN" || input.data.status === "DISABLED" || input.data.status === "PENDING_APPROVAL");
  if (weakensAdminAccess) {
    const otherActiveAdmins = await prisma.user.count({
      where: { id: { not: userId }, role: "ADMIN", status: "ACTIVE" }
    });
    if (otherActiveAdmins === 0) {
      res.status(400).json({ error: "At least one active admin account must remain." });
      return;
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        firstName: input.data.firstName,
        lastName: input.data.lastName,
        role: targetRole,
        status: input.data.status
      }
    });

    if (targetRole === "STUDENT") {
      if (existing.teacher) await tx.teacherProfile.delete({ where: { userId } });
      await tx.studentProfile.upsert({
        where: { userId },
        update: { levelId: input.data.levelId ?? existing.student?.levelId ?? "" },
        create: { userId, levelId: input.data.levelId ?? existing.student?.levelId ?? "" }
      });
    }

    if (targetRole === "TEACHER") {
      if (existing.student) await tx.studentProfile.delete({ where: { userId } });
      const teacher = existing.teacher ?? await tx.teacherProfile.create({ data: { userId } });
      if (input.data.teacherLevelIds) {
        await tx.teacherLevel.deleteMany({ where: { teacherId: teacher.id } });
        await tx.teacherLevel.createMany({
          data: input.data.teacherLevelIds.map((levelId) => ({ teacherId: teacher.id, levelId }))
        });
      }
    }

    if (targetRole === "ADMIN") {
      if (existing.student) await tx.studentProfile.delete({ where: { userId } });
      if (existing.teacher) await tx.teacherProfile.delete({ where: { userId } });
    }
  });

  const updated = await prisma.user.findUnique({
    where: { id: userId },
    include: { student: { include: { level: true } }, teacher: { include: { levels: { include: { level: true } } } } }
  });

  await writeAudit(req.user?.id, "UPDATE", "User", userId, {
    role: input.data.role,
    status: input.data.status,
    levelId: input.data.levelId,
    teacherLevelIds: input.data.teacherLevelIds
  });

  res.json(updated ? {
    ...publicUser(updated),
    teacherLevels: updated.teacher?.levels.map((item) => item.level) ?? []
  } : null);
});

app.post("/api/admin/users/:id/reset-password", requireAuth, requireActiveAccount, requireRole("ADMIN"), async (req, res) => {
  const input = adminResetPasswordSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.flatten() });
    return;
  }

  const userId = String(req.params.id);
  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const passwordHash = await bcrypt.hash(input.data.temporaryPassword, 12);
  const user = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash }
  });

  await writeAudit(req.user?.id, "UPDATE", "User", user.id, { resetPassword: true });
  res.json({ ok: true });
});

app.get("/api/review/submissions", requireAuth, requireActiveAccount, requireRole("ADMIN", "TEACHER"), async (req, res) => {
  const levelId = req.query.levelId?.toString();
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { teacher: { include: { levels: true } } }
  });

  const teacherLevelIds = user?.teacher?.levels.map((item) => item.levelId) ?? [];
  const allowedLevelIds = req.user!.role === "ADMIN" ? undefined : teacherLevelIds;

  if (req.user!.role === "TEACHER" && allowedLevelIds?.length === 0) {
    res.json([]);
    return;
  }

  if (req.user!.role === "TEACHER" && levelId && !allowedLevelIds?.includes(levelId)) {
    res.status(403).json({ error: "You cannot review submissions for this level" });
    return;
  }

  const submissions = await prisma.writingSubmission.findMany({
    where: {
      ...(levelId ? { levelId } : {}),
      ...(allowedLevelIds ? { levelId: { in: allowedLevelIds } } : {})
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          student: { include: { level: true } }
        }
      },
      assignment: { include: { level: true } },
      feedback: { include: { prompt: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  res.json(submissions);
});

app.put("/api/review/submissions/:id/teacher-feedback", requireAuth, requireActiveAccount, requireRole("ADMIN", "TEACHER"), async (req, res) => {
  const input = teacherFeedbackSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.flatten() });
    return;
  }

  const submission = await prisma.writingSubmission.findUnique({ where: { id: String(req.params.id) } });
  if (!submission) {
    res.status(404).json({ error: "Submission not found" });
    return;
  }

  if (req.user!.role === "TEACHER") {
    const teacher = await prisma.teacherProfile.findUnique({
      where: { userId: req.user!.id },
      include: { levels: true }
    });
    const allowedLevelIds = teacher?.levels.map((item) => item.levelId) ?? [];
    if (!submission.levelId || !allowedLevelIds.includes(submission.levelId)) {
      res.status(403).json({ error: "You cannot add feedback for this submission" });
      return;
    }
  }

  const updated = await prisma.writingSubmission.update({
    where: { id: submission.id },
    data: {
      teacherFeedback: input.data.teacherFeedback,
      teacherFeedbackById: req.user!.id,
      teacherFeedbackAt: new Date()
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          student: { include: { level: true } }
        }
      },
      assignment: { include: { level: true } },
      feedback: { include: { prompt: true } }
    }
  });

  await writeAudit(req.user?.id, "UPDATE", "WritingSubmission", submission.id, { teacherFeedback: true });
  res.json(updated);
});

app.get("/api/review/students", requireAuth, requireActiveAccount, requireRole("ADMIN", "TEACHER"), async (req, res) => {
  const levelId = req.query.levelId?.toString();
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { teacher: { include: { levels: true } } }
  });

  const teacherLevelIds = user?.teacher?.levels.map((item) => item.levelId) ?? [];
  const allowedLevelIds = req.user!.role === "ADMIN" ? undefined : teacherLevelIds;

  if (req.user!.role === "TEACHER" && allowedLevelIds?.length === 0) {
    res.json([]);
    return;
  }

  if (req.user!.role === "TEACHER" && levelId && !allowedLevelIds?.includes(levelId)) {
    res.status(403).json({ error: "You cannot view students for this level" });
    return;
  }

  const users = await prisma.user.findMany({
    where: {
      role: "STUDENT",
      status: AccountStatus.ACTIVE,
      student: {
        ...(levelId ? { levelId } : {}),
        ...(allowedLevelIds ? { levelId: { in: allowedLevelIds } } : {})
      }
    },
    include: { student: { include: { level: true } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
  });

  res.json(users.map((item) => ({
    id: item.id,
    email: item.email,
    firstName: item.firstName,
    lastName: item.lastName,
    level: item.student?.level ?? null
  })));
});

app.get("/api/admin/ai-prompts", requireAuth, requireActiveAccount, requireRole("ADMIN"), async (_req, res) => {
  const prompts = await prisma.aiPrompt.findMany({
    include: { editedBy: { select: { firstName: true, lastName: true, email: true } } },
    orderBy: [{ isActive: "desc" }, { version: "desc" }]
  });
  res.json(prompts);
});

app.post("/api/admin/ai-prompts", requireAuth, requireActiveAccount, requireRole("ADMIN"), async (req, res) => {
  const input = aiPromptSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.flatten() });
    return;
  }

  const latest = await prisma.aiPrompt.findFirst({ orderBy: { version: "desc" } });
  const prompt = await prisma.$transaction(async (tx) => {
    await tx.aiPrompt.updateMany({ where: { isActive: true }, data: { isActive: false } });
    return tx.aiPrompt.create({
      data: {
        name: input.data.name,
        promptText: input.data.promptText,
        version: (latest?.version ?? 0) + 1,
        isActive: true,
        editedById: req.user!.id
      }
    });
  });

  await writeAudit(req.user?.id, "PROMPT_CHANGE", "AiPrompt", prompt.id, { version: prompt.version, name: prompt.name });
  res.status(201).json(prompt);
});

app.get("/api/admin/site-content", requireAuth, requireActiveAccount, requireRole("ADMIN"), async (_req, res) => {
  const content = await prisma.siteContent.findUnique({ where: { id: "landing" } });
  res.json(content ?? defaultSiteContent);
});

app.put("/api/admin/site-content", requireAuth, requireActiveAccount, requireRole("ADMIN"), async (req, res) => {
  const input = siteContentSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.flatten() });
    return;
  }

  const content = await prisma.siteContent.upsert({
    where: { id: "landing" },
    update: input.data,
    create: { id: "landing", ...input.data }
  });

  await writeAudit(req.user?.id, "UPDATE", "SiteContent", content.id, { section: "landing" });
  res.json(content);
});

if (process.env.NODE_ENV === "production") {
  const clientDist = path.resolve(process.cwd(), "dist");
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Unexpected server error" });
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
