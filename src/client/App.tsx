import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ClipboardEdit,
  CheckCircle2,
  FileText,
  GraduationCap,
  Lock,
  LogOut,
  Plus,
  Save,
  Shield,
  ShoppingCart,
  Sparkles,
  Trash2,
  UserRound,
  Video
} from "lucide-react";
import { AdminUser, AiPrompt, api, Assignment, DashboardData, Level, money, Resource, ReviewStudent, ReviewSubmission, Session, SiteContent, uploadApi } from "./api";

type NavItem = [string, React.ComponentType<{ size?: number }>, string];

const stored = localStorage.getItem("portal.session");
const defaultSiteContent: SiteContent = {
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

function levelCardText(level: Level, content: SiteContent) {
  if (level.gradeBand.includes("2/3") || level.code.includes("2-3")) {
    return { title: content.grade2Title, text: content.grade2Text };
  }
  if (level.gradeBand.includes("4/5/6") || level.code.includes("4-5-6") || level.code.includes("4-6")) {
    return { title: content.grade456Title, text: content.grade456Text };
  }
  return { title: content.grade789Title, text: content.grade789Text };
}

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
      <Portal session={session} view={view} setView={setView} />
    </Shell>
  );
}

function PublicSite({ onLogin }: { onLogin: (session: Session) => void }) {
  const [levels, setLevels] = useState<Level[]>([]);
  const [content, setContent] = useState<SiteContent>(defaultSiteContent);

  useEffect(() => {
    api<Level[]>("/public/levels").then(setLevels).catch(() => setLevels([]));
    api<SiteContent>("/public/site-content").then(setContent).catch(() => setContent(defaultSiteContent));
  }, []);

  return (
    <main className="publicPage">
      <nav className="publicNav">
        <div className="brand">
          <img src="/Logo_large.jpg" alt="iLEAP Academy" />
          <span>iLEAP Academy</span>
        </div>
        <div className="navActions">
          <a className="portalAccessBadge" href="https://www.ileapacademy.com/">Student Portal</a>
        </div>
      </nav>

      <section className="hero">
        <div className="heroCopy">
          <span className="eyebrow">{content.heroEyebrow}</span>
          <h1>{content.heroTitle}</h1>
          <p>{content.heroSubtitle}</p>
          {content.announcement && <div className="announcement">{content.announcement}</div>}
          <div className="heroStats">
            <span>Grade 2/3</span>
            <span>Grade 4/5/6</span>
            <span>Grade 7/8/9</span>
          </div>
        </div>
        <section className="authCard">
          <Login onLogin={onLogin} content={content} />
        </section>
      </section>

      <section className="levelBand">
        {levels.map((level) => {
          const card = levelCardText(level, content);
          return (
            <article className="levelCard" key={level.id}>
              <strong>{level.gradeBand}</strong>
              <h2>{card.title}</h2>
              <p>{card.text}</p>
            </article>
          );
        })}
      </section>
    </main>
  );
}

function Login({ onLogin, content }: { onLogin: (session: Session) => void; content: SiteContent }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      <h2>{content.loginTitle}</h2>
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
      <p className="hint">{content.loginHint}</p>
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
  const activeItems: NavItem[] = session.user.status === "PENDING_APPROVAL"
    ? []
    : [
        ["resources", FileText, "Resources"],
        ["assignments", ClipboardEdit, "Assignments"],
        ...(session.user.role === "STUDENT" ? [["feedback", Sparkles, "Feedback"] as NavItem] : [["tutor", Sparkles, "AI Tutor"] as NavItem]),
        ["shop", ShoppingCart, "Shop"],
        ...(session.user.role === "STUDENT" ? [] : [["review", ClipboardEdit, "Review"] as NavItem]),
        ...(session.user.role === "ADMIN" ? [["prompts", Sparkles, "Prompts"] as NavItem] : []),
        ...(session.user.role === "ADMIN" ? [["users", UserRound, "Users"] as NavItem] : []),
        ...(session.user.role === "ADMIN" ? [["website", FileText, "Website"] as NavItem] : []),
        ...(session.user.role === "STUDENT" ? [] : [["admin", Shield, "Admin"] as NavItem])
      ];
  const items: NavItem[] = [
    ["dashboard", GraduationCap, "Dashboard"],
    ...activeItems,
    ["account", UserRound, "Account"]
  ];

  return (
    <div className="appFrame">
      <aside className="sidebar">
        <div className="identity">
          <img className="logoMark small" src="/Logo_large.jpg" alt="iLEAP Academy" />
          <div>
            <strong>iLEAP Academy</strong>
            <span>{session.user.status === "PENDING_APPROVAL" ? "Pending approval" : session.user.role}</span>
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

function Portal({ session, view, setView }: { session: Session; view: string; setView: (view: string) => void }) {
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
  if (data.user.status === "PENDING_APPROVAL" && view !== "account") return <PendingApproval user={data.user} levels={data.levels} />;

  if (view === "resources") return <Resources resources={data.resources} token={session.token} />;
  if (view === "assignments") return <Assignments assignments={data.assignments} submissions={data.submissions} levels={data.levels} curriculum={data.curriculum} notificationRecipients={data.notificationRecipients} token={session.token} role={session.user.role} onSubmit={refresh} />;
  if (view === "tutor" && session.user.role !== "STUDENT") return <AiTutor token={session.token} assignments={data.assignments} onSubmit={refresh} onDone={() => setView("dashboard")} />;
  if (view === "feedback" && session.user.role === "STUDENT") return <StudentFeedback submissions={data.submissions} />;
  if (view === "shop") return <Shop products={data.products} />;
  if (view === "review" && session.user.role !== "STUDENT") return <ReviewSubmissions levels={data.levels} assignments={data.assignments} token={session.token} onDone={() => setView("dashboard")} />;
  if (view === "prompts" && session.user.role === "ADMIN") return <PromptManager token={session.token} />;
  if (view === "users" && session.user.role === "ADMIN") return <UserManager levels={data.levels} token={session.token} />;
  if (view === "website" && session.user.role === "ADMIN") return <WebsiteContentManager token={session.token} />;
  if (view === "admin" && session.user.role !== "STUDENT") return <AdminTools data={data} token={session.token} onChange={refresh} />;
  if (view === "account") return <AccountSettings token={session.token} />;

  return <Dashboard data={data} />;
}

function PendingApproval({ user, levels }: { user: Session["user"]; levels: Level[] }) {
  return (
    <div className="approvalPage">
      <section className="approvalHero">
        <div className="approvalIcon">
          <Lock size={28} />
        </div>
        <div>
          <span className="eyebrow">Account Review</span>
          <h2>Your student account is waiting for approval.</h2>
          <p>
            iLEAP Academy will verify your registration before assignments, paid resources,
            homework submission, and feedback tools become available.
          </p>
        </div>
      </section>

      <section className="panel">
        <h3>Registration Details</h3>
        <div className="approvalDetails">
          <div>
            <span>Name</span>
            <strong>{user.firstName} {user.lastName}</strong>
          </div>
          <div>
            <span>Email</span>
            <strong>{user.email}</strong>
          </div>
          <div>
            <span>Requested level</span>
            <strong>{user.level?.gradeBand ?? "Not selected"}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>Pending approval</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <h3>Available Writing Levels</h3>
        <div className="levelPreviewList">
          {levels.map((level) => (
            <article key={level.id}>
              <strong>{level.gradeBand}</strong>
              <span>{level.name}</span>
              <p>{level.description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Dashboard({ data }: { data: DashboardData }) {
  const accessible = data.resources.filter((resource) => resource.isAccessible).length;
  const locked = data.resources.filter((resource) => !resource.isAccessible).length;

  return (
    <div className="grid">
      <div className="metric"><span>Writing level</span><strong>{data.user.level?.gradeBand ?? data.user.role}</strong></div>
      <div className="metric accentBlue"><span>Available resources</span><strong>{accessible}</strong></div>
      <div className="metric accentGreen"><span>Writing submissions</span><strong>{data.submissions.length}</strong></div>

      <section className="panel wide">
        <h3>Today&apos;s Workspace</h3>
        <p className="lead">Open an assignment, submit writing, and review feedback from your teacher.</p>
        <div className="actionRow">
          <span>{data.assignments.length} assignments</span>
          <span>{locked} locked resources</span>
          <span>{data.products.length} shop products</span>
        </div>
      </section>

      <section className="panel">
        <h3>Current Topics</h3>
        {data.curriculum.length === 0 && <p className="empty">No active topics yet.</p>}
        {data.curriculum.slice(0, 4).map((topic) => (
          <div className="stackItem" key={topic.id}>
            <strong>{topic.title}</strong>
            <span>{topic.level?.gradeBand ?? "Level"} | {topic.lessons.length} lessons</span>
          </div>
        ))}
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
        <h3>Recent Feedback</h3>
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
  function filenameFromDisposition(disposition: string | null, fallback: string) {
    const utfMatch = disposition?.match(/filename\*=UTF-8''([^;]+)/i);
    if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1]);
    const match = disposition?.match(/filename="?([^"]+)"?/i);
    return match?.[1] ?? fallback;
  }

  async function openResource(resource: Resource) {
    const response = await fetch(`/api/resources/${resource.id}/open`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      alert("Could not open this resource. Please sign in again or ask an admin to check access.");
      return;
    }

    const contentType = response.headers.get("Content-Type") ?? "";
    if (contentType.includes("application/json")) {
      const payload = await response.json() as { type?: string; url?: string };
      if (payload.type === "url" && payload.url) {
        window.open(payload.url, "_blank", "noopener,noreferrer");
        return;
      }
      alert("This resource link is not available.");
      return;
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filenameFromDisposition(response.headers.get("Content-Disposition"), resource.originalFileName ?? resource.title);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }

  return (
    <div className="cardGrid">
      {resources.map((resource) => (
        <article className={resource.isAccessible ? "resourceCard" : "resourceCard locked"} key={resource.id}>
          <div className="cardIcon">{iconForResource(resource)}</div>
          <strong>{resource.title}</strong>
          <span>{resource.level?.gradeBand ?? "All levels"} | {resource.type.replace("_", " ")}</span>
          {(resource.topic || resource.lesson) && (
            <div className="statusRow">
              {resource.topic && <small className="statusPill">{resource.topic.title}</small>}
              {resource.lesson && <small className="statusPill">{resource.lesson.title}</small>}
            </div>
          )}
          <p>{resource.description}</p>
          {resource.isAccessible ? (
            <button className="secondary" onClick={() => openResource(resource)}>{resource.fileKey ? "Download resource" : "Open resource"}</button>
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

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function dateInputValue(value?: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function displayDueDate(value?: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function Assignments({
  assignments,
  submissions,
  levels,
  curriculum,
  notificationRecipients,
  token,
  role,
  onSubmit
}: {
  assignments: Assignment[];
  submissions: DashboardData["submissions"];
  levels: Level[];
  curriculum: DashboardData["curriculum"];
  notificationRecipients: DashboardData["notificationRecipients"];
  token: string;
  role: Session["user"]["role"];
  onSubmit: () => void;
}) {
  const [openId, setOpenId] = useState("");
  const [editId, setEditId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [notificationRecipientsByAssignment, setNotificationRecipientsByAssignment] = useState<Record<string, string>>({});
  const [editDrafts, setEditDrafts] = useState<Record<string, { title: string; instructions: string; wordCountGuidance: string; levelId: string; topicId: string; lessonId: string; isPublished: boolean; isArchived: boolean; dueAt: string }>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isStudent = role === "STUDENT";

  async function submitHomework(assignment: Assignment) {
    setMessage("");
    setError("");
    try {
      await api(
        "/student/homework",
        {
          method: "POST",
          body: JSON.stringify({
            assignmentId: assignment.id,
            pastedText: drafts[assignment.id] ?? "",
            notificationRecipientEmail: notificationRecipientsByAssignment[assignment.id] || notificationRecipients[0]?.email
          })
        },
        token
      );
      setDrafts((current) => ({ ...current, [assignment.id]: "" }));
      setOpenId("");
      setMessage("Homework submitted. iLEAP has been notified.");
      onSubmit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit homework");
    }
  }

  async function saveAssignment(assignment: Assignment) {
    const draft = editDrafts[assignment.id];
    if (!draft) return;
    setMessage("");
    setError("");
    try {
      await api(`/admin/assignments/${assignment.id}`, {
        method: "PUT",
          body: JSON.stringify({
            ...draft,
            dueAt: draft.dueAt || null,
            wordCountGuidance: draft.wordCountGuidance || null,
            topicId: draft.topicId || null,
            lessonId: draft.lessonId || null
          })
      }, token);
      setEditId("");
      setMessage("Assignment updated.");
      onSubmit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update assignment");
    }
  }

  async function deleteAssignment(assignment: Assignment) {
    if (!window.confirm(`Delete "${assignment.title}"? This only works when there are no student submissions.`)) return;
    setMessage("");
    setError("");
    try {
      await api(`/admin/assignments/${assignment.id}`, { method: "DELETE" }, token);
      setMessage("Assignment deleted.");
      onSubmit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete assignment");
    }
  }

  function openEdit(assignment: Assignment) {
    setEditId(editId === assignment.id ? "" : assignment.id);
    setEditDrafts((current) => ({
      ...current,
      [assignment.id]: current[assignment.id] ?? {
        title: assignment.title,
        instructions: assignment.instructions,
        wordCountGuidance: assignment.wordCountGuidance ?? "",
        levelId: assignment.level.id,
        topicId: assignment.topic?.id ?? "",
        lessonId: assignment.lesson?.id ?? "",
        isPublished: assignment.isPublished,
        isArchived: assignment.isArchived,
        dueAt: dateInputValue(assignment.dueAt)
      }
    }));
  }

  function topicsForLevel(levelId: string) {
    return curriculum.filter((topic) => topic.levelId === levelId);
  }

  function lessonsForTopic(topicId: string) {
    return curriculum.find((topic) => topic.id === topicId)?.lessons ?? [];
  }

  return (
    <>
      {message && <p className="success">{message}</p>}
      {error && <div className="error">{error}</div>}
      <div className="cardGrid">
        {assignments.map((assignment) => (
          <article className="resourceCard assignmentCard" key={assignment.id}>
            {(() => {
              const studentSubmission = submissions.find((submission) => submission.assignment?.id === assignment.id);
              const dueDate = displayDueDate(assignment.dueAt);
              return (
                <>
            <div className="cardIcon"><ClipboardEdit size={20} /></div>
            <strong>{assignment.title}</strong>
            <span>{assignment.level.gradeBand}</span>
            <div className="statusRow">
              <small className={assignment.isPublished ? "statusPill activeStatus" : "statusPill"}>{assignment.isPublished ? "Published" : "Hidden"}</small>
              {assignment.isArchived && <small className="statusPill dangerStatus">Archived</small>}
              {dueDate && <small className="statusPill">Due {dueDate}</small>}
              {assignment.topic && <small className="statusPill">{assignment.topic.title}</small>}
              {assignment.lesson && <small className="statusPill">{assignment.lesson.title}</small>}
              {isStudent && <small className={studentSubmission ? "statusPill activeStatus" : "statusPill"}>{studentSubmission ? studentSubmission.teacherFeedback ? "Teacher feedback ready" : studentSubmission.feedback ? "Feedback ready" : "Submitted" : "Not submitted"}</small>}
            </div>
            <p>{assignment.instructions}</p>
            {assignment.wordCountGuidance && <small>Recommended length: {assignment.wordCountGuidance}</small>}
            {assignment._count && <small>{assignment._count.submissions} submissions</small>}
            {!isStudent && (
              <>
                <button className="secondary" onClick={() => openEdit(assignment)}>
                  {editId === assignment.id ? "Close editor" : "Edit assignment"}
                </button>
                {editId === assignment.id && editDrafts[assignment.id] && (
                  <div className="homeworkBox">
                    <label>
                      Title
                      <input value={editDrafts[assignment.id].title} onChange={(event) => setEditDrafts((current) => ({ ...current, [assignment.id]: { ...current[assignment.id], title: event.target.value } }))} />
                    </label>
                    <label>
                      Details
                      <textarea value={editDrafts[assignment.id].instructions} onChange={(event) => setEditDrafts((current) => ({ ...current, [assignment.id]: { ...current[assignment.id], instructions: event.target.value } }))} />
                    </label>
                    <label>
                      Word count guidance
                      <input placeholder="Example: 300-500 words" value={editDrafts[assignment.id].wordCountGuidance} onChange={(event) => setEditDrafts((current) => ({ ...current, [assignment.id]: { ...current[assignment.id], wordCountGuidance: event.target.value } }))} />
                    </label>
                    <label>
                      Due date
                      <input type="date" value={editDrafts[assignment.id].dueAt} onChange={(event) => setEditDrafts((current) => ({ ...current, [assignment.id]: { ...current[assignment.id], dueAt: event.target.value } }))} />
                    </label>
                    <label>
                      Level
                      <select value={editDrafts[assignment.id].levelId} onChange={(event) => setEditDrafts((current) => ({ ...current, [assignment.id]: { ...current[assignment.id], levelId: event.target.value } }))}>
                        {levels.map((level) => <option key={level.id} value={level.id}>{level.gradeBand}</option>)}
                      </select>
                    </label>
                    <label>
                      Topic
                      <select value={editDrafts[assignment.id].topicId} onChange={(event) => setEditDrafts((current) => ({ ...current, [assignment.id]: { ...current[assignment.id], topicId: event.target.value, lessonId: "" } }))}>
                        <option value="">No topic</option>
                        {topicsForLevel(editDrafts[assignment.id].levelId).map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
                      </select>
                    </label>
                    <label>
                      Lesson / Week
                      <select value={editDrafts[assignment.id].lessonId} onChange={(event) => setEditDrafts((current) => ({ ...current, [assignment.id]: { ...current[assignment.id], lessonId: event.target.value } }))} disabled={!editDrafts[assignment.id].topicId}>
                        <option value="">No lesson</option>
                        {lessonsForTopic(editDrafts[assignment.id].topicId).map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}
                      </select>
                    </label>
                    <label className="inlineCheck">
                      <input type="checkbox" checked={editDrafts[assignment.id].isPublished} onChange={(event) => setEditDrafts((current) => ({ ...current, [assignment.id]: { ...current[assignment.id], isPublished: event.target.checked } }))} />
                      Published
                    </label>
                    <label className="inlineCheck">
                      <input type="checkbox" checked={editDrafts[assignment.id].isArchived} onChange={(event) => setEditDrafts((current) => ({ ...current, [assignment.id]: { ...current[assignment.id], isArchived: event.target.checked, isPublished: event.target.checked ? false : current[assignment.id].isPublished } }))} />
                      Archived
                    </label>
                    <button className="primary" onClick={() => saveAssignment(assignment)}><Save size={18} /> Save assignment</button>
                    <button className="secondary dangerButton" onClick={() => deleteAssignment(assignment)}>
                      <Trash2 size={18} /> Delete if empty
                    </button>
                  </div>
                )}
              </>
            )}
            {isStudent && (
              <>
                <button className="secondary" onClick={() => setOpenId(openId === assignment.id ? "" : assignment.id)}>
                  {openId === assignment.id ? "Close" : "Submit homework"}
                </button>
                {openId === assignment.id && (
                  <div className="homeworkBox">
                    <label>
                      Paste your work
                      <textarea
                        value={drafts[assignment.id] ?? ""}
                        onChange={(event) => setDrafts((current) => ({ ...current, [assignment.id]: event.target.value }))}
                        placeholder="Paste your paragraph or essay here..."
                      />
                    </label>
                    {notificationRecipients.length > 0 && (
                      <label>
                        Notify
                        <select
                          value={notificationRecipientsByAssignment[assignment.id] || notificationRecipients[0].email}
                          onChange={(event) => setNotificationRecipientsByAssignment((current) => ({ ...current, [assignment.id]: event.target.value }))}
                        >
                          {notificationRecipients.map((recipient) => (
                            <option key={`${recipient.id}-${recipient.email}`} value={recipient.email}>
                              {recipient.firstName} {recipient.lastName} ({recipient.email})
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <div className="statusRow">
                      <small className="statusPill">{wordCount(drafts[assignment.id] ?? "")} words</small>
                      <small className="statusPill">{(drafts[assignment.id] ?? "").length}/12,000 characters</small>
                    </div>
                    <button className="primary" onClick={() => submitHomework(assignment)} disabled={(drafts[assignment.id] ?? "").length < 20}>
                      <Save size={18} /> Submit
                    </button>
                  </div>
                )}
              </>
            )}
                </>
              );
            })()}
          </article>
        ))}
      </div>
    </>
  );
}

function StudentFeedback({ submissions }: { submissions: DashboardData["submissions"] }) {
  const withFeedback = submissions.filter((submission) => submission.feedback || submission.teacherFeedback);
  return (
    <div className="cardGrid">
      {withFeedback.length === 0 && <section className="panel"><p className="empty">No feedback is available yet.</p></section>}
      {withFeedback.map((submission) => {
        let parsed: any = null;
        try {
          parsed = submission.feedback?.feedbackJson ? JSON.parse(submission.feedback.feedbackJson) : null;
        } catch {
          parsed = { overall: submission.feedback?.feedbackJson };
        }
        return (
          <article className="resourceCard" key={submission.id}>
            <strong>{submission.assignment?.title ?? "Writing feedback"}</strong>
            <span>{new Date(submission.createdAt).toLocaleDateString()}</span>
            {parsed?.markOutOf10 != null && <div className="price">{parsed.markOutOf10}/10</div>}
            {parsed && <FeedbackView feedback={parsed} />}
            {submission.teacherFeedback && (
              <div className="teacherFeedbackBox">
                <strong>Teacher Feedback</strong>
                <p>{submission.teacherFeedback}</p>
                {submission.teacherFeedbackAt && <small>{new Date(submission.teacherFeedbackAt).toLocaleDateString()}</small>}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function AiTutor({ token, assignments, onSubmit, onDone }: { token: string; assignments: Assignment[]; onSubmit: () => void; onDone: () => void }) {
  const [students, setStudents] = useState<ReviewStudent[]>([]);
  const [studentId, setStudentId] = useState("");
  const [assignmentId, setAssignmentId] = useState(assignments[0]?.id ?? "");
  const [pastedText, setPastedText] = useState("");
  const [feedback, setFeedback] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<ReviewStudent[]>("/review/students", {}, token)
      .then((rows) => {
        setStudents(rows);
        setStudentId(rows[0]?.id ?? "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load students"));
  }, [token]);

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const response = await api<{ feedback: { feedbackJson: string; error?: string | null } }>(
        "/student/submissions",
        { method: "POST", body: JSON.stringify({ studentId, assignmentId: assignmentId || null, pastedText }) },
        token
      );
      try {
        setFeedback(JSON.parse(response.feedback.feedbackJson));
      } catch {
        setFeedback({ overall: response.feedback.feedbackJson });
      }
      if (response.feedback.error) {
        setError(`AI generated fallback feedback because OpenAI returned: ${response.feedback.error}`);
      }
      onSubmit();
      onDone();
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
            Student
            <select value={studentId} onChange={(event) => setStudentId(event.target.value)}>
              {students.map((student) => (
                <option key={student.id} value={student.id}>{student.firstName} {student.lastName} - {student.level?.gradeBand ?? "No level"}</option>
              ))}
            </select>
          </label>
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
          <button className="primary" onClick={submit} disabled={loading || pastedText.length < 20 || !studentId}>
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

function ReviewSubmissions({ levels, assignments, token, onDone }: { levels: Level[]; assignments: Assignment[]; token: string; onDone: () => void }) {
  const [levelId, setLevelId] = useState("");
  const [assignmentId, setAssignmentId] = useState("");
  const [reviewStatus, setReviewStatus] = useState("");
  const [submissions, setSubmissions] = useState<ReviewSubmission[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [teacherFeedbackDraft, setTeacherFeedbackDraft] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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

  const filteredSubmissions = useMemo(
    () => submissions.filter((submission) => {
      if (assignmentId && submission.assignment?.id !== assignmentId) return false;
      if (reviewStatus === "needs-ai" && submission.feedback) return false;
      if (reviewStatus === "needs-teacher" && submission.teacherFeedback) return false;
      if (reviewStatus === "reviewed" && (!submission.feedback || !submission.teacherFeedback)) return false;
      return true;
    }),
    [submissions, assignmentId, reviewStatus]
  );
  const selected = useMemo(() => filteredSubmissions.find((item) => item.id === selectedId) ?? filteredSubmissions[0], [filteredSubmissions, selectedId]);
  const parsedFeedback = useMemo(() => {
    if (!selected?.feedback?.feedbackJson) return null;
    try {
      return JSON.parse(selected.feedback.feedbackJson);
    } catch {
      return { overall: selected.feedback.feedbackJson };
    }
  }, [selected]);

  useEffect(() => {
    setTeacherFeedbackDraft(selected?.teacherFeedback ?? "");
  }, [selected?.id]);

  async function saveTeacherFeedback() {
    if (!selected) return;
    setError("");
    setMessage("");
    try {
      const updated = await api<ReviewSubmission>(
        `/review/submissions/${selected.id}/teacher-feedback`,
        { method: "PUT", body: JSON.stringify({ teacherFeedback: teacherFeedbackDraft }) },
        token
      );
      setSubmissions((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage("Teacher feedback saved.");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save teacher feedback");
    }
  }

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
        <label className="filterLabel">
          Assignment
          <select value={assignmentId} onChange={(event) => setAssignmentId(event.target.value)}>
            <option value="">All assignments</option>
            {assignments
              .filter((assignment) => !levelId || assignment.level.id === levelId)
              .map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.title}</option>)}
          </select>
        </label>
        <label className="filterLabel">
          Review status
          <select value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value)}>
            <option value="">All statuses</option>
            <option value="needs-ai">Needs AI feedback</option>
            <option value="needs-teacher">Needs teacher feedback</option>
            <option value="reviewed">Fully reviewed</option>
          </select>
        </label>
        {error && <div className="error">{error}</div>}
        {message && <p className="success">{message}</p>}
        {filteredSubmissions.length === 0 && <p className="empty">No submissions yet.</p>}
        <div className="submissionList">
          {filteredSubmissions.map((submission) => (
            <button
              className={selected?.id === submission.id ? "submissionItem active" : "submissionItem"}
              key={submission.id}
              onClick={() => setSelectedId(submission.id)}
            >
              <strong>{submission.student.firstName} {submission.student.lastName}</strong>
              <span>{submission.assignment?.title ?? "Writing practice"}</span>
              <small>{submission.student.student?.level.gradeBand ?? "No level"} | {new Date(submission.createdAt).toLocaleDateString()}</small>
              <div className="statusRow">
                <small className={submission.feedback ? "statusPill activeStatus" : "statusPill"}>{submission.feedback ? "AI added" : "Needs AI"}</small>
                <small className={submission.teacherFeedback ? "statusPill activeStatus" : "statusPill"}>{submission.teacherFeedback ? "Teacher added" : "Needs teacher"}</small>
              </div>
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
            <div className="writingBox">
              <strong>Teacher Feedback</strong>
              <textarea value={teacherFeedbackDraft} onChange={(event) => setTeacherFeedbackDraft(event.target.value)} placeholder="Paste or type teacher feedback for the student..." />
              <button className="primary" onClick={saveTeacherFeedback} disabled={teacherFeedbackDraft.trim().length === 0}>
                <Save size={18} /> Save teacher feedback
              </button>
              {selected.teacherFeedbackAt && <small>Last saved: {new Date(selected.teacherFeedbackAt).toLocaleString()}</small>}
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

function UserManager({ levels, token }: { levels: Level[]; token: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "STUDENT",
    levelId: levels[0]?.id ?? "",
    teacherLevelIds: levels[0] ? [levels[0].id] : [],
    temporaryPassword: "Member123!"
  });

  async function loadUsers() {
    setError("");
    try {
      setUsers(await api<AdminUser[]>("/admin/users", {}, token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load users");
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function createUser() {
    setMessage("");
    setError("");
    try {
      await api(
        "/admin/users",
        {
          method: "POST",
          body: JSON.stringify({
            email: draft.email,
            firstName: draft.firstName,
            lastName: draft.lastName,
            role: draft.role,
            levelId: draft.role === "STUDENT" ? draft.levelId : null,
            teacherLevelIds: draft.role === "TEACHER" ? draft.teacherLevelIds : [],
            temporaryPassword: draft.temporaryPassword
          })
        },
        token
      );
      setDraft({ ...draft, firstName: "", lastName: "", email: "", temporaryPassword: "Member123!" });
      setMessage("User created.");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create user");
    }
  }

  async function updateUser(user: AdminUser, changes: Record<string, unknown>) {
    setMessage("");
    setError("");
    try {
      await api(`/admin/users/${user.id}`, { method: "PUT", body: JSON.stringify(changes) }, token);
      setMessage("User updated.");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update user");
    }
  }

  function changeUserRole(user: AdminUser, role: AdminUser["role"]) {
    if (role === "STUDENT") {
      updateUser(user, { role, levelId: user.level?.id ?? levels[0]?.id ?? "" });
      return;
    }

    if (role === "TEACHER") {
      const teacherLevelIds = user.teacherLevels.length > 0
        ? user.teacherLevels.map((level) => level.id)
        : levels[0] ? [levels[0].id] : [];
      updateUser(user, { role, teacherLevelIds });
      return;
    }

    updateUser(user, { role });
  }

  async function resetPassword(user: AdminUser) {
    const temporaryPassword = window.prompt(`Temporary password for ${user.email}`, "Member123!");
    if (!temporaryPassword) return;
    setMessage("");
    setError("");
    try {
      await api(`/admin/users/${user.id}/reset-password`, { method: "POST", body: JSON.stringify({ temporaryPassword }) }, token);
      setMessage(`Temporary password reset for ${user.email}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password");
    }
  }

  function toggleDraftTeacherLevel(levelId: string) {
    setDraft((current) => ({
      ...current,
      teacherLevelIds: current.teacherLevelIds.includes(levelId)
        ? current.teacherLevelIds.filter((id) => id !== levelId)
        : [...current.teacherLevelIds, levelId]
    }));
  }

  function toggleUserTeacherLevel(user: AdminUser, levelId: string) {
    const currentIds = user.teacherLevels.map((level) => level.id);
    const teacherLevelIds = currentIds.includes(levelId) ? currentIds.filter((id) => id !== levelId) : [...currentIds, levelId];
    updateUser(user, { teacherLevelIds });
  }

  function statusLabel(status: AdminUser["status"]) {
    if (status === "PENDING_APPROVAL") return "Pending approval";
    return status[0] + status.slice(1).toLowerCase();
  }

  const students = users.filter((user) => user.role === "STUDENT");
  const teachers = users.filter((user) => user.role === "TEACHER");
  const admins = users.filter((user) => user.role === "ADMIN");

  return (
    <div className="userManager">
      <section className="panel">
        <h3>Create User</h3>
        <div className="form compact">
          <select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })}>
            <option value="STUDENT">Student</option>
            <option value="TEACHER">Teacher</option>
            <option value="ADMIN">Admin</option>
          </select>
          <input placeholder="First name" value={draft.firstName} onChange={(event) => setDraft({ ...draft, firstName: event.target.value })} />
          <input placeholder="Last name" value={draft.lastName} onChange={(event) => setDraft({ ...draft, lastName: event.target.value })} />
          <input placeholder="Email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
          <input placeholder="Temporary password" value={draft.temporaryPassword} onChange={(event) => setDraft({ ...draft, temporaryPassword: event.target.value })} />
          {draft.role === "STUDENT" ? (
            <select value={draft.levelId} onChange={(event) => setDraft({ ...draft, levelId: event.target.value })}>
              {levels.map((level) => <option key={level.id} value={level.id}>{level.gradeBand}</option>)}
            </select>
          ) : draft.role === "TEACHER" ? (
            <div className="resourceChecklist">
              {levels.map((level) => (
                <label key={level.id}>
                  <input type="checkbox" checked={draft.teacherLevelIds.includes(level.id)} onChange={() => toggleDraftTeacherLevel(level.id)} />
                  <span>{level.gradeBand}</span>
                </label>
              ))}
            </div>
          ) : null}
          <button className="primary" onClick={createUser}><Plus size={18} /> Create user</button>
          {message && <p className="success">{message}</p>}
          {error && <div className="error">{error}</div>}
        </div>
      </section>

      <section className="panel">
        <h3>Students</h3>
        <div className="userList">
          {students.map((user) => (
            <div className="userRow" key={user.id}>
              <div>
                <strong>{user.firstName} {user.lastName}</strong>
                <span>{user.email}</span>
                <small className={user.status === "ACTIVE" ? "statusPill activeStatus" : user.status === "PENDING_APPROVAL" ? "statusPill pendingStatus" : "statusPill dangerStatus"}>
                  {statusLabel(user.status)}
                </small>
              </div>
              <select value={user.role} onChange={(event) => changeUserRole(user, event.target.value as AdminUser["role"])}>
                <option value="STUDENT">Student</option>
                <option value="TEACHER">Teacher</option>
                <option value="ADMIN">Admin</option>
              </select>
              <select value={user.level?.id ?? ""} onChange={(event) => updateUser(user, { levelId: event.target.value })}>
                {levels.map((level) => <option key={level.id} value={level.id}>{level.gradeBand}</option>)}
              </select>
              {user.status === "PENDING_APPROVAL" && (
                <button className="primary" onClick={() => updateUser(user, { status: "ACTIVE" })}>
                  <CheckCircle2 size={18} /> Approve
                </button>
              )}
              <button className="secondary" onClick={() => updateUser(user, { status: user.status === "ACTIVE" ? "DISABLED" : "ACTIVE" })}>
                {user.status === "ACTIVE" ? "Disable" : "Enable"}
              </button>
              <button className="secondary" onClick={() => resetPassword(user)}>Reset Password</button>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>Teachers</h3>
        <div className="userList">
          {teachers.map((user) => (
            <div className="userRow teacherUser" key={user.id}>
              <div>
                <strong>{user.firstName} {user.lastName}</strong>
                <span>{user.email}</span>
                <small className={user.status === "ACTIVE" ? "statusPill activeStatus" : user.status === "PENDING_APPROVAL" ? "statusPill pendingStatus" : "statusPill dangerStatus"}>
                  {statusLabel(user.status)}
                </small>
              </div>
              <select value={user.role} onChange={(event) => changeUserRole(user, event.target.value as AdminUser["role"])}>
                <option value="STUDENT">Student</option>
                <option value="TEACHER">Teacher</option>
                <option value="ADMIN">Admin</option>
              </select>
              <div className="resourceChecklist compactChecklist">
                {levels.map((level) => (
                  <label key={level.id}>
                    <input type="checkbox" checked={user.teacherLevels.some((item) => item.id === level.id)} onChange={() => toggleUserTeacherLevel(user, level.id)} />
                    <span>{level.gradeBand}</span>
                  </label>
                ))}
              </div>
              <button className="secondary" onClick={() => updateUser(user, { status: user.status === "ACTIVE" ? "DISABLED" : "ACTIVE" })}>
                {user.status === "ACTIVE" ? "Disable" : "Enable"}
              </button>
              <button className="secondary" onClick={() => resetPassword(user)}>Reset Password</button>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>Admins</h3>
        <div className="userList">
          {admins.map((user) => (
            <div className="userRow" key={user.id}>
              <div>
                <strong>{user.firstName} {user.lastName}</strong>
                <span>{user.email}</span>
                <small className={user.status === "ACTIVE" ? "statusPill activeStatus" : user.status === "PENDING_APPROVAL" ? "statusPill pendingStatus" : "statusPill dangerStatus"}>
                  {statusLabel(user.status)}
                </small>
              </div>
              <select value={user.role} onChange={(event) => changeUserRole(user, event.target.value as AdminUser["role"])}>
                <option value="STUDENT">Student</option>
                <option value="TEACHER">Teacher</option>
                <option value="ADMIN">Admin</option>
              </select>
              <button className="secondary" onClick={() => updateUser(user, { status: user.status === "ACTIVE" ? "DISABLED" : "ACTIVE" })}>
                {user.status === "ACTIVE" ? "Disable" : "Enable"}
              </button>
              <button className="secondary" onClick={() => resetPassword(user)}>Reset Password</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function WebsiteContentManager({ token }: { token: string }) {
  const [draft, setDraft] = useState<SiteContent>(defaultSiteContent);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      setDraft(await api<SiteContent>("/admin/site-content", {}, token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load website content");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setMessage("");
    setError("");
    try {
      setDraft(await api<SiteContent>("/admin/site-content", { method: "PUT", body: JSON.stringify(draft) }, token));
      setMessage("Website content saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save website content");
    }
  }

  return (
    <div className="twoCol">
      <section className="panel">
        <h3>Landing Page Content</h3>
        <div className="form">
          <label>
            Small heading
            <input value={draft.heroEyebrow} onChange={(event) => setDraft({ ...draft, heroEyebrow: event.target.value })} />
          </label>
          <label>
            Main headline
            <textarea value={draft.heroTitle} onChange={(event) => setDraft({ ...draft, heroTitle: event.target.value })} />
          </label>
          <label>
            Description
            <textarea value={draft.heroSubtitle} onChange={(event) => setDraft({ ...draft, heroSubtitle: event.target.value })} />
          </label>
          <label>
            Announcement
            <input value={draft.announcement ?? ""} onChange={(event) => setDraft({ ...draft, announcement: event.target.value })} />
          </label>
          <label>
            Login title
            <input value={draft.loginTitle} onChange={(event) => setDraft({ ...draft, loginTitle: event.target.value })} />
          </label>
          <label>
            Login helper text
            <input value={draft.loginHint} onChange={(event) => setDraft({ ...draft, loginHint: event.target.value })} />
          </label>
          <label>
            Signup title
            <input value={draft.signupTitle} onChange={(event) => setDraft({ ...draft, signupTitle: event.target.value })} />
          </label>
          <label>
            Signup helper text
            <input value={draft.signupHint ?? ""} onChange={(event) => setDraft({ ...draft, signupHint: event.target.value })} />
          </label>
          {message && <p className="success">{message}</p>}
          {error && <div className="error">{error}</div>}
          <button className="primary" onClick={save}><Save size={18} /> Save website content</button>
        </div>
      </section>

      <section className="panel">
        <h3>Grade Card Text</h3>
        <div className="form">
          <label>
            Grade 2/3 title
            <input value={draft.grade2Title} onChange={(event) => setDraft({ ...draft, grade2Title: event.target.value })} />
          </label>
          <label>
            Grade 2/3 description
            <textarea value={draft.grade2Text} onChange={(event) => setDraft({ ...draft, grade2Text: event.target.value })} />
          </label>
          <label>
            Grade 4/5/6 title
            <input value={draft.grade456Title} onChange={(event) => setDraft({ ...draft, grade456Title: event.target.value })} />
          </label>
          <label>
            Grade 4/5/6 description
            <textarea value={draft.grade456Text} onChange={(event) => setDraft({ ...draft, grade456Text: event.target.value })} />
          </label>
          <label>
            Grade 7/8/9 title
            <input value={draft.grade789Title} onChange={(event) => setDraft({ ...draft, grade789Title: event.target.value })} />
          </label>
          <label>
            Grade 7/8/9 description
            <textarea value={draft.grade789Text} onChange={(event) => setDraft({ ...draft, grade789Text: event.target.value })} />
          </label>
        </div>
      </section>
    </div>
  );
}

function AccountSettings({ token }: { token: string }) {
  const [draft, setDraft] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (draft.newPassword !== draft.confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    try {
      await api("/me/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: draft.currentPassword,
          newPassword: draft.newPassword
        })
      }, token);
      setDraft({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setMessage("Password changed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password");
    }
  }

  return (
    <section className="panel accountPanel">
      <h3>Change Password</h3>
      <form className="form" onSubmit={savePassword}>
        <label>
          Current password
          <input type="password" value={draft.currentPassword} onChange={(event) => setDraft({ ...draft, currentPassword: event.target.value })} />
        </label>
        <label>
          New password
          <input type="password" value={draft.newPassword} onChange={(event) => setDraft({ ...draft, newPassword: event.target.value })} />
        </label>
        <label>
          Confirm new password
          <input type="password" value={draft.confirmPassword} onChange={(event) => setDraft({ ...draft, confirmPassword: event.target.value })} />
        </label>
        {message && <p className="success">{message}</p>}
        {error && <div className="error">{error}</div>}
        <button className="primary" type="submit" disabled={draft.currentPassword.length < 8 || draft.newPassword.length < 8 || draft.confirmPassword.length < 8}>
          <Save size={18} /> Change password
        </button>
      </form>
    </section>
  );
}

type ResourceDraft = {
  title: string;
  description: string;
  type: Resource["type"];
  accessMode: Resource["accessMode"];
  levelId: string;
  topicId: string;
  lessonId: string;
  url: string;
  isPublished: boolean;
};

function AdminTools({ data, token, onChange }: { data: DashboardData; token: string; onChange: () => void }) {
  const [resource, setResource] = useState({
    title: "",
    description: "",
    type: "PDF",
    accessMode: "LEVEL_ASSIGNED",
    levelId: data.levels[0]?.id ?? "",
    topicId: "",
    lessonId: "",
    url: "",
    isPublished: true
  });
  const [resourceMode, setResourceMode] = useState<"file" | "link">("file");
  const [file, setFile] = useState<File | null>(null);
  const [assignment, setAssignment] = useState({
    title: "",
    instructions: "",
    wordCountGuidance: "",
    levelId: data.levels[0]?.id ?? "",
    topicId: "",
    lessonId: "",
    isPublished: true,
    dueAt: ""
  });
  const [topic, setTopic] = useState({
    title: "",
    description: "",
    levelId: data.levels[0]?.id ?? "",
    sortOrder: "1",
    isPublished: false
  });
  const [lesson, setLesson] = useState({
    title: "",
    description: "",
    topicId: data.curriculum[0]?.id ?? "",
    sortOrder: "1",
    startsAt: "",
    endsAt: "",
    isPublished: false
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
  const [resourceDrafts, setResourceDrafts] = useState<Record<string, ResourceDraft>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function topicsForLevel(levelId: string) {
    return data.curriculum.filter((item) => item.levelId === levelId);
  }

  function lessonsForTopic(topicId: string) {
    return data.curriculum.find((item) => item.id === topicId)?.lessons ?? [];
  }

  async function createTopic() {
    setMessage("");
    setError("");
    try {
      await api("/admin/topics", {
        method: "POST",
        body: JSON.stringify({
          ...topic,
          sortOrder: Number(topic.sortOrder),
          description: topic.description || null
        })
      }, token);
      setTopic({ ...topic, title: "", description: "", sortOrder: String(Number(topic.sortOrder) + 1) });
      setMessage("Topic saved.");
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save topic");
    }
  }

  async function updateTopic(topicId: string, changes: Record<string, unknown>) {
    setMessage("");
    setError("");
    try {
      await api(`/admin/topics/${topicId}`, { method: "PUT", body: JSON.stringify(changes) }, token);
      setMessage("Topic updated.");
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update topic");
    }
  }

  async function createLesson() {
    setMessage("");
    setError("");
    if (!lesson.topicId) {
      setError("Create or choose a topic before adding a lesson.");
      return;
    }
    try {
      await api("/admin/lessons", {
        method: "POST",
        body: JSON.stringify({
          ...lesson,
          sortOrder: Number(lesson.sortOrder),
          description: lesson.description || null,
          startsAt: lesson.startsAt || null,
          endsAt: lesson.endsAt || null
        })
      }, token);
      setLesson({ ...lesson, title: "", description: "", startsAt: "", endsAt: "", sortOrder: String(Number(lesson.sortOrder) + 1) });
      setMessage("Lesson saved.");
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save lesson");
    }
  }

  async function updateLesson(lessonId: string, changes: Record<string, unknown>) {
    setMessage("");
    setError("");
    try {
      await api(`/admin/lessons/${lessonId}`, { method: "PUT", body: JSON.stringify(changes) }, token);
      setMessage("Lesson updated.");
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update lesson");
    }
  }

  async function createResource() {
    setMessage("");
    setError("");
    try {
      if (resourceMode === "file") {
        if (!file) {
          setError("Choose a file before uploading.");
          return;
        }
        const form = new FormData();
        form.append("file", file);
        Object.entries(resource).forEach(([key, value]) => form.append(key, String(value)));
        await uploadApi("/admin/resources/upload", form, token);
        setFile(null);
      } else {
        await api("/admin/resources", {
          method: "POST",
          body: JSON.stringify({
            ...resource,
            topicId: resource.topicId || null,
            lessonId: resource.lessonId || null
          })
        }, token);
      }
      setResource({ ...resource, title: "", description: "", url: "" });
      setMessage("Resource saved.");
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save resource");
    }
  }

  async function createAssignment() {
    setMessage("");
    setError("");
    try {
      await api("/admin/assignments", {
        method: "POST",
        body: JSON.stringify({
          ...assignment,
          dueAt: assignment.dueAt || null,
          wordCountGuidance: assignment.wordCountGuidance || null,
          topicId: assignment.topicId || null,
          lessonId: assignment.lessonId || null
        })
      }, token);
      setAssignment({ ...assignment, title: "", instructions: "", wordCountGuidance: "", dueAt: "" });
      setMessage("Assignment saved.");
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save assignment");
    }
  }

  async function createProduct() {
    setMessage("");
    setError("");
    if (product.resourceIds.length === 0) {
      setError("Select at least one resource for the product.");
      return;
    }
    try {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save product");
    }
  }

  function toggleProductResource(resourceId: string) {
    setProduct((current) => ({
      ...current,
      resourceIds: current.resourceIds.includes(resourceId)
        ? current.resourceIds.filter((id) => id !== resourceId)
        : [...current.resourceIds, resourceId]
    }));
  }

  function ensureResourceDraft(resource: Resource) {
    setResourceDrafts((current) => ({
      ...current,
      [resource.id]: current[resource.id] ?? {
        title: resource.title,
        description: resource.description,
        type: resource.type,
        accessMode: resource.accessMode,
        levelId: resource.level?.id ?? "",
        topicId: resource.topic?.id ?? "",
        lessonId: resource.lesson?.id ?? "",
        url: resource.url ?? "",
        isPublished: resource.isPublished
      }
    }));
  }

  async function updateResource(resource: Resource, changes?: Partial<ResourceDraft>) {
    const draft = { ...resourceDrafts[resource.id], ...changes };
    if (!draft) return;
    setMessage("");
    setError("");
    try {
      await api(`/admin/resources/${resource.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: draft.title,
          description: draft.description,
          type: draft.type,
          accessMode: draft.accessMode,
          levelId: draft.levelId || null,
          topicId: draft.topicId || null,
          lessonId: draft.lessonId || null,
          url: draft.url || null,
          isPublished: draft.isPublished
        })
      }, token);
      setMessage("Resource updated.");
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update resource");
    }
  }

  async function deleteResource(resource: Resource) {
    if (!window.confirm(`Permanently delete "${resource.title}"? This removes it from student view, product links, and student resource access records. This cannot be undone.`)) return;
    setMessage("");
    setError("");
    try {
      await api(`/admin/resources/${resource.id}`, { method: "DELETE" }, token);
      setMessage("Resource deleted.");
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete resource");
    }
  }

  return (
    <>
    <div className="adminGrid">
      <section className="panel">
        <h3>Curriculum Topics</h3>
        <div className="form compact">
          <select value={topic.levelId} onChange={(event) => setTopic({ ...topic, levelId: event.target.value })}>
            {data.levels.map((level) => <option key={level.id} value={level.id}>{level.gradeBand}</option>)}
          </select>
          <input placeholder="Topic title, e.g. Thesis Writing" value={topic.title} onChange={(event) => setTopic({ ...topic, title: event.target.value })} />
          <textarea placeholder="Topic description" value={topic.description} onChange={(event) => setTopic({ ...topic, description: event.target.value })} />
          <input placeholder="Sort order" value={topic.sortOrder} onChange={(event) => setTopic({ ...topic, sortOrder: event.target.value })} />
          <label className="inlineCheck">
            <input type="checkbox" checked={topic.isPublished} onChange={(event) => setTopic({ ...topic, isPublished: event.target.checked })} />
            Visible to students
          </label>
          <button className="primary" onClick={createTopic}><Plus size={18} /> Add topic</button>
        </div>
      </section>
      <section className="panel">
        <h3>Lessons / Weeks</h3>
        <div className="form compact">
          <select value={lesson.topicId} onChange={(event) => setLesson({ ...lesson, topicId: event.target.value })}>
            <option value="">Choose topic</option>
            {data.curriculum.map((item) => <option key={item.id} value={item.id}>{item.level?.gradeBand ?? "Level"} - {item.title}</option>)}
          </select>
          <input placeholder="Lesson title, e.g. Week 1: Thesis Basics" value={lesson.title} onChange={(event) => setLesson({ ...lesson, title: event.target.value })} />
          <textarea placeholder="Lesson description" value={lesson.description} onChange={(event) => setLesson({ ...lesson, description: event.target.value })} />
          <input placeholder="Sort order" value={lesson.sortOrder} onChange={(event) => setLesson({ ...lesson, sortOrder: event.target.value })} />
          <input type="date" value={lesson.startsAt} onChange={(event) => setLesson({ ...lesson, startsAt: event.target.value })} />
          <input type="date" value={lesson.endsAt} onChange={(event) => setLesson({ ...lesson, endsAt: event.target.value })} />
          <label className="inlineCheck">
            <input type="checkbox" checked={lesson.isPublished} onChange={(event) => setLesson({ ...lesson, isPublished: event.target.checked })} />
            Visible to students
          </label>
          <button className="primary" onClick={createLesson}><Plus size={18} /> Add lesson</button>
        </div>
      </section>
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
          <select value={resource.topicId} onChange={(event) => setResource({ ...resource, topicId: event.target.value, lessonId: "" })}>
            <option value="">No topic</option>
            {topicsForLevel(resource.levelId).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
          <select value={resource.lessonId} onChange={(event) => setResource({ ...resource, lessonId: event.target.value })} disabled={!resource.topicId}>
            <option value="">No lesson</option>
            {lessonsForTopic(resource.topicId).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
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
          <input placeholder="Word count guidance, e.g. 300-500 words" value={assignment.wordCountGuidance} onChange={(event) => setAssignment({ ...assignment, wordCountGuidance: event.target.value })} />
          <input type="date" value={assignment.dueAt} onChange={(event) => setAssignment({ ...assignment, dueAt: event.target.value })} />
          <select value={assignment.levelId} onChange={(event) => setAssignment({ ...assignment, levelId: event.target.value })}>
            {data.levels.map((level) => <option key={level.id} value={level.id}>{level.gradeBand}</option>)}
          </select>
          <select value={assignment.topicId} onChange={(event) => setAssignment({ ...assignment, topicId: event.target.value, lessonId: "" })}>
            <option value="">No topic</option>
            {topicsForLevel(assignment.levelId).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
          <select value={assignment.lessonId} onChange={(event) => setAssignment({ ...assignment, lessonId: event.target.value })} disabled={!assignment.topicId}>
            <option value="">No lesson</option>
            {lessonsForTopic(assignment.topicId).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
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
      {(message || error) && (
        <section className="panel wide">
          {message && <p className="success">{message}</p>}
          {error && <div className="error">{error}</div>}
        </section>
      )}
    </div>
    <section className="panel adminWide">
      <h3>Curriculum Map</h3>
      <div className="curriculumList">
        {data.curriculum.length === 0 && <p className="empty">No topics yet. Add a topic for each level, then attach lessons, resources, and assignments.</p>}
        {data.curriculum.map((item) => (
          <article className="curriculumRow" key={item.id}>
            <div>
              <strong>{item.title}</strong>
              <span>{item.level?.gradeBand ?? "Level"} | {item.lessons.length} lessons</span>
              {item.description && <p>{item.description}</p>}
            </div>
            <div className="statusRow">
              <small className={item.isPublished ? "statusPill activeStatus" : "statusPill"}>{item.isPublished ? "Visible" : "Hidden"}</small>
              <button className="secondary" onClick={() => updateTopic(item.id, { isPublished: !item.isPublished })}>
                {item.isPublished ? "Hide topic" : "Publish topic"}
              </button>
            </div>
            <div className="lessonList">
              {item.lessons.map((row) => (
                <div className="lessonRow" key={row.id}>
                  <span>{row.title}</span>
                  <small className={row.isPublished ? "statusPill activeStatus" : "statusPill"}>{row.isPublished ? "Visible" : "Hidden"}</small>
                  <button className="secondary" onClick={() => updateLesson(row.id, { isPublished: !row.isPublished })}>
                    {row.isPublished ? "Hide" : "Publish"}
                  </button>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
    <section className="panel adminWide">
      <h3>Manage Resources</h3>
      <div className="managementList">
        {data.resources.map((item) => {
          const draft = resourceDrafts[item.id];
          return (
            <article className="managementRow" key={item.id} onMouseEnter={() => ensureResourceDraft(item)}>
              <div>
                <strong>{item.title}</strong>
                <span>{item.level?.gradeBand ?? "All levels"} | {item.type.replace("_", " ")}</span>
                <div className="statusRow">
                  <small className={item.isPublished ? "statusPill activeStatus" : "statusPill"}>{item.isPublished ? "Published" : "Hidden"}</small>
                  <small className="statusPill">{item.accessMode.replace("_", " ")}</small>
                  {item.topic && <small className="statusPill">{item.topic.title}</small>}
                  {item.lesson && <small className="statusPill">{item.lesson.title}</small>}
                </div>
              </div>
              {draft ? (
                <div className="managementEditor">
                  <input value={draft.title} onChange={(event) => setResourceDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], title: event.target.value } }))} />
                  <textarea value={draft.description} onChange={(event) => setResourceDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], description: event.target.value } }))} />
                  <select value={draft.type} onChange={(event) => setResourceDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], type: event.target.value as Resource["type"] } }))}>
                    <option value="DOCUMENT">Document</option>
                    <option value="PDF">PDF</option>
                    <option value="WORKSHEET">Worksheet</option>
                    <option value="VIDEO_LINK">Video link</option>
                    <option value="BOOK">Book</option>
                  </select>
                  <select value={draft.accessMode} onChange={(event) => setResourceDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], accessMode: event.target.value as Resource["accessMode"] } }))}>
                    <option value="FREE">Free</option>
                    <option value="LEVEL_ASSIGNED">Level assigned</option>
                    <option value="INDIVIDUAL_PURCHASE">Individual purchase</option>
                    <option value="BUNDLE_PURCHASE">Bundle purchase</option>
                  </select>
                  <select value={draft.levelId} onChange={(event) => setResourceDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], levelId: event.target.value } }))}>
                    <option value="">All levels</option>
                    {data.levels.map((level) => <option key={level.id} value={level.id}>{level.gradeBand}</option>)}
                  </select>
                  <select value={draft.topicId} onChange={(event) => setResourceDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], topicId: event.target.value, lessonId: "" } }))}>
                    <option value="">No topic</option>
                    {topicsForLevel(draft.levelId).map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
                  </select>
                  <select value={draft.lessonId} onChange={(event) => setResourceDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], lessonId: event.target.value } }))} disabled={!draft.topicId}>
                    <option value="">No lesson</option>
                    {lessonsForTopic(draft.topicId).map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}
                  </select>
                  <input placeholder="URL, if this is a link resource" value={draft.url} onChange={(event) => setResourceDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], url: event.target.value } }))} />
                  <label className="inlineCheck">
                    <input type="checkbox" checked={draft.isPublished} onChange={(event) => setResourceDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], isPublished: event.target.checked } }))} />
                    Published
                  </label>
                  <div className="buttonRow">
                    <button className="primary" onClick={() => updateResource(item)}><Save size={18} /> Save</button>
                    <button className="secondary" onClick={() => updateResource(item, { isPublished: false })}>Unpublish</button>
                    <button className="secondary dangerButton" onClick={() => deleteResource(item)}><Trash2 size={18} /> Delete permanently</button>
                  </div>
                </div>
              ) : (
                <button className="secondary" onClick={() => ensureResourceDraft(item)}>Edit resource</button>
              )}
            </article>
          );
        })}
      </div>
    </section>
    </>
  );
}
