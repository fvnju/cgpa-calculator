"use client";
import Logo from "~/components/Logo";
import { DataTable } from "./data-table";
import { columns, courseSchema, type Course } from "./columns";
import { Button } from "~/components/ui/button";
import { Toaster } from "~/components/ui/sonner";

import * as React from "react";
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
import Papa from "papaparse";

export const courseArrayAtom = atom<Course[]>([]);
const storageLocation = "demoTranscript";

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

export default function Page() {
  const [courses, setCourses] = useAtom(courseArrayAtom);

  useEffect(() => {
    localStorage.setItem(storageLocation, JSON.stringify(courses));
    console.log("store change");
  }, [courses]);

  React.useLayoutEffect(() => {
    if (!localStorage.getItem(storageLocation) && !courses.length) {
      localStorage.setItem(storageLocation, JSON.stringify([]));
    } else if (localStorage.getItem(storageLocation)) {
      setCourses(
        JSON.parse(localStorage.getItem(storageLocation)!) as typeof courses,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uploadRef = React.useRef<HTMLInputElement>(null);

  return (
    <main className="flex h-dvh flex-col items-center justify-center overflow-hidden bg-[#121212] text-white">
      <div className="flex h-16 w-full items-center justify-between border-b-2 border-[#37474F]/20 px-6 md:px-12">
        <Link href="/">
          <Logo />
        </Link>
        <h3 className="cursor-default select-none scroll-m-20 text-xl font-semibold tracking-tight text-white/20">
          Demo
        </h3>
      </div>
      <div className="flex w-full flex-1 flex-col px-6 py-6 md:px-12">
        <DataTable columns={columns} data={useAtomValue(courseArrayAtom)} />

        <div className="mt-4 flex flex-col gap-4 md:flex-row md:justify-end md:gap-8">
          <Input
            accept=".csv"
            ref={uploadRef}
            onChange={(event) => {
              const file = event.target.files![0];

              if (!file) return;

              const reader = new FileReader();

              reader.onload = function (e) {
                const text = e.target!.result;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-base-to-string
                const results = Papa.parse<Course>(String(text), {
                  header: true, // Treat first row as headers
                  dynamicTyping: true, // convert numbers automatically
                });

                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                if (results.errors.length) {
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
                  toast.warning("CSV parsing had an error");
                }

                const newEntries: Course[] = [];
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                for (const item of results.data) {
                  try {
                    newEntries.push(courseSchema.parse(item));
                  } catch (error: unknown) {
                    if (error instanceof z.ZodError && error.issues.length) {
                    }
                  }
                }
                setCourses((prev) => [...prev, ...newEntries]);
                toast.success("CSV was imported successfully.");

                uploadRef.current!.value = "";
              };

              reader.readAsText(file);
            }}
            className="hidden"
            type="file"
          />
          <Button
            type="button"
            role="button"
            className="rounded-xl"
            variant={"secondary"}
            onClick={() => {
              uploadRef.current?.click();
            }}
          >
            Import CSV
          </Button>
          <DrawerDialog>
            <Button className="rounded-xl">Add Course</Button>
          </DrawerDialog>
        </div>
        <Toaster position="top-center" richColors />
      </div>
    </main>
  );
}

import { useEffect, useState } from "react";
import Link from "next/dist/client/link";
import { toast } from "sonner";
import { z } from "zod";

export function useMediaQuery(query: string) {
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
