"use client";

import "@xyflow/react/dist/style.css";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  addEdge,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  getBezierPath,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type EdgeProps,
} from "@xyflow/react";
import Image from "next/image";
import {
  BarChart2,
  BookOpen,
  ChevronDown,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  KeyRound,
  Loader2,
  PenLine,
  Plus,
  PlusCircle,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "~/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

/* ------------------------------------------------------------------ */
/*  Grade system                                                       */
/* ------------------------------------------------------------------ */

const GRADE_MAP: Record<string, number> = {
  A: 5,
  B: 4,
  C: 3,
  D: 2,
  E: 1,
  F: 0,
};

const GRADES = Object.keys(GRADE_MAP);

function gradePoint(grade: string): number {
  return GRADE_MAP[grade] ?? 0;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Course = {
  id: string;
  name: string;
  grade: string;
  creditHours: number;
};

type SemesterMode = "courses" | "direct";

type SemesterNodeData = {
  kind: "semester";
  label: string;
  mode: SemesterMode;
  courses: Course[];
  directGpa: number;
  directCredits: number;
};

type CGPANode = Node<SemesterNodeData>;

/* ------------------------------------------------------------------ */
/*  Calculation helpers                                                */
/* ------------------------------------------------------------------ */

function semesterGpa(data: SemesterNodeData): number {
  if (data.mode === "direct") return data.directGpa;
  const courses = data.courses;
  if (courses.length === 0) return 0;
  const totalPoints = courses.reduce(
    (sum, c) => sum + gradePoint(c.grade) * c.creditHours,
    0,
  );
  const totalCredits = courses.reduce((sum, c) => sum + c.creditHours, 0);
  return totalCredits > 0 ? totalPoints / totalCredits : 0;
}

function semesterCredits(data: SemesterNodeData): number {
  if (data.mode === "direct") return data.directCredits;
  return data.courses.reduce((sum, c) => sum + c.creditHours, 0);
}

function semesterQualityPoints(data: SemesterNodeData): number {
  if (data.mode === "direct") return data.directGpa * data.directCredits;
  return data.courses.reduce(
    (sum, c) => sum + gradePoint(c.grade) * c.creditHours,
    0,
  );
}

function calculateCGPA(nodes: CGPANode[]): number {
  let totalQP = 0;
  let totalCH = 0;
  for (const node of nodes) {
    const d = node.data;
    const credits = semesterCredits(d);
    if (credits <= 0) continue;
    totalQP += semesterQualityPoints(d);
    totalCH += credits;
  }
  return totalCH > 0 ? totalQP / totalCH : 0;
}

function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ------------------------------------------------------------------ */
/*  Nile Portal — types & API                                         */
/* ------------------------------------------------------------------ */

const NILE_BASE = "https://nile-sis-backend-106439b8f7b9.herokuapp.com";

type NileCourse = {
  semester: string;
  code: string;
  name: string;
  grade: string;
  section: string;
  credit: number;
};

type NileSemester = {
  semester: string;
  gpa?: string;
  cgpa?: string;
  totalCredits?: number;
  courses: NileCourse[];
};

type NileCoursesResponse = {
  courses: NileCourse[];
  semesters: NileSemester[];
};

/** Login → return the auth token string */
async function nileLogin(studentId: string, password: string): Promise<string> {
  const res = await fetch(`${NILE_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentId, password }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Login failed (${res.status})`);
  }
  // The API returns JSON { session: "..." }
  const json = (await res.json()) as Record<string, unknown>;
  if (typeof json.session === "string") return json.session;
  throw new Error("Login response did not contain a session token.");
}

/** Fetch courses using the session token */
async function nileFetchCourses(session: string): Promise<NileCoursesResponse> {
  const res = await fetch(`${NILE_BASE}/courses`, {
    headers: { Authorization: session },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch courses (${res.status})`);
  }
  return (await res.json()) as NileCoursesResponse;
}

/**
 * Convert Nile Portal semesters → CGPANodes.
 * Courses with grade "IP" are skipped.
 * Semesters whose all courses are IP (no graded courses) are omitted.
 */
function nileToNodes(data: NileCoursesResponse, xOffset: number): CGPANode[] {
  const result: CGPANode[] = [];

  data.semesters.forEach((sem, i) => {
    const gradedCourses = sem.courses.filter((c) => c.grade !== "IP");
    if (gradedCourses.length === 0) return;

    const courses: Course[] = gradedCourses.map((c) => ({
      id: uid(),
      name: `${c.code} – ${c.name}`,
      grade: c.grade in GRADE_MAP ? c.grade : "F",
      creditHours: c.credit,
    }));

    const node: CGPANode = {
      id: uid(),
      type: "semester",
      position: { x: xOffset + i * 340, y: 200 },
      data: {
        kind: "semester",
        label: sem.semester,
        mode: "courses",
        courses,
        directGpa: 0,
        directCredits: 0,
      },
    };

    result.push(node);
  });

  return result;
}

/* ------------------------------------------------------------------ */
/*  Nile Portal Login Dialog                                           */
/* ------------------------------------------------------------------ */

type NileImportMode = "add" | "replace";

function NilePortalDialog({
  open,
  mode,
  onClose,
  onImport,
}: {
  open: boolean;
  mode: NileImportMode;
  onClose: () => void;
  onImport: (nodes: CGPANode[]) => void;
}) {
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (loading) return;
    setStudentId("");
    setPassword("");
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId.trim() || !password.trim()) {
      setError("Please enter your Student ID and password.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const token = await nileLogin(studentId.trim(), password);
      const data = await nileFetchCourses(token);
      const nodes = nileToNodes(data, 80);
      if (nodes.length === 0) {
        setError(
          "No graded semesters found. Courses marked 'In Progress' are not imported.",
        );
        setLoading(false);
        return;
      }
      onImport(nodes);
      handleClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent className="max-w-sm rounded-2xl border-[#e8e0d6] bg-[#faf8f5] p-0 shadow-xl">
        {/* Header */}
        <DialogHeader className="border-b border-[#ece4db] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#5c6bc0]">
              <Image
                src="/nile.png"
                alt="Nile"
                width={16}
                height={16}
                className="rounded-sm"
              />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold text-[#1a1a2e]">
                Nile Portal Import
              </DialogTitle>
              <DialogDescription className="text-[11px] text-[#8b8b9e]">
                {mode === "replace"
                  ? "Replace all semesters with your Nile Portal data"
                  : "Add your Nile Portal semesters to the canvas"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3 px-5 py-4">
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[#999]">
              Student ID
            </label>
            <Input
              autoFocus
              placeholder="e.g. 22/1234"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              disabled={loading}
              className="h-9 rounded-lg border-[#e0d6cc] bg-white text-sm text-[#1a1a2e] shadow-none focus-visible:ring-1 focus-visible:ring-[#5c6bc0]/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[#999]">
              Password
            </label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="h-9 rounded-lg border-[#e0d6cc] bg-white text-sm text-[#1a1a2e] shadow-none focus-visible:ring-1 focus-visible:ring-[#5c6bc0]/30"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[11px] text-red-600">
              {error}
            </p>
          )}

          <p className="text-[10px] text-[#bbb]">
            Courses marked &ldquo;In Progress&rdquo; are not imported. Your
            credentials are only used for this request and are never stored.
          </p>

          <DialogFooter className="gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 rounded-lg border border-[#e0d6cc] bg-white py-2 text-xs font-medium text-[#555] transition hover:bg-[#f5f0ea] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#5c6bc0] py-2 text-xs font-medium text-white transition hover:bg-[#4a5ab0] disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Importing…
                </>
              ) : (
                <>
                  <KeyRound className="h-3.5 w-3.5" />
                  {mode === "replace" ? "Replace & Import" : "Add to Canvas"}
                </>
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Custom Dashed Edge                                                 */
/* ------------------------------------------------------------------ */

function DashedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeColor = (data as { color?: string })?.color ?? "#c4b5a4";

  return (
    <path
      id={id}
      style={{
        ...style,
        stroke: edgeColor,
        strokeWidth: 1.5,
        strokeDasharray: "6 4",
        fill: "none",
        opacity: 0.5,
      }}
      className="react-flow__edge-path"
      d={edgePath}
      markerEnd={markerEnd}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  GPA color helpers                                                  */
/* ------------------------------------------------------------------ */

function gpaColor(gpa: number): string {
  if (gpa >= 4.5) return "#2e7d32";
  if (gpa >= 3.5) return "#1565c0";
  if (gpa >= 2.5) return "#e65100";
  if (gpa >= 1.5) return "#bf360c";
  return "#c62828";
}

function gpaBadgeBg(gpa: number): string {
  if (gpa >= 4.5) return "#e8f5e9";
  if (gpa >= 3.5) return "#e3f2fd";
  if (gpa >= 2.5) return "#fff3e0";
  if (gpa >= 1.5) return "#fbe9e7";
  return "#ffebee";
}

function gradeColor(grade: string): string {
  switch (grade) {
    case "A":
      return "#2e7d32";
    case "B":
      return "#1565c0";
    case "C":
      return "#e65100";
    case "D":
      return "#bf360c";
    case "E":
      return "#c62828";
    case "F":
      return "#b71c1c";
    default:
      return "#999";
  }
}

function gradeChipBg(grade: string): string {
  switch (grade) {
    case "A":
      return "#e8f5e9";
    case "B":
      return "#e3f2fd";
    case "C":
      return "#fff3e0";
    case "D":
      return "#fbe9e7";
    case "E":
      return "#ffebee";
    case "F":
      return "#ffebee";
    default:
      return "#f5f5f5";
  }
}

/* ------------------------------------------------------------------ */
/*  Semester Node                                                      */
/* ------------------------------------------------------------------ */

function SemesterNode({ data, selected }: NodeProps<CGPANode>) {
  const gpa = semesterGpa(data);
  const credits = semesterCredits(data);
  const courseCount = data.mode === "courses" ? data.courses.length : null;

  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Left}
        className="!-left-1 !top-1/2 !h-2.5 !w-2.5 !rounded-full !border-2 !border-[#e8ddd0] !bg-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!-right-1 !top-1/2 !h-2.5 !w-2.5 !rounded-full !border-2 !border-[#e8ddd0] !bg-white"
      />

      <div
        className={cn(
          "w-[240px] rounded-lg border bg-white shadow-sm transition-all",
          selected
            ? "border-[#ff6d5a]/50 shadow-[0_0_0_2px_rgba(255,109,90,0.15)]"
            : "border-[#e0d5c8]",
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 border-b border-[#f0e8df] px-3 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#5c6bc0]">
            <BookOpen className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-[#1a1a2e]">
            {data.label}
          </span>
        </div>

        {/* Body */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            {courseCount !== null && (
              <span className="text-[11px] text-[#8b8b9e]">
                {courseCount} course{courseCount !== 1 ? "s" : ""}
              </span>
            )}
            {credits > 0 && (
              <span className="text-[11px] text-[#8b8b9e]">{credits} cr</span>
            )}
          </div>
          {credits > 0 ? (
            <span
              className="rounded px-2 py-0.5 text-[11px] font-bold"
              style={{
                backgroundColor: gpaBadgeBg(gpa),
                color: gpaColor(gpa),
              }}
            >
              {gpa.toFixed(2)}
            </span>
          ) : (
            <span className="rounded bg-[#f5f5f5] px-2 py-0.5 text-[11px] text-[#bbb]">
              --
            </span>
          )}
        </div>

        {/* Course summary chips */}
        {data.mode === "courses" && data.courses.length > 0 && (
          <div className="flex flex-wrap gap-1 border-t border-[#f0e8df] px-3 py-1.5">
            {data.courses.slice(0, 6).map((c) => (
              <span
                key={c.id}
                className="rounded px-1.5 py-0.5 text-[9px] font-semibold"
                style={{
                  backgroundColor: gradeChipBg(c.grade),
                  color: gradeColor(c.grade),
                }}
              >
                {c.grade}
              </span>
            ))}
            {data.courses.length > 6 && (
              <span className="rounded bg-[#f5f5f5] px-1.5 py-0.5 text-[9px] text-[#999]">
                +{data.courses.length - 6}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Properties Panel                                                   */
/* ------------------------------------------------------------------ */

function PropertiesPanel({
  node,
  cgpa,
  onClose,
  onUpdate,
  onDelete,
}: {
  node: CGPANode;
  cgpa: number;
  onClose: () => void;
  onUpdate: (id: string, data: Partial<SemesterNodeData>) => void;
  onDelete: (id: string) => void;
}) {
  const data = node.data;
  const gpa = semesterGpa(data);
  const credits = semesterCredits(data);

  const addCourse = () => {
    const newCourse: Course = {
      id: uid(),
      name: "",
      grade: "A",
      creditHours: 3,
    };
    onUpdate(node.id, { courses: [...data.courses, newCourse] });
  };

  const removeCourse = (courseId: string) => {
    onUpdate(node.id, {
      courses: data.courses.filter((c) => c.id !== courseId),
    });
  };

  const updateCourse = (courseId: string, updates: Partial<Course>) => {
    onUpdate(node.id, {
      courses: data.courses.map((c) =>
        c.id === courseId ? { ...c, ...updates } : c,
      ),
    });
  };

  return (
    <div className="absolute bottom-0 right-0 top-10 z-30 flex w-full flex-col border-l border-[#e8e0d6] bg-[#faf8f5] shadow-[-4px_0_24px_rgba(0,0,0,0.06)] sm:w-[380px]">
      {/* CGPA header */}
      <div className="flex items-center justify-between border-b border-[#ece4db] bg-[#f7f4ef] px-4 py-2">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-[#8b8b9e]" />
          <span className="text-[11px] font-medium text-[#8b8b9e]">CGPA</span>
        </div>
        <span
          className="text-lg font-bold tabular-nums"
          style={{ color: gpaColor(cgpa) }}
        >
          {cgpa > 0 ? cgpa.toFixed(2) : "--"}
        </span>
      </div>

      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-[#ece4db] px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#5c6bc0]">
            <BookOpen className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <span className="text-sm font-semibold text-[#1a1a2e]">
              {data.label}
            </span>
            {credits > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#8b8b9e]">
                  GPA:{" "}
                  <span className="font-bold" style={{ color: gpaColor(gpa) }}>
                    {gpa.toFixed(2)}
                  </span>
                </span>
                <span className="text-[10px] text-[#bbb]">
                  {credits} credits
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onDelete(node.id)}
            className="grid h-7 w-7 place-items-center rounded-md text-[#999] transition hover:bg-[#fff0f0] hover:text-[#e53935]"
            title="Delete semester"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-md text-[#999] transition hover:bg-[#eee] hover:text-[#555]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Semester name */}
      <div className="border-b border-[#ece4db] px-4 py-2.5">
        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[#999]">
          Semester name
        </label>
        <Input
          value={data.label}
          onChange={(e) => onUpdate(node.id, { label: e.target.value })}
          className="h-8 rounded-md border-[#e0d6cc] bg-white text-sm text-[#1a1a2e] shadow-none focus-visible:ring-1 focus-visible:ring-[#ff6d5a]/30"
        />
      </div>

      {/* Mode switch */}
      <div className="flex border-b border-[#ece4db]">
        <button
          type="button"
          onClick={() => onUpdate(node.id, { mode: "courses" })}
          className={cn(
            "flex-1 py-2 text-center text-[11px] font-medium transition",
            data.mode === "courses"
              ? "border-b-2 border-[#ff6d5a] text-[#ff6d5a]"
              : "text-[#999] hover:text-[#666]",
          )}
        >
          Individual Courses
        </button>
        <button
          type="button"
          onClick={() => onUpdate(node.id, { mode: "direct" })}
          className={cn(
            "flex-1 py-2 text-center text-[11px] font-medium transition",
            data.mode === "direct"
              ? "border-b-2 border-[#ff6d5a] text-[#ff6d5a]"
              : "text-[#999] hover:text-[#666]",
          )}
        >
          Direct GPA
        </button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {data.mode === "courses" ? (
          <div className="p-3">
            {/* Column headers */}
            {data.courses.length > 0 && (
              <div className="mb-1.5 grid grid-cols-[1fr_60px_56px_28px] gap-1.5 px-0.5">
                <span className="text-[9px] font-medium uppercase tracking-wider text-[#bbb]">
                  Course
                </span>
                <span className="text-[9px] font-medium uppercase tracking-wider text-[#bbb]">
                  Grade
                </span>
                <span className="text-[9px] font-medium uppercase tracking-wider text-[#bbb]">
                  Credits
                </span>
                <span />
              </div>
            )}

            {/* Course rows */}
            <div className="space-y-1.5">
              {data.courses.map((course) => (
                <div
                  key={course.id}
                  className="grid grid-cols-[1fr_60px_56px_28px] items-center gap-1.5 rounded-md border border-[#f0e8df] bg-white p-1.5"
                >
                  <Input
                    value={course.name}
                    placeholder="Course name"
                    onChange={(e) =>
                      updateCourse(course.id, { name: e.target.value })
                    }
                    className="h-7 border-0 bg-transparent px-1.5 text-xs text-[#1a1a2e] shadow-none placeholder:text-[#ccc] focus-visible:ring-0"
                  />
                  <Select
                    value={course.grade}
                    onValueChange={(val) =>
                      updateCourse(course.id, { grade: val })
                    }
                  >
                    <SelectTrigger className="h-7 justify-center gap-1 border-[#e0d6cc] bg-transparent px-1 text-xs shadow-none focus:ring-0 [&>svg:last-child]:hidden">
                      <span className="flex items-center gap-1 truncate">
                        <span
                          className="inline-block h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: gradeColor(course.grade) }}
                        />
                        <span
                          className="font-semibold"
                          style={{ color: gradeColor(course.grade) }}
                        >
                          {course.grade}
                        </span>
                      </span>
                    </SelectTrigger>
                    <SelectContent className="min-w-[100px] rounded-md border-[#e0d6cc] bg-white text-[#1a1a2e]">
                      {GRADES.map((g) => (
                        <SelectItem
                          key={g}
                          value={g}
                          className="py-1 pl-2 pr-6 text-xs"
                        >
                          <span className="flex items-center gap-1.5">
                            <span
                              className="inline-block h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: gradeColor(g) }}
                            />
                            <span
                              className="font-semibold"
                              style={{ color: gradeColor(g) }}
                            >
                              {g}
                            </span>
                            <span className="text-[10px] text-[#bbb]">
                              ({gradePoint(g)}.0)
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={course.creditHours}
                    onChange={(e) =>
                      updateCourse(course.id, {
                        creditHours: Math.max(1, parseInt(e.target.value) || 1),
                      })
                    }
                    className="h-7 border-[#e0d6cc] bg-transparent px-1.5 text-center text-xs text-[#1a1a2e] shadow-none [appearance:textfield] focus-visible:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeCourse(course.id)}
                    className="grid h-7 w-7 place-items-center rounded text-[#ccc] transition hover:bg-[#fff0f0] hover:text-[#e53935]"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add course */}
            <button
              type="button"
              onClick={addCourse}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-[#e0d6cc] py-2 text-[11px] font-medium text-[#999] transition hover:border-[#ff6d5a]/40 hover:bg-[#fff8f6] hover:text-[#ff6d5a]"
            >
              <Plus className="h-3 w-3" />
              Add course
            </button>

            {/* Summary */}
            {data.courses.length > 0 && (
              <div className="mt-3 rounded-md border border-[#f0e8df] bg-[#faf8f5] p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#999]">Total credits</span>
                  <span className="text-xs font-semibold text-[#1a1a2e]">
                    {credits}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[10px] text-[#999]">Semester GPA</span>
                  <span
                    className="text-sm font-bold"
                    style={{ color: gpaColor(gpa) }}
                  >
                    {gpa.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3 p-4">
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[#999]">
                GPA (0.00 - 5.00)
              </label>
              <Input
                type="number"
                min={0}
                max={5}
                step={0.01}
                value={data.directGpa || ""}
                placeholder="e.g. 4.25"
                onChange={(e) =>
                  onUpdate(node.id, {
                    directGpa: Math.min(
                      5,
                      Math.max(0, parseFloat(e.target.value) || 0),
                    ),
                  })
                }
                className="h-9 rounded-md border-[#e0d6cc] bg-white text-sm text-[#1a1a2e] shadow-none [appearance:textfield] focus-visible:ring-1 focus-visible:ring-[#ff6d5a]/30 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[#999]">
                Total credit hours
              </label>
              <Input
                type="number"
                min={1}
                max={100}
                value={data.directCredits || ""}
                placeholder="e.g. 18"
                onChange={(e) =>
                  onUpdate(node.id, {
                    directCredits: Math.max(0, parseInt(e.target.value) || 0),
                  })
                }
                className="h-9 rounded-md border-[#e0d6cc] bg-white text-sm text-[#1a1a2e] shadow-none [appearance:textfield] focus-visible:ring-1 focus-visible:ring-[#ff6d5a]/30 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </div>

            {data.directCredits > 0 && data.directGpa > 0 && (
              <div className="rounded-md border border-[#f0e8df] bg-[#faf8f5] p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#999]">Semester GPA</span>
                  <span
                    className="text-sm font-bold"
                    style={{ color: gpaColor(data.directGpa) }}
                  >
                    {data.directGpa.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Grade scale reference */}
      <div className="border-t border-[#ece4db] px-4 py-2">
        <p className="mb-1.5 text-[9px] font-medium uppercase tracking-wider text-[#bbb]">
          Grade scale
        </p>
        <div className="flex gap-1">
          {GRADES.map((g) => (
            <div
              key={g}
              className="flex flex-1 flex-col items-center rounded py-0.5"
              style={{ backgroundColor: gradeChipBg(g) }}
            >
              <span
                className="text-[10px] font-bold"
                style={{ color: gradeColor(g) }}
              >
                {g}
              </span>
              <span className="text-[8px] text-[#999]">{gradePoint(g)}.0</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Bottom Toolbar                                                     */
/* ------------------------------------------------------------------ */

function BottomToolbar({
  cgpa,
  totalCredits,
  semesterCount,
  onAddSemester,
}: {
  cgpa: number;
  totalCredits: number;
  semesterCount: number;
  onAddSemester: () => void;
}) {
  return (
    <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-[#e0d6cc] bg-white/95 px-2 py-1.5 shadow-[0_2px_16px_rgba(0,0,0,0.06)] backdrop-blur-sm sm:gap-1.5 sm:px-2.5">
      {/* Add semester */}
      <button
        type="button"
        onClick={onAddSemester}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium text-[#1a1a2e] transition hover:bg-[#f5f0ea] sm:px-2.5"
      >
        <Plus className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Add Semester</span>
      </button>

      {/* Stats — hidden on mobile */}
      <div className="mx-0.5 hidden h-6 w-px bg-[#e8e0d6] sm:block" />
      <div className="hidden items-center gap-3 px-2 sm:flex">
        <div className="text-center">
          <p className="text-[9px] font-medium uppercase tracking-wider text-[#bbb]">
            Semesters
          </p>
          <p className="text-xs font-bold text-[#1a1a2e]">{semesterCount}</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] font-medium uppercase tracking-wider text-[#bbb]">
            Credits
          </p>
          <p className="text-xs font-bold text-[#1a1a2e]">{totalCredits}</p>
        </div>
      </div>

      <div className="mx-0.5 h-6 w-px bg-[#e8e0d6]" />

      {/* CGPA */}
      <div className="flex items-center gap-2 px-2">
        <GraduationCap className="hidden h-4 w-4 text-[#8b8b9e] sm:block" />
        <div>
          <p className="hidden text-[9px] font-medium uppercase tracking-wider text-[#bbb] sm:block">
            CGPA
          </p>
          <p
            className="text-base font-bold tabular-nums leading-tight"
            style={{ color: cgpa > 0 ? gpaColor(cgpa) : "#ccc" }}
          >
            {cgpa > 0 ? cgpa.toFixed(2) : "--"}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Export helpers                                                     */
/* ------------------------------------------------------------------ */

function triggerDownload(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCsv(nodes: CGPANode[]) {
  const rows: string[] = [
    "Semester,Course,Grade,Grade Points,Credit Hours,Quality Points",
  ];

  for (const node of nodes) {
    const d = node.data;
    if (d.mode === "direct") {
      rows.push(
        [
          `"${d.label}"`,
          "(Direct GPA)",
          "",
          d.directGpa.toFixed(2),
          d.directCredits,
          (d.directGpa * d.directCredits).toFixed(2),
        ].join(","),
      );
    } else {
      for (const c of d.courses) {
        const gp = gradePoint(c.grade);
        rows.push(
          [
            `"${d.label}"`,
            `"${c.name}"`,
            c.grade,
            gp.toFixed(1),
            c.creditHours,
            (gp * c.creditHours).toFixed(2),
          ].join(","),
        );
      }
    }
  }

  triggerDownload("cgpa-transcript.csv", rows.join("\n"), "text/csv");
}

function exportJson(nodes: CGPANode[], cgpa: number) {
  const payload = {
    cgpa: parseFloat(cgpa.toFixed(4)),
    totalCredits: nodes.reduce((s, n) => s + semesterCredits(n.data), 0),
    semesters: nodes.map((n) => {
      const d = n.data;
      return {
        label: d.label,
        mode: d.mode,
        gpa: parseFloat(semesterGpa(d).toFixed(4)),
        credits: semesterCredits(d),
        ...(d.mode === "courses"
          ? {
              courses: d.courses.map((c) => ({
                name: c.name,
                grade: c.grade,
                gradePoints: gradePoint(c.grade),
                creditHours: c.creditHours,
              })),
            }
          : { directGpa: d.directGpa, directCredits: d.directCredits }),
      };
    }),
  };

  triggerDownload(
    "cgpa-transcript.json",
    JSON.stringify(payload, null, 2),
    "application/json",
  );
}

function exportPdf(nodes: CGPANode[], cgpa: number) {
  const totalCredits = nodes.reduce((s, n) => s + semesterCredits(n.data), 0);

  const semesterRows = nodes
    .map((n) => {
      const d = n.data;
      const gpa = semesterGpa(d);
      const credits = semesterCredits(d);
      if (credits === 0) return "";

      const courseRows =
        d.mode === "courses"
          ? d.courses
              .map(
                (c) =>
                  `<tr>
                    <td style="padding:4px 8px;color:#555;font-size:11px;">${c.name}</td>
                    <td style="padding:4px 8px;text-align:center;font-size:11px;">${c.grade}</td>
                    <td style="padding:4px 8px;text-align:center;font-size:11px;">${c.creditHours}</td>
                    <td style="padding:4px 8px;text-align:center;font-size:11px;">${(gradePoint(c.grade) * c.creditHours).toFixed(1)}</td>
                  </tr>`,
              )
              .join("")
          : `<tr><td colspan="4" style="padding:4px 8px;color:#888;font-size:11px;font-style:italic;">Direct GPA entry</td></tr>`;

      return `
        <div style="margin-bottom:20px;break-inside:avoid;">
          <div style="background:#f0ece6;padding:6px 12px;border-radius:6px 6px 0 0;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:600;font-size:12px;color:#1a1a2e;">${d.label}</span>
            <span style="font-size:11px;color:#555;">${credits} cr &nbsp;|&nbsp; GPA: <strong style="color:#1a1a2e;">${gpa.toFixed(2)}</strong></span>
          </div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e8e0d6;border-top:none;border-radius:0 0 6px 6px;overflow:hidden;">
            <thead>
              <tr style="background:#faf8f5;">
                <th style="padding:4px 8px;text-align:left;font-size:10px;color:#999;font-weight:500;border-bottom:1px solid #e8e0d6;">Course</th>
                <th style="padding:4px 8px;text-align:center;font-size:10px;color:#999;font-weight:500;border-bottom:1px solid #e8e0d6;">Grade</th>
                <th style="padding:4px 8px;text-align:center;font-size:10px;color:#999;font-weight:500;border-bottom:1px solid #e8e0d6;">Credits</th>
                <th style="padding:4px 8px;text-align:center;font-size:10px;color:#999;font-weight:500;border-bottom:1px solid #e8e0d6;">Quality Pts</th>
              </tr>
            </thead>
            <tbody>${courseRows}</tbody>
          </table>
        </div>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>CGPA Transcript</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fff; color: #1a1a2e; padding: 32px; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #e8e0d6;">
    <div>
      <div style="font-size:20px;font-weight:700;color:#1a1a2e;">CGPA Transcript</div>
      <div style="font-size:11px;color:#999;margin-top:2px;">Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:11px;color:#999;">Cumulative GPA</div>
      <div style="font-size:32px;font-weight:700;color:#5c6bc0;">${cgpa.toFixed(2)}</div>
      <div style="font-size:11px;color:#999;">${totalCredits} total credit hours &nbsp;|&nbsp; 5.0 scale</div>
    </div>
  </div>
  ${semesterRows}
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

/* ------------------------------------------------------------------ */
/*  Transcript serialiser (for AI context)                            */
/* ------------------------------------------------------------------ */

function buildTranscript(nodes: CGPANode[], cgpa: number): string {
  if (nodes.length === 0) {
    return "The student has not added any semesters yet.";
  }

  const lines: string[] = [];
  lines.push(`Overall CGPA: ${cgpa.toFixed(2)} / 5.00`);
  const totalCh = nodes.reduce((s, n) => s + semesterCredits(n.data), 0);
  lines.push(`Total credit hours: ${totalCh}`);
  lines.push(`Number of semesters: ${nodes.length}`);
  lines.push("");

  for (const node of nodes) {
    const d = node.data;
    const gpa = semesterGpa(d);
    const credits = semesterCredits(d);
    lines.push(
      `--- ${d.label} (GPA: ${gpa.toFixed(2)}, ${credits} credits) ---`,
    );
    if (d.mode === "direct") {
      lines.push("  (Direct GPA entry — no individual courses)");
    } else {
      for (const c of d.courses) {
        const gp = gradePoint(c.grade);
        lines.push(
          `  ${c.name || "(unnamed)"}: ${c.grade} (${gp}.0), ${c.creditHours} cr`,
        );
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/*  AI Chat Panel                                                      */
/* ------------------------------------------------------------------ */

const SUGGESTED_PROMPTS = [
  "What's dragging my CGPA down?",
  "Which semester was my best?",
  "How can I improve to a First Class?",
  "Summarise my academic performance.",
];

function AIChatPanel({
  nodes,
  cgpa,
  onClose,
}: {
  nodes: CGPANode[];
  cgpa: number;
  onClose: () => void;
}) {
  const transcript = useMemo(() => buildTranscript(nodes, cgpa), [nodes, cgpa]);
  const transcriptRef = useRef(transcript);
  transcriptRef.current = transcript;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/chat",
        body: () => ({ transcript: transcriptRef.current }),
      }),
    [],
  );

  const { messages, sendMessage, status } = useChat({ transport });

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isBusy = status === "submitted" || status === "streaming";

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const send = (text: string) => {
    if (!text.trim() || isBusy) return;
    void sendMessage({ text });
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const showSuggestions = messages.length === 0;

  /** Extract text from a UIMessage's parts array */
  const messageText = (m: (typeof messages)[number]) =>
    m.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("");

  return (
    <div className="absolute bottom-0 right-0 top-10 z-30 flex w-full flex-col border-l border-[#e8e0d6] bg-[#faf8f5] shadow-[-4px_0_24px_rgba(0,0,0,0.06)] sm:w-[380px]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#ece4db] bg-[#f7f4ef] px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#5c6bc0]">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <span className="text-sm font-semibold text-[#1a1a2e]">Ask AI</span>
            <p className="text-[10px] text-[#8b8b9e]">
              GradeGuru academic advisor
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded-md text-[#999] transition hover:bg-[#eee] hover:text-[#555]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {showSuggestions ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#5c6bc0]/10">
                <Sparkles className="h-5 w-5 text-[#5c6bc0]" />
              </div>
              <p className="text-sm font-medium text-[#1a1a2e]">
                Hi! I&apos;m your academic advisor.
              </p>
              <p className="mt-1 text-xs text-[#8b8b9e]">
                Ask me anything about your grades.
              </p>
            </div>
            <div className="w-full space-y-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => send(prompt)}
                  disabled={isBusy}
                  className="w-full rounded-xl border border-[#e8e0d6] bg-white px-3 py-2.5 text-left text-xs text-[#555] transition hover:border-[#5c6bc0]/30 hover:bg-[#f0edf8] hover:text-[#5c6bc0] disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => {
              const text = messageText(m);
              return (
                <div
                  key={m.id}
                  className={cn(
                    "flex",
                    m.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed",
                      m.role === "user"
                        ? "rounded-br-sm bg-[#5c6bc0] text-white"
                        : "rounded-bl-sm border border-[#e8e0d6] bg-white text-[#1a1a2e]",
                    )}
                  >
                    {text ? (
                      m.role === "assistant" ? (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ children }) => (
                              <p className="mb-1 last:mb-0">{children}</p>
                            ),
                            strong: ({ children }) => (
                              <strong className="font-semibold">
                                {children}
                              </strong>
                            ),
                            ul: ({ children }) => (
                              <ul className="mb-1 list-disc pl-4">
                                {children}
                              </ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="mb-1 list-decimal pl-4">
                                {children}
                              </ol>
                            ),
                            li: ({ children }) => (
                              <li className="mb-0.5">{children}</li>
                            ),
                            code: ({ children }) => (
                              <code className="rounded bg-[#f0ece6] px-1 py-0.5 font-mono text-[11px]">
                                {children}
                              </code>
                            ),
                            pre: ({ children }) => (
                              <pre className="mb-1 overflow-x-auto rounded bg-[#f0ece6] p-2 font-mono text-[11px]">
                                {children}
                              </pre>
                            ),
                          }}
                        >
                          {text}
                        </ReactMarkdown>
                      ) : (
                        text
                      )
                    ) : (
                      <span className="flex items-center gap-1.5 text-[#999]">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Thinking…
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t border-[#ece4db] bg-white px-3 py-2.5"
      >
        <div className="flex items-center gap-2 rounded-xl border border-[#e0d6cc] bg-[#faf8f5] px-3 py-2 focus-within:border-[#5c6bc0]/40 focus-within:ring-1 focus-within:ring-[#5c6bc0]/20">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your grades…"
            disabled={isBusy}
            className="h-full flex-1 resize-none bg-transparent text-xs text-[#1a1a2e] placeholder:text-[#bbb] focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isBusy || !input.trim()}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-[#5c6bc0] text-white transition hover:bg-[#4a5ab0] disabled:opacity-40"
          >
            {isBusy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
          </button>
        </div>
        <p className="mt-1.5 text-center text-[9px] text-[#ccc]">
          AI can make mistakes. Always verify important information.
        </p>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Top Bar                                                            */
/* ------------------------------------------------------------------ */

function TopBar({
  onAddFromNilePortal,
  onReplaceWithNilePortal,
  onExportCsv,
  onExportJson,
  onExportPdf,
  onToggleAI,
  aiPanelOpen,
}: {
  onAddFromNilePortal: (nodes: CGPANode[]) => void;
  onReplaceWithNilePortal: (nodes: CGPANode[]) => void;
  onExportCsv: () => void;
  onExportJson: () => void;
  onExportPdf: () => void;
  onToggleAI: () => void;
  aiPanelOpen: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importMode, setImportMode] = useState<NileImportMode>("add");

  const openDialog = (mode: NileImportMode) => {
    setImportMode(mode);
    setDialogOpen(true);
  };

  const handleImport = (nodes: CGPANode[]) => {
    if (importMode === "replace") {
      onReplaceWithNilePortal(nodes);
    } else {
      onAddFromNilePortal(nodes);
    }
  };

  return (
    <>
      <NilePortalDialog
        open={dialogOpen}
        mode={importMode}
        onClose={() => setDialogOpen(false)}
        onImport={handleImport}
      />

      <div className="absolute left-0 right-0 top-0 z-20 flex h-10 items-center justify-between border-b border-[#e8e0d6] bg-[#faf8f5]">
        {/* Left: title */}
        <div className="flex h-full items-center gap-2 px-3">
          <svg
            width="16"
            height="16"
            viewBox="0 0 28 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M14 2.33333V25.6667M22.2496 5.75042L5.75046 22.2496M25.6667 14H2.33337M22.2496 22.2496L5.75046 5.75042"
              stroke="#5c6bc0"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-xs font-semibold text-[#1a1a2e]">
            <span className="hidden sm:inline">CGPA Calculator</span>
            <span className="sm:hidden">GradeGuru</span>
          </span>
          <span className="hidden rounded bg-[#f0ece6] px-1.5 py-0.5 text-[9px] font-medium text-[#999] sm:inline">
            5.0 scale
          </span>
        </div>

        {/* Right: actions */}
        <div className="flex h-full items-center gap-1 px-3">
          {/* Ask AI */}
          <button
            type="button"
            onClick={onToggleAI}
            className={cn(
              "flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition sm:gap-1.5 sm:px-2.5",
              aiPanelOpen
                ? "bg-[#5c6bc0]/10 text-[#5c6bc0]"
                : "text-[#1a1a2e] hover:bg-[#f5f0ea]",
            )}
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Ask AI</span>
          </button>

          <div className="h-5 w-px bg-[#e8e0d6]" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-[#1a1a2e] transition hover:bg-[#f5f0ea] sm:gap-1.5 sm:px-2.5"
              >
                <Image
                  src="/nile.png"
                  alt="Nile"
                  width={14}
                  height={14}
                  className="shrink-0 rounded-sm"
                />
                <span className="hidden sm:inline">Nile Portal</span>
                <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="min-w-[200px] rounded-xl"
            >
              <DropdownMenuLabel className="text-[11px] text-[#999]">
                Import from Nile Portal
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 rounded-lg text-xs"
                onSelect={() => openDialog("add")}
              >
                <PlusCircle className="h-3.5 w-3.5" />
                Add from Nile Portal
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 rounded-lg text-xs"
                onSelect={() => openDialog("replace")}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Replace with Nile Portal
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="h-5 w-px bg-[#e8e0d6]" />

          {/* Export */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-[#1a1a2e] transition hover:bg-[#f5f0ea] sm:gap-1.5 sm:px-2.5"
              >
                <Download className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Export</span>
                <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="min-w-[180px] rounded-xl"
            >
              <DropdownMenuLabel className="text-[11px] text-[#999]">
                Export As
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 rounded-lg text-xs"
                onSelect={onExportCsv}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 rounded-lg text-xs"
                onSelect={onExportJson}
              >
                <FileJson className="h-3.5 w-3.5" />
                Export as JSON
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 rounded-lg text-xs"
                onSelect={onExportPdf}
              >
                <FileText className="h-3.5 w-3.5" />
                Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Initial data                                                       */
/* ------------------------------------------------------------------ */

function makeSemester(
  index: number,
  position: { x: number; y: number },
  courses: Course[] = [],
): CGPANode {
  return {
    id: uid(),
    type: "semester",
    position,
    data: {
      kind: "semester",
      label: `Semester ${index}`,
      mode: "courses",
      courses,
      directGpa: 0,
      directCredits: 0,
    },
  };
}

const seed1: Course[] = [
  { id: uid(), name: "Mathematics I", grade: "A", creditHours: 4 },
  { id: uid(), name: "Physics", grade: "B", creditHours: 3 },
  { id: uid(), name: "Chemistry", grade: "A", creditHours: 3 },
  { id: uid(), name: "English", grade: "B", creditHours: 2 },
  { id: uid(), name: "Programming", grade: "A", creditHours: 3 },
];

const seed2: Course[] = [
  { id: uid(), name: "Mathematics II", grade: "B", creditHours: 4 },
  { id: uid(), name: "Data Structures", grade: "A", creditHours: 3 },
  { id: uid(), name: "Electronics", grade: "C", creditHours: 3 },
  { id: uid(), name: "Statistics", grade: "B", creditHours: 3 },
];

const seed3: Course[] = [
  { id: uid(), name: "Algorithms", grade: "A", creditHours: 3 },
  { id: uid(), name: "Database Systems", grade: "A", creditHours: 3 },
  { id: uid(), name: "Operating Systems", grade: "B", creditHours: 3 },
];

const n1 = makeSemester(1, { x: 80, y: 200 }, seed1);
const n2 = makeSemester(2, { x: 420, y: 200 }, seed2);
const n3 = makeSemester(3, { x: 760, y: 200 }, seed3);

const initialNodes: CGPANode[] = [n1, n2, n3];

const initialEdges: Edge[] = [
  {
    id: `e-${n1.id}-${n2.id}`,
    source: n1.id,
    target: n2.id,
    type: "dashed",
  },
  {
    id: `e-${n2.id}-${n3.id}`,
    source: n2.id,
    target: n3.id,
    type: "dashed",
  },
];

/* ------------------------------------------------------------------ */
/*  Main Canvas                                                        */
/* ------------------------------------------------------------------ */

const nodeTypes = { semester: SemesterNode };
const edgeTypes = { dashed: DashedEdge };

/** Build sequential chain edges for an ordered array of nodes */
function buildChainEdges(nds: CGPANode[]): Edge[] {
  return nds.slice(1).map((node, i) => ({
    id: `e-${nds[i]!.id}-${node.id}`,
    source: nds[i]!.id,
    target: node.id,
    type: "dashed",
  }));
}

function CGPACalculatorCanvas({
  startNodes,
  startEdges,
}: {
  startNodes: CGPANode[];
  startEdges: Edge[];
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<CGPANode>(startNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(startEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  const flowWrapperRef = useRef<HTMLDivElement | null>(null);
  const reactFlow = useReactFlow<CGPANode, Edge>();

  const cgpa = useMemo(() => calculateCGPA(nodes), [nodes]);

  const totalCredits = useMemo(
    () => nodes.reduce((sum, n) => sum + semesterCredits(n.data), 0),
    [nodes],
  );

  const selectedNode = useMemo(
    () =>
      selectedNodeId
        ? (nodes.find((n) => n.id === selectedNodeId) ?? null)
        : null,
    [nodes, selectedNodeId],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, type: "dashed" }, eds));
    },
    [setEdges],
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: CGPANode) => {
    setSelectedNodeId(node.id);
    setAiPanelOpen(false);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const handleNodeUpdate = useCallback(
    (id: string, updates: Partial<SemesterNodeData>) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== id) return n;
          return {
            ...n,
            data: { ...n.data, ...updates },
          } as CGPANode;
        }),
      );
    },
    [setNodes],
  );

  const addSemester = useCallback(() => {
    const bounds = flowWrapperRef.current?.getBoundingClientRect();
    const semesterIndex = nodes.length + 1;

    let position = { x: 80 + nodes.length * 340, y: 200 };
    if (bounds) {
      position = reactFlow.screenToFlowPosition({
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height / 2,
      });
    }

    const newNode = makeSemester(semesterIndex, position);

    // Auto-connect to the last existing node
    const lastNode = nodes[nodes.length - 1];
    const newEdges: Edge[] = lastNode
      ? [
          {
            id: `e-${lastNode.id}-${newNode.id}`,
            source: lastNode.id,
            target: newNode.id,
            type: "dashed",
          },
        ]
      : [];

    setNodes((nds) => [...nds, newNode]);
    setEdges((eds) => [...eds, ...newEdges]);
    setSelectedNodeId(newNode.id);
  }, [nodes, setNodes, setEdges, reactFlow]);

  const deleteSemester = useCallback(
    (nodeId: string) => {
      // Remove the node
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      // Remove all edges connected to this node
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId),
      );
      // Close the panel if the deleted node was selected
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
      }
    },
    [setNodes, setEdges, selectedNodeId],
  );

  const addFromNilePortal = useCallback(
    (newNodes: CGPANode[]) => {
      if (newNodes.length === 0) return;

      // Re-position imported nodes to the right of existing ones
      const xOffset = nodes.length > 0 ? nodes.length * 340 + 80 : 80;
      const positioned = newNodes.map((n, i) => ({
        ...n,
        position: { x: xOffset + i * 340, y: 200 },
      }));

      // Connect last existing node → first imported node
      const bridgeEdge: Edge[] =
        nodes.length > 0
          ? [
              {
                id: `e-${nodes[nodes.length - 1]!.id}-${positioned[0]!.id}`,
                source: nodes[nodes.length - 1]!.id,
                target: positioned[0]!.id,
                type: "dashed",
              },
            ]
          : [];

      setNodes((nds) => [...nds, ...positioned]);
      setEdges((eds) => [
        ...eds,
        ...bridgeEdge,
        ...buildChainEdges(positioned),
      ]);
    },
    [nodes, setNodes, setEdges],
  );

  const replaceWithNilePortal = useCallback(
    (newNodes: CGPANode[]) => {
      if (newNodes.length === 0) return;
      setSelectedNodeId(null);
      setNodes(newNodes);
      setEdges(buildChainEdges(newNodes));
    },
    [setNodes, setEdges],
  );

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#f5f1eb]">
      <TopBar
        onAddFromNilePortal={addFromNilePortal}
        onReplaceWithNilePortal={replaceWithNilePortal}
        onExportCsv={() => exportCsv(nodes)}
        onExportJson={() => exportJson(nodes, cgpa)}
        onExportPdf={() => exportPdf(nodes, cgpa)}
        aiPanelOpen={aiPanelOpen}
        onToggleAI={() => {
          setAiPanelOpen((v) => {
            if (!v) setSelectedNodeId(null);
            return !v;
          });
        }}
      />

      {/* Canvas */}
      <div
        ref={flowWrapperRef}
        className={cn(
          "absolute bottom-0 left-0 top-10 transition-all duration-200",
          selectedNode || aiPanelOpen ? "right-0 sm:right-[380px]" : "right-0",
        )}
      >
        <ReactFlow<CGPANode, Edge>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          defaultViewport={{ x: 40, y: 60, zoom: 0.95 }}
          minZoom={0.3}
          maxZoom={2}
          fitView={false}
          proOptions={{ hideAttribution: true }}
          className="h-full w-full"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            color="rgba(0,0,0,0.07)"
          />
        </ReactFlow>
      </div>

      {/* Properties panel */}
      {selectedNode && !aiPanelOpen && (
        <PropertiesPanel
          node={selectedNode}
          cgpa={cgpa}
          onClose={() => setSelectedNodeId(null)}
          onUpdate={handleNodeUpdate}
          onDelete={deleteSemester}
        />
      )}

      {/* AI chat panel */}
      {aiPanelOpen && (
        <AIChatPanel
          nodes={nodes}
          cgpa={cgpa}
          onClose={() => setAiPanelOpen(false)}
        />
      )}

      {/* Bottom toolbar */}
      <BottomToolbar
        cgpa={cgpa}
        totalCredits={totalCredits}
        semesterCount={nodes.length}
        onAddSemester={addSemester}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Onboarding Screen                                                  */
/* ------------------------------------------------------------------ */

function OnboardingScreen({
  onComplete,
}: {
  onComplete: (nodes: CGPANode[], edges: Edge[]) => void;
}) {
  const [nileDialogOpen, setNileDialogOpen] = useState(false);

  return (
    <>
      <NilePortalDialog
        open={nileDialogOpen}
        mode="replace"
        onClose={() => setNileDialogOpen(false)}
        onImport={(nodes) => onComplete(nodes, buildChainEdges(nodes))}
      />

      <div className="flex h-dvh w-full flex-col items-center justify-center bg-[#f5f1eb] px-4">
        {/* Header */}
        <div className="mb-10 flex flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1a1a2e] shadow-lg">
            <svg
              width="26"
              height="26"
              viewBox="0 0 28 28"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M14 2.33333V25.6667M22.2496 5.75042L5.75046 22.2496M25.6667 14H2.33337M22.2496 22.2496L5.75046 5.75042"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1a1a2e]">
              Welcome to GradeGuru
            </h1>
            <p className="mt-1.5 text-sm text-[#8b8b9e]">
              How would you like to get started?
            </p>
          </div>
        </div>

        {/* Option cards */}
        <div className="flex w-full max-w-2xl flex-col gap-3 sm:flex-row">
          {/* Nile Portal — featured */}
          <button
            type="button"
            onClick={() => setNileDialogOpen(true)}
            className="group flex flex-1 flex-col items-start gap-4 rounded-2xl border-2 border-[#5c6bc0]/25 bg-white p-5 text-left shadow-sm transition-all duration-150 hover:border-[#5c6bc0]/60 hover:shadow-md"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#e8e0d6] bg-[#f5f1eb]">
              <Image
                src="/nile.png"
                alt="Nile"
                width={26}
                height={26}
                className="rounded-sm"
              />
            </div>
            <div className="flex-1">
              <span className="inline-block rounded-full bg-[#5c6bc0]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#5c6bc0]">
                Recommended
              </span>
              <p className="mt-2 text-sm font-semibold text-[#1a1a2e]">
                Import from Nile Portal
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[#8b8b9e]">
                Connect your student portal and import all your grades
                automatically.
              </p>
            </div>
          </button>

          {/* Sample data */}
          <button
            type="button"
            onClick={() => onComplete(initialNodes, initialEdges)}
            className="group flex flex-1 flex-col items-start gap-4 rounded-2xl border border-[#e0d6cc] bg-white p-5 text-left shadow-sm transition-all duration-150 hover:border-[#c8bfb5] hover:shadow-md"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f5e9]">
              <BarChart2 className="h-5 w-5 text-[#2e7d32]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#1a1a2e]">
                Explore sample data
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[#8b8b9e]">
                See how the app works with a set of pre-loaded semester data.
              </p>
            </div>
          </button>

          {/* Blank canvas */}
          <button
            type="button"
            onClick={() => onComplete([], [])}
            className="group flex flex-1 flex-col items-start gap-4 rounded-2xl border border-[#e0d6cc] bg-white p-5 text-left shadow-sm transition-all duration-150 hover:border-[#c8bfb5] hover:shadow-md"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f5f1eb]">
              <PenLine className="h-5 w-5 text-[#8b8b9e]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#1a1a2e]">
                Start with a blank canvas
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[#8b8b9e]">
                Add your semesters and grades manually from scratch.
              </p>
            </div>
          </button>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Export                                                              */
/* ------------------------------------------------------------------ */

export function FlowBuilder() {
  return (
    <ReactFlowProvider>
      <CGPACalculatorCanvas
        startNodes={initialNodes}
        startEdges={initialEdges}
      />
    </ReactFlowProvider>
  );
}
