"use client";
import Logo from "~/components/Logo";
import { DataTable } from "./data-table";
import { columns, type Course } from "./columns";
import { Button } from "~/components/ui/button";
import { Toaster } from "~/components/ui/sonner";

import * as React from "react";
import NumberFlow from "@number-flow/react";
import { cn } from "~/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "~/components/ui/drawer";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useForm } from "react-hook-form";
import { atom, useAtomValue, useAtom } from "jotai";

export const courseArrayAtom = atom<Course[]>([]);

export function DrawerDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState<boolean | undefined>(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Course</DialogTitle>
            <DialogDescription>
              Make changes to your transcript details here. Click save when
              you&apos;re done.
            </DialogDescription>
          </DialogHeader>
          <CourseForm state={[open, setOpen]} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{children}</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Add Course</DrawerTitle>
          <DrawerDescription>
            Make changes to your transcript details here. Click save when
            you&apos;re done.
          </DrawerDescription>
        </DrawerHeader>
        <CourseForm state={[open, setOpen]} className="px-4" />
        <DrawerFooter className="pt-2">
          <DrawerClose asChild>
            <Button className="rounded-xl" variant="outline">
              Cancel
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function CourseForm({
  className,
  state,
}: React.ComponentProps<"form"> & {
  state: ReturnType<typeof React.useState<boolean>>;
}) {
  const form = useForm();
  const courseRef = React.useRef<HTMLInputElement>(null);
  const creditRef = React.useRef<HTMLInputElement>(null);
  const gradeRef = React.useRef("");

  const [_, setCourseArray] = useAtom(courseArrayAtom);

  return (
    <form
      onSubmit={form.handleSubmit(() => {
        const newData = {
          course: courseRef.current!.value,
          credit: Number(creditRef.current!.value),
          grade: gradeRef.current as "A" | "B" | "C" | "D" | "E" | "F",
        };
        const og = _.filter((value) => value.course !== newData.course);
        setCourseArray([...og, newData]);
        state[1](false);
      })}
      className={cn("grid items-start gap-4", className)}
    >
      <div className="grid gap-2">
        <Label htmlFor="course">Course</Label>
        <Input
          ref={courseRef}
          className="rounded-xl"
          type="text"
          id="course"
          placeholder="MTH 101"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="credit">Credit</Label>
        <Input
          className="rounded-xl"
          id="credit"
          type="number"
          ref={creditRef}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="grade">Grade</Label>
        <Select
          name="grade"
          onValueChange={(value) => {
            gradeRef.current = value;
          }}
        >
          <SelectTrigger className="w-[180px] rounded-xl">
            <SelectValue id="grade" placeholder="Grade" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {["A", "B", "C", "D", "E", "F"].map((value, index) => (
              <SelectItem
                className="rounded-xl"
                key={value + index}
                value={value}
              >
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button className="mt-4 rounded-xl" type="submit">
        Save changes
      </Button>
    </form>
  );
}

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

export default function Page() {
  const courses = useAtomValue(courseArrayAtom);
  type gradeType = "A" | "B" | "C" | "D" | "E" | "F";

  const calculateCGPA = React.useCallback((): number => {
    const getGradePoint = (grade: gradeType): number => {
      const gradePoints = new Map<gradeType, number>([
        ["A", 5],
        ["B", 4],
        ["C", 3],
        ["D", 2],
        ["E", 1],
        ["F", 0],
      ]);
      return gradePoints.get(grade) ?? 0;
    };

    if (courses.length === 0) return 0.0;

    const totalCreditUnits = courses.reduce(
      (sum, course) => sum + course.credit,
      0,
    );
    const totalPoints = courses.reduce((sum, course) => {
      const gradePoint = getGradePoint(course.grade);
      return sum + gradePoint * course.credit;
    }, 0);

    return Number((totalPoints / totalCreditUnits).toFixed(2));
  }, [courses]);

  return (
    <main className="h-dvh items-center justify-center overflow-hidden bg-[#121212] text-white">
      <div className="flex h-16 w-full items-center border-b-2 border-[#37474F]/20 px-6 md:px-12">
        <Logo />
      </div>
      <div className="flex h-[88%] w-full flex-col px-6 py-6 md:px-12">
        <div className="mb-4 flex w-full items-center justify-start">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <p
                  onClick={() =>
                    navigator.clipboard.writeText(
                      calculateCGPA().toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                        minimumFractionDigits: 2,
                      }),
                    )
                  }
                  className="cursor-pointer font-mono text-3xl font-semibold"
                >
                  <span className="text-sm">CPGA: </span>
                  <NumberFlow
                    format={{
                      maximumFractionDigits: 2,
                      minimumFractionDigits: 2,
                    }}
                    value={calculateCGPA()}
                  />
                </p>
              </TooltipTrigger>
              <TooltipContent>
                <p>Copy CGPA</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <DataTable columns={columns} data={useAtomValue(courseArrayAtom)} />

        <DrawerDialog>
          <Button className="flex-0 mt-8 rounded-xl md:self-end md:justify-self-center">
            Add Course
          </Button>
        </DrawerDialog>
        <Toaster position="top-center" richColors />
      </div>
    </main>
  );
}

import { useEffect, useState } from "react";

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);

    setMatches(mediaQuery.matches);
    mediaQuery.addEventListener("change", handler);

    return () => {
      mediaQuery.removeEventListener("change", handler);
    };
  }, [query]);

  return matches;
}
