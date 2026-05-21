export type Session = {
  token: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: "STUDENT" | "TEACHER" | "ADMIN";
    status: string;
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
  _count?: { submissions: number };
};

export type Product = {
  id: string;
  title: string;
  description: string;
  type: "INDIVIDUAL" | "BUNDLE";
  priceCents: number;
  currency: string;
  level?: Level | null;
  isActive: boolean;
  isPurchased?: boolean;
  resources?: Array<{ resource: Resource }>;
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
  resources: Resource[];
  assignments: Assignment[];
  products: Product[];
  submissions: Submission[];
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
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(formatApiError(error));
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
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(formatApiError(error));
  }

  return response.json();
}

export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export const dateTime = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
