"use client";

import "@xyflow/react/dist/style.css";

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
import {
  BookOpen,
  GraduationCap,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "~/components/ui/select";
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
    <div className="absolute inset-y-0 right-0 z-30 flex w-[380px] flex-col border-l border-[#e8e0d6] bg-[#faf8f5] shadow-[-4px_0_24px_rgba(0,0,0,0.06)]">
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
    <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-xl border border-[#e0d6cc] bg-white/95 px-2.5 py-1.5 shadow-[0_2px_16px_rgba(0,0,0,0.06)] backdrop-blur-sm">
      {/* Add semester */}
      <button
        type="button"
        onClick={onAddSemester}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-[#1a1a2e] transition hover:bg-[#f5f0ea]"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Semester
      </button>

      <div className="mx-0.5 h-6 w-px bg-[#e8e0d6]" />

      {/* Stats */}
      <div className="flex items-center gap-3 px-2">
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
        <GraduationCap className="h-4 w-4 text-[#8b8b9e]" />
        <div>
          <p className="text-[9px] font-medium uppercase tracking-wider text-[#bbb]">
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
/*  Top Bar                                                            */
/* ------------------------------------------------------------------ */

function TopBar() {
  return (
    <div className="absolute left-0 right-0 top-0 z-20 flex h-10 items-center border-b border-[#e8e0d6] bg-[#faf8f5]">
      <div className="flex h-full items-center gap-2 px-3">
        <GraduationCap className="h-4 w-4 text-[#5c6bc0]" />
        <span className="text-xs font-semibold text-[#1a1a2e]">
          CGPA Calculator
        </span>
        <span className="rounded bg-[#f0ece6] px-1.5 py-0.5 text-[9px] font-medium text-[#999]">
          5.0 scale
        </span>
      </div>
    </div>
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

function CGPACalculatorCanvas() {
  const [nodes, setNodes, onNodesChange] =
    useNodesState<CGPANode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

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

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#f5f1eb]">
      <TopBar />

      {/* Canvas */}
      <div
        ref={flowWrapperRef}
        className={cn(
          "absolute bottom-0 left-0 top-10 transition-all duration-200",
          selectedNode ? "right-[380px]" : "right-0",
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
      {selectedNode && (
        <PropertiesPanel
          node={selectedNode}
          cgpa={cgpa}
          onClose={() => setSelectedNodeId(null)}
          onUpdate={handleNodeUpdate}
          onDelete={deleteSemester}
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
/*  Export                                                              */
/* ------------------------------------------------------------------ */

export function FlowBuilder() {
  return (
    <ReactFlowProvider>
      <CGPACalculatorCanvas />
    </ReactFlowProvider>
  );
}
