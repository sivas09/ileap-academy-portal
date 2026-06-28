export type Session = {
  token: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: "STUDENT" | "TEACHER" | "ADMIN";
    status: "ACTIVE" | "DISABLED" | "PENDING_APPROVAL";
    level?: Level | null;
  };
};

export type Level = {
  id: string;
  code: string;
  name: string;
  gradeBand: string;
  description: string;
  sortOrder: number;
};

export type Lesson = {
  id: string;
  topicId: string;
  title: string;
  description?: string | null;
  sortOrder: number;
  startsAt?: string | null;
  endsAt?: string | null;
  isPublished: boolean;
};

export type Topic = {
  id: string;
  levelId: string;
  level?: Level;
  title: string;
  description?: string | null;
  sortOrder: number;
  isPublished: boolean;
  lessons: Lesson[];
};

export type Resource = {
  id: string;
  title: string;
  description: string;
  type: "DOCUMENT" | "PDF" | "WORKSHEET" | "VIDEO_LINK" | "BOOK";
  accessMode: "FREE" | "LEVEL_ASSIGNED" | "INDIVIDUAL_PURCHASE" | "BUNDLE_PURCHASE";
  url?: string | null;
  fileKey?: string | null;
  originalFileName?: string | null;
  level?: Level | null;
  topic?: Topic | null;
  topicId?: string | null;
  lesson?: (Lesson & { topic?: Topic | null }) | null;
  lessonId?: string | null;
  isPublished: boolean;
  isAccessible: boolean;
  _count?: { products: number; entitlements: number };
};

export type Assignment = {
  id: string;
  title: string;
  instructions: string;
  wordCountGuidance?: string | null;
  level: Level;
  isPublished: boolean;
  isArchived: boolean;
  dueAt?: string | null;
  topic?: Topic | null;
  topicId?: string | null;
  lesson?: (Lesson & { topic?: Topic | null }) | null;
  lessonId?: string | null;
  _count?: { submissions: number };
};

export type Product = {
  id: string;
  title: string;
  slug: string;
  category: string;
  description: string;
  shortDescription: string;
  priceLabel: string;
  regularPriceLabel?: string | null;
  salePriceLabel?: string | null;
  stripePaymentLink?: string | null;
  imageUrl?: string | null;
  badge?: string | null;
  saleBadge?: string | null;
  ratingLabel: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  sortOrder: number;
  type: "INDIVIDUAL" | "BUNDLE";
  priceCents: number;
  currency: string;
  level?: Level | null;
  isActive: boolean;
  isPurchased?: boolean;
  resources?: Array<{ resource: Resource }>;
};

export type PublicProduct = Product;

export type OrderHistory = {
  id: string;
  status: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  totalCents: number;
  currency: string;
  stripeCheckoutSession?: string | null;
  stripePaymentIntent?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    student?: { level: Level } | null;
  };
  items: Array<{
    id: string;
    titleSnapshot: string;
    priceCentsSnapshot: number;
    product?: Product;
  }>;
};

export type Submission = {
  id: string;
  pastedText: string;
  levelId?: string | null;
  teacherFeedback?: string | null;
  teacherFeedbackById?: string | null;
  teacherFeedbackAt?: string | null;
  createdAt: string;
  assignment?: Assignment | null;
  feedback?: {
    id: string;
    feedbackJson: string;
    error?: string | null;
    createdAt: string;
    prompt?: { id: string; name: string; version: number } | null;
  } | null;
};

export type ReviewSubmission = Submission & {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    student?: { level: Level } | null;
  };
};

export type ReviewStudent = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  level: Level | null;
};

export type DashboardData = {
  user: Session["user"];
  levels: Level[];
  teacherLevels: Level[];
  curriculum: Topic[];
  resources: Resource[];
  assignments: Assignment[];
  products: Product[];
  submissions: Array<Submission | ReviewSubmission>;
  notificationRecipients: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  }>;
};

export type AiPrompt = {
  id: string;
  name: string;
  promptText: string;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  editedBy?: { firstName: string; lastName: string; email: string } | null;
};

export type SiteContent = {
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  announcement?: string | null;
  loginTitle: string;
  loginHint: string;
  signupTitle: string;
  signupHint?: string | null;
  grade2Title: string;
  grade2Text: string;
  grade456Title: string;
  grade456Text: string;
  grade789Title: string;
  grade789Text: string;
};

export type AdminUser = Session["user"] & {
  teacherLevels: Level[];
};

export const SESSION_EXPIRED_MESSAGE = "Your session expired. Please log in again.";
export const SESSION_EXPIRED_EVENT = "portal:session-expired";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function formatApiError(error: unknown) {
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object") return "Request failed";

  const maybeError = error as {
    error?: unknown;
    formErrors?: string[];
    fieldErrors?: Record<string, string[]>;
  };

  if (typeof maybeError.error === "string") return maybeError.error;

  const flattened = maybeError.error && typeof maybeError.error === "object"
    ? maybeError.error as { formErrors?: string[]; fieldErrors?: Record<string, string[]> }
    : maybeError;

  const fieldMessages = Object.entries(flattened.fieldErrors ?? {})
    .flatMap(([field, messages]) => messages.map((message) => `${field}: ${message}`));
  const formMessages = flattened.formErrors ?? [];

  return [...formMessages, ...fieldMessages].join("; ") || "Request failed";
}

async function handleApiError(response: Response, isAuthenticatedRequest: boolean): Promise<never> {
  const error = await response.json().catch(() => ({ error: "Request failed" }));

  if (response.status === 401 && isAuthenticatedRequest) {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    throw new ApiError(SESSION_EXPIRED_MESSAGE, response.status);
  }

  throw new ApiError(formatApiError(error), response.status);
}

export async function api<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  if (!response.ok) {
    await handleApiError(response, Boolean(token));
  }

  return response.json();
}

export async function uploadApi<T>(path: string, formData: FormData, token: string): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });

  if (!response.ok) {
    await handleApiError(response, true);
  }

  return response.json();
}

export const money = (cents: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);

export const dateTime = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
