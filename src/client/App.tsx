import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ClipboardEdit,
  FileText,
  GraduationCap,
  Lock,
  LogOut,
  Plus,
  Save,
  Shield,
  ShoppingCart,
  Sparkles,
  Video
} from "lucide-react";
import { AiPrompt, api, Assignment, DashboardData, Level, money, Resource, ReviewSubmission, Session, uploadApi } from "./api";

const stored = localStorage.getItem("portal.session");

export function App() {
  const [session, setSession] = useState<Session | null>(stored ? JSON.parse(stored) : null);
  const [view, setView] = useState("dashboard");

  useEffect(() => {
    if (session) localStorage.setItem("portal.session", JSON.stringify(session));
    else localStorage.removeItem("portal.session");
  }, [session]);

  if (!session) return <PublicSite onLogin={setSession} />;

  return (
    <Shell session={session} view={view} setView={setView} onLogout={() => setSession(null)}>
      <Portal session={session} view={view} />
    </Shell>
  );
}

function PublicSite({ onLogin }: { onLogin: (session: Session) => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [levels, setLevels] = useState<Level[]>([]);

  useEffect(() => {
    api<Level[]>("/public/levels").then(setLevels).catch(() => setLevels([]));
  }, []);

  return (
    <main className="publicPage">
      <nav className="publicNav">
        <div className="brand">
          <img src="/Logo_large.jpg" alt="iLEAP Academy" />
          <span>iLEAP Academy</span>
        </div>
        <div className="navActions">
          <button className={mode === "login" ? "tab active" : "tab"} onClick={() => setMode("login")}>Login</button>
          <button className={mode === "signup" ? "tab active" : "tab"} onClick={() => setMode("signup")}>Student Signup</button>
        </div>
      </nav>

      <section className="hero">
        <div className="heroCopy">
          <span className="eyebrow">English Writing Program</span>
          <h1>Writing coaching, level-based resources, and AI tutor feedback in one portal.</h1>
          <p>
            Students access their level dashboard, practice assignments, worksheets, video lessons, books, and structured AI writing feedback.
          </p>
          <div className="heroStats">
            <span>Grade 2/3</span>
            <span>Grade 4/5/6</span>
            <span>Grade 7/8/9</span>
          </div>
        </div>
        <section className="authCard">
          {mode === "login" ? <Login onLogin={onLogin} /> : <Signup levels={levels} onLogin={onLogin} />}
        </section>
      </section>

      <section className="levelBand">
        {levels.map((level) => (
          <article className="levelCard" key={level.id}>
            <strong>{level.gradeBand}</strong>
            <h2>{level.name}</h2>
            <p>{level.description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

function Login({ onLogin }: { onLogin: (session: Session) => void }) {
  const [email, setEmail] = useState("student@example.com");
  const [password, setPassword] = useState("Member123!");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      onLogin(await api<Session>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <form onSubmit={submit} className="form">
      <h2>Portal Login</h2>
      <label>
        Email
        <input value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label>
        Password
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
      </label>
      {error && <div className="error">{error}</div>}
      <button className="primary" type="submit">Sign in</button>
      <p className="hint">Try student@example.com, teacher@example.com, or admin@example.com with Member123!</p>
    </form>
  );
}

function Signup({ levels, onLogin }: { levels: Level[]; onLogin: (session: Session) => void }) {
  const [draft, setDraft] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "Member123!",
    levelId: ""
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!draft.levelId && levels[0]) setDraft((current) => ({ ...current, levelId: levels[0].id }));
  }, [levels, draft.levelId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      onLogin(await api<Session>("/auth/signup", { method: "POST", body: JSON.stringify(draft) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    }
  }

  return (
    <form onSubmit={submit} className="form">
      <h2>Student Signup</h2>
      <div className="splitFields">
        <label>
          First name
          <input value={draft.firstName} onChange={(event) => setDraft({ ...draft, firstName: event.target.value })} />
        </label>
        <label>
          Last name
          <input value={draft.lastName} onChange={(event) => setDraft({ ...draft, lastName: event.target.value })} />
        </label>
      </div>
      <label>
        Email
        <input value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
      </label>
      <label>
        Writing level
        <select value={draft.levelId} onChange={(event) => setDraft({ ...draft, levelId: event.target.value })}>
          {levels.map((level) => (
            <option key={level.id} value={level.id}>{level.gradeBand} - {level.name}</option>
          ))}
        </select>
      </label>
      <label>
        Password
        <input type="password" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} />
      </label>
      {error && <div className="error">{error}</div>}
      <button className="primary" type="submit">Create account</button>
    </form>
  );
}

function Shell({
  session,
  view,
  setView,
  onLogout,
  children
}: {
  session: Session;
  view: string;
  setView: (view: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const items = [
    ["dashboard", GraduationCap, "Dashboard"],
    ["resources", FileText, "Resources"],
    ["assignments", ClipboardEdit, "Assignments"],
    ["tutor", Sparkles, "AI Tutor"],
    ["shop", ShoppingCart, "Shop"],
    ...(session.user.role === "STUDENT" ? [] : [["review", ClipboardEdit, "Review"]] as const),
    ...(session.user.role === "ADMIN" ? [["prompts", Sparkles, "Prompts"]] as const : []),
    ...(session.user.role === "STUDENT" ? [] : [["admin", Shield, "Admin"]] as const)
  ] as const;

  return (
    <div className="appFrame">
      <aside className="sidebar">
        <div className="identity">
          <img className="logoMark small" src="/Logo_large.jpg" alt="iLEAP Academy" />
          <div>
            <strong>iLEAP Academy</strong>
            <span>{session.user.role}</span>
          </div>
        </div>
        <nav>
          {items.map(([id, Icon, label]) => (
            <button className={view === id ? "active" : ""} key={id} onClick={() => setView(id)}>
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <button className="logout" onClick={onLogout}>
          <LogOut size={18} />
          Sign out
        </button>
      </aside>
      <section className="content">
        <header className="topbar">
          <div>
            <h2>{view === "tutor" ? "AI Tutor" : view[0].toUpperCase() + view.slice(1)}</h2>
            <span>{session.user.firstName} {session.user.lastName}{session.user.level ? ` | ${session.user.level.gradeBand}` : ""}</span>
          </div>
        </header>
        {children}
      </section>
    </div>
  );
}

function Portal({ session, view }: { session: Session; view: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  async function refresh() {
    setError("");
    try {
      setData(await api<DashboardData>("/dashboard", {}, session.token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load portal data");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!data) return <div className="empty">Loading portal data...</div>;

  if (view === "resources") return <Resources resources={data.resources} token={session.token} />;
  if (view === "assignments") return <Assignments assignments={data.assignments} />;
  if (view === "tutor") return <AiTutor token={session.token} assignments={data.assignments} onSubmit={refresh} />;
  if (view === "shop") return <Shop products={data.products} />;
  if (view === "review" && session.user.role !== "STUDENT") return <ReviewSubmissions levels={data.levels} token={session.token} />;
  if (view === "prompts" && session.user.role === "ADMIN") return <PromptManager token={session.token} />;
  if (view === "admin" && session.user.role !== "STUDENT") return <AdminTools data={data} token={session.token} onChange={refresh} />;

  return <Dashboard data={data} />;
}

function Dashboard({ data }: { data: DashboardData }) {
  const accessible = data.resources.filter((resource) => resource.isAccessible).length;
  const locked = data.resources.filter((resource) => !resource.isAccessible).length;

  return (
    <div className="grid">
      <div className="metric"><span>Writing level</span><strong>{data.user.level?.gradeBand ?? data.user.role}</strong></div>
      <div className="metric accentBlue"><span>Available resources</span><strong>{accessible}</strong></div>
      <div className="metric accentGreen"><span>AI submissions</span><strong>{data.submissions.length}</strong></div>

      <section className="panel wide">
        <h3>Today&apos;s Workspace</h3>
        <p className="lead">Open an assignment, paste writing into the AI Tutor, and review feedback with your teacher.</p>
        <div className="actionRow">
          <span>{data.assignments.length} assignments</span>
          <span>{locked} locked resources</span>
          <span>{data.products.length} shop products</span>
        </div>
      </section>

      <section className="panel">
        <h3>Recent Assignments</h3>
        {data.assignments.slice(0, 3).map((assignment) => (
          <div className="stackItem" key={assignment.id}>
            <strong>{assignment.title}</strong>
            <span>{assignment.level.gradeBand}</span>
          </div>
        ))}
      </section>

      <section className="panel">
        <h3>Recent AI Feedback</h3>
        {data.submissions.length === 0 && <p className="empty">No writing submitted yet.</p>}
        {data.submissions.slice(0, 3).map((submission) => (
          <div className="stackItem" key={submission.id}>
            <strong>{submission.assignment?.title ?? "Writing practice"}</strong>
            <span>{new Date(submission.createdAt).toLocaleDateString()}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

function Resources({ resources, token }: { resources: Resource[]; token: string }) {
  async function openResource(resource: Resource) {
    if (resource.url && !resource.fileKey) {
      window.open(resource.url, "_blank", "noopener,noreferrer");
      return;
    }

    const response = await fetch(`/api/resources/${resource.id}/open`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      alert("Could not open this resource. Please sign in again or ask an admin to check access.");
      return;
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    window.open(objectUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }

  return (
    <div className="cardGrid">
      {resources.map((resource) => (
        <article className={resource.isAccessible ? "resourceCard" : "resourceCard locked"} key={resource.id}>
          <div className="cardIcon">{iconForResource(resource)}</div>
          <strong>{resource.title}</strong>
          <span>{resource.level?.gradeBand ?? "All levels"} | {resource.type.replace("_", " ")}</span>
          <p>{resource.description}</p>
          {resource.isAccessible ? (
            <button className="secondary" onClick={() => openResource(resource)}>Open resource</button>
          ) : (
            <div className="lockedNote"><Lock size={16} /> Purchase required</div>
          )}
        </article>
      ))}
    </div>
  );
}

function iconForResource(resource: Resource) {
  if (resource.type === "VIDEO_LINK") return <Video size={20} />;
  if (resource.type === "BOOK") return <BookOpen size={20} />;
  return <FileText size={20} />;
}

function Assignments({ assignments }: { assignments: Assignment[] }) {
  return (
    <div className="cardGrid">
      {assignments.map((assignment) => (
        <article className="resourceCard" key={assignment.id}>
          <div className="cardIcon"><ClipboardEdit size={20} /></div>
          <strong>{assignment.title}</strong>
          <span>{assignment.level.gradeBand}</span>
          <p>{assignment.instructions}</p>
          {assignment._count && <small>{assignment._count.submissions} submissions</small>}
        </article>
      ))}
    </div>
  );
}

function AiTutor({ token, assignments, onSubmit }: { token: string; assignments: Assignment[]; onSubmit: () => void }) {
  const [assignmentId, setAssignmentId] = useState(assignments[0]?.id ?? "");
  const [pastedText, setPastedText] = useState("");
  const [feedback, setFeedback] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const response = await api<{ feedback: { feedbackJson: string; error?: string | null } }>(
        "/student/submissions",
        { method: "POST", body: JSON.stringify({ assignmentId: assignmentId || null, pastedText }) },
        token
      );
      setFeedback(JSON.parse(response.feedback.feedbackJson));
      onSubmit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit writing");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="twoCol">
      <section className="panel">
        <h3>Paste Writing</h3>
        <div className="form">
          <label>
            Assignment
            <select value={assignmentId} onChange={(event) => setAssignmentId(event.target.value)}>
              <option value="">General writing practice</option>
              {assignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>{assignment.title}</option>
              ))}
            </select>
          </label>
          <label>
            Student writing
            <textarea value={pastedText} onChange={(event) => setPastedText(event.target.value)} placeholder="Paste the essay or paragraph here..." />
          </label>
          {error && <div className="error">{error}</div>}
          <button className="primary" onClick={submit} disabled={loading || pastedText.length < 20}>
            <Sparkles size={18} /> Get feedback
          </button>
        </div>
      </section>
      <section className="panel">
        <h3>Feedback</h3>
        {!feedback && <p className="empty">Feedback will appear here after submission.</p>}
        {feedback && <FeedbackView feedback={feedback} />}
      </section>
    </div>
  );
}

function FeedbackView({ feedback }: { feedback: any }) {
  const rubricSections = [
    ["Mark", feedback.markOutOf10 != null ? `${feedback.markOutOf10}/10` : null],
    ["Content", feedback.content],
    ["Grammar & Punctuation", feedback.grammarAndPunctuation],
    ["Academic Vocabulary", feedback.academicVocabulary],
    ["Structure", feedback.structure],
    ["Good Transition Words", feedback.goodTransitionWords],
    ["Overall", feedback.overall]
  ];
  const legacySections = [
    ["Overall", feedback.overall],
    ["Strengths", feedback.strengths],
    ["Grammar and Mechanics", feedback.grammarAndMechanics],
    ["Organization and Structure", feedback.organizationAndStructure],
    ["Vocabulary and Style", feedback.vocabularyAndStyle],
    ["Improvement Priorities", feedback.improvementPriorities],
    ["Revised Example", feedback.revisedExample]
  ];
  const sections = feedback.content || feedback.markOutOf10 != null ? rubricSections : legacySections;

  return (
    <div className="feedback">
      {sections.filter(([, value]) => value).map(([label, value]) => (
        <div className="feedbackSection" key={label}>
          <strong>{label}</strong>
          {Array.isArray(value) ? <ul>{value.map((item) => <li key={item}>{item}</li>)}</ul> : <p>{value}</p>}
        </div>
      ))}
    </div>
  );
}

function Shop({ products }: { products: DashboardData["products"] }) {
  const [message, setMessage] = useState("");
  const session = JSON.parse(localStorage.getItem("portal.session") ?? "null") as Session | null;

  async function checkout(productId: string) {
    setMessage("");
    if (!session) return;
    try {
      const response = await api<{ checkoutUrl: string }>("/shop/checkout", { method: "POST", body: JSON.stringify({ productId }) }, session.token);
      window.location.href = response.checkoutUrl;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not start checkout");
    }
  }

  return (
    <>
      {message && <div className="error">{message}</div>}
      <div className="cardGrid">
        {products.map((product) => (
          <article className="resourceCard product" key={product.id}>
            <strong>{product.title}</strong>
            <span>{product.level?.gradeBand ?? "All levels"} | {product.type}</span>
            <p>{product.description}</p>
            {product.resources && product.resources.length > 0 && (
              <small>Includes: {product.resources.map((item) => item.resource.title).join(", ")}</small>
            )}
            <div className="price">{money(product.priceCents)}</div>
            {product.isPurchased ? (
              <div className="success">Purchased</div>
            ) : (
              <button className="primary" onClick={() => checkout(product.id)}>
                <ShoppingCart size={18} /> Checkout
              </button>
            )}
          </article>
        ))}
      </div>
    </>
  );
}

function ReviewSubmissions({ levels, token }: { levels: Level[]; token: string }) {
  const [levelId, setLevelId] = useState("");
  const [submissions, setSubmissions] = useState<ReviewSubmission[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");

  async function load(nextLevelId = levelId) {
    setError("");
    try {
      const query = nextLevelId ? `?levelId=${encodeURIComponent(nextLevelId)}` : "";
      const rows = await api<ReviewSubmission[]>(`/review/submissions${query}`, {}, token);
      setSubmissions(rows);
      setSelectedId((current) => rows.some((row) => row.id === current) ? current : rows[0]?.id ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load submissions");
    }
  }

  useEffect(() => {
    load("");
  }, []);

  const selected = useMemo(() => submissions.find((item) => item.id === selectedId) ?? submissions[0], [submissions, selectedId]);
  const parsedFeedback = useMemo(() => {
    if (!selected?.feedback?.feedbackJson) return null;
    try {
      return JSON.parse(selected.feedback.feedbackJson);
    } catch {
      return { overall: selected.feedback.feedbackJson };
    }
  }, [selected]);

  return (
    <div className="reviewLayout">
      <section className="panel">
        <h3>Student Submissions</h3>
        <label className="filterLabel">
          Level
          <select
            value={levelId}
            onChange={(event) => {
              setLevelId(event.target.value);
              load(event.target.value);
            }}
          >
            <option value="">All assigned levels</option>
            {levels.map((level) => <option key={level.id} value={level.id}>{level.gradeBand}</option>)}
          </select>
        </label>
        {error && <div className="error">{error}</div>}
        {submissions.length === 0 && <p className="empty">No submissions yet.</p>}
        <div className="submissionList">
          {submissions.map((submission) => (
            <button
              className={selected?.id === submission.id ? "submissionItem active" : "submissionItem"}
              key={submission.id}
              onClick={() => setSelectedId(submission.id)}
            >
              <strong>{submission.student.firstName} {submission.student.lastName}</strong>
              <span>{submission.assignment?.title ?? "Writing practice"}</span>
              <small>{submission.student.student?.level.gradeBand ?? "No level"} | {new Date(submission.createdAt).toLocaleDateString()}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="panel reviewDetail">
        {!selected && <p className="empty">Select a submission to review.</p>}
        {selected && (
          <>
            <div>
              <h3>{selected.student.firstName} {selected.student.lastName}</h3>
              <p className="empty">{selected.assignment?.title ?? "Writing practice"} | {selected.student.email}</p>
            </div>
            <div className="writingBox">
              <strong>Student Writing</strong>
              <p>{selected.pastedText}</p>
            </div>
            <div className="writingBox">
              <strong>AI Tutor Feedback</strong>
              {parsedFeedback ? <FeedbackView feedback={parsedFeedback} /> : <p className="empty">No feedback available.</p>}
              {selected.feedback?.prompt && <small>Prompt: {selected.feedback.prompt.name} v{selected.feedback.prompt.version}</small>}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

const defaultTutorPrompt = `You are an expert in English writing, grammar, and academic vocabulary.
You are the iLEAP Academy AI Tutor for English writing and grammar.
Review the student's writing and give a mark out of 10.
Tell the student what the mistakes are and why they are mistakes.
Give feedback under these exact sections:
Content
Grammar & Punctuation
Academic Vocabulary
Structure
Good Transition Words
Overall
Be clear, encouraging, age-appropriate, and specific.
Do not rewrite the full essay for the student.`;

function PromptManager({ token }: { token: string }) {
  const [prompts, setPrompts] = useState<AiPrompt[]>([]);
  const [draft, setDraft] = useState({ name: "iLEAP Writing Rubric Tutor", promptText: defaultTutorPrompt });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const rows = await api<AiPrompt[]>("/admin/ai-prompts", {}, token);
      setPrompts(rows);
      const active = rows.find((prompt) => prompt.isActive);
      if (active) setDraft({ name: active.name, promptText: active.promptText });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load prompts");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function savePrompt() {
    setMessage("");
    setError("");
    try {
      const created = await api<AiPrompt>("/admin/ai-prompts", { method: "POST", body: JSON.stringify(draft) }, token);
      setMessage(`Prompt v${created.version} is now active.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save prompt");
    }
  }

  return (
    <div className="twoCol">
      <section className="panel">
        <h3>Active AI Tutor Prompt</h3>
        <div className="form">
          <label>
            Prompt name
            <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          </label>
          <label>
            Prompt text
            <textarea className="promptText" value={draft.promptText} onChange={(event) => setDraft({ ...draft, promptText: event.target.value })} />
          </label>
          {error && <div className="error">{error}</div>}
          {message && <p className="success">{message}</p>}
          <button className="primary" onClick={savePrompt}><Save size={18} /> Save as new active version</button>
        </div>
      </section>
      <section className="panel">
        <h3>Prompt History</h3>
        {prompts.map((prompt) => (
          <div className={prompt.isActive ? "promptHistory active" : "promptHistory"} key={prompt.id}>
            <strong>{prompt.name} v{prompt.version}</strong>
            <span>{prompt.isActive ? "Active" : "Archived"} | {new Date(prompt.createdAt).toLocaleDateString()}</span>
            <small>{prompt.promptText.slice(0, 180)}{prompt.promptText.length > 180 ? "..." : ""}</small>
          </div>
        ))}
      </section>
    </div>
  );
}

function AdminTools({ data, token, onChange }: { data: DashboardData; token: string; onChange: () => void }) {
  const [resource, setResource] = useState({
    title: "",
    description: "",
    type: "PDF",
    accessMode: "LEVEL_ASSIGNED",
    levelId: data.levels[0]?.id ?? "",
    url: "",
    isPublished: true
  });
  const [resourceMode, setResourceMode] = useState<"file" | "link">("file");
  const [file, setFile] = useState<File | null>(null);
  const [assignment, setAssignment] = useState({
    title: "",
    instructions: "",
    levelId: data.levels[0]?.id ?? "",
    isPublished: true
  });
  const [product, setProduct] = useState({
    title: "",
    description: "",
    type: "INDIVIDUAL",
    priceDollars: "29.00",
    levelId: data.levels[0]?.id ?? "",
    resourceIds: [] as string[],
    isActive: true
  });
  const [message, setMessage] = useState("");

  async function createResource() {
    setMessage("");
    if (resourceMode === "file") {
      if (!file) {
        setMessage("Choose a file before uploading.");
        return;
      }
      const form = new FormData();
      form.append("file", file);
      Object.entries(resource).forEach(([key, value]) => form.append(key, String(value)));
      await uploadApi("/admin/resources/upload", form, token);
      setFile(null);
    } else {
      await api("/admin/resources", { method: "POST", body: JSON.stringify(resource) }, token);
    }
    setResource({ ...resource, title: "", description: "", url: "" });
    setMessage("Resource saved.");
    onChange();
  }

  async function createAssignment() {
    setMessage("");
    await api("/admin/assignments", { method: "POST", body: JSON.stringify(assignment) }, token);
    setAssignment({ ...assignment, title: "", instructions: "" });
    setMessage("Assignment saved.");
    onChange();
  }

  async function createProduct() {
    setMessage("");
    if (product.resourceIds.length === 0) {
      setMessage("Select at least one resource for the product.");
      return;
    }
    await api(
      "/admin/products",
      {
        method: "POST",
        body: JSON.stringify({
          title: product.title,
          description: product.description,
          type: product.type,
          priceCents: Math.round(Number(product.priceDollars) * 100),
          levelId: product.levelId || null,
          resourceIds: product.resourceIds,
          isActive: product.isActive
        })
      },
      token
    );
    setProduct({ ...product, title: "", description: "", resourceIds: [] });
    setMessage("Product saved.");
    onChange();
  }

  function toggleProductResource(resourceId: string) {
    setProduct((current) => ({
      ...current,
      resourceIds: current.resourceIds.includes(resourceId)
        ? current.resourceIds.filter((id) => id !== resourceId)
        : [...current.resourceIds, resourceId]
    }));
  }

  return (
    <div className="adminGrid">
      <section className="panel">
        <h3>Add Resource</h3>
        <div className="form compact">
          <div className="segmented">
            <button type="button" className={resourceMode === "file" ? "active" : ""} onClick={() => setResourceMode("file")}>File</button>
            <button type="button" className={resourceMode === "link" ? "active" : ""} onClick={() => setResourceMode("link")}>YouTube/URL</button>
          </div>
          <input placeholder="Title" value={resource.title} onChange={(event) => setResource({ ...resource, title: event.target.value })} />
          <textarea placeholder="Description" value={resource.description} onChange={(event) => setResource({ ...resource, description: event.target.value })} />
          <select value={resource.type} onChange={(event) => setResource({ ...resource, type: event.target.value })}>
            <option value="DOCUMENT">Document</option>
            <option value="PDF">PDF</option>
            <option value="WORKSHEET">Worksheet</option>
            <option value="VIDEO_LINK">Video link</option>
            <option value="BOOK">Book</option>
          </select>
          <select value={resource.accessMode} onChange={(event) => setResource({ ...resource, accessMode: event.target.value })}>
            <option value="FREE">Free</option>
            <option value="LEVEL_ASSIGNED">Level assigned</option>
            <option value="INDIVIDUAL_PURCHASE">Individual purchase</option>
            <option value="BUNDLE_PURCHASE">Bundle purchase</option>
          </select>
          <select value={resource.levelId} onChange={(event) => setResource({ ...resource, levelId: event.target.value })}>
            {data.levels.map((level) => <option key={level.id} value={level.id}>{level.gradeBand}</option>)}
          </select>
          {resourceMode === "file" ? (
            <input type="file" accept=".pdf,.doc,.docx,.pptx,.xlsx,.jpg,.jpeg,.png" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          ) : (
            <input placeholder="YouTube or resource URL" value={resource.url} onChange={(event) => setResource({ ...resource, url: event.target.value })} />
          )}
          <button className="primary" onClick={createResource}><Plus size={18} /> Add resource</button>
        </div>
      </section>
      <section className="panel">
        <h3>Add Assignment</h3>
        <div className="form compact">
          <input placeholder="Title" value={assignment.title} onChange={(event) => setAssignment({ ...assignment, title: event.target.value })} />
          <textarea placeholder="Instructions" value={assignment.instructions} onChange={(event) => setAssignment({ ...assignment, instructions: event.target.value })} />
          <select value={assignment.levelId} onChange={(event) => setAssignment({ ...assignment, levelId: event.target.value })}>
            {data.levels.map((level) => <option key={level.id} value={level.id}>{level.gradeBand}</option>)}
          </select>
          <button className="primary" onClick={createAssignment}><Save size={18} /> Add assignment</button>
        </div>
      </section>
      <section className="panel">
        <h3>Create Product</h3>
        <div className="form compact">
          <input placeholder="Product title" value={product.title} onChange={(event) => setProduct({ ...product, title: event.target.value })} />
          <textarea placeholder="Product description" value={product.description} onChange={(event) => setProduct({ ...product, description: event.target.value })} />
          <select value={product.type} onChange={(event) => setProduct({ ...product, type: event.target.value })}>
            <option value="INDIVIDUAL">Individual</option>
            <option value="BUNDLE">Bundle</option>
          </select>
          <input placeholder="Price, e.g. 29.00" value={product.priceDollars} onChange={(event) => setProduct({ ...product, priceDollars: event.target.value })} />
          <select value={product.levelId} onChange={(event) => setProduct({ ...product, levelId: event.target.value })}>
            {data.levels.map((level) => <option key={level.id} value={level.id}>{level.gradeBand}</option>)}
          </select>
          <div className="resourceChecklist">
            {data.resources.map((resource) => (
              <label key={resource.id}>
                <input
                  type="checkbox"
                  checked={product.resourceIds.includes(resource.id)}
                  onChange={() => toggleProductResource(resource.id)}
                />
                <span>{resource.title}</span>
              </label>
            ))}
          </div>
          <button className="primary" onClick={createProduct}><ShoppingCart size={18} /> Create product</button>
        </div>
      </section>
      {message && <section className="panel wide"><p className="success">{message}</p></section>}
    </div>
  );
}
