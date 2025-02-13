"use client";

import {
  type FC,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { AnimatedCircularProgressBar } from "../magicui/animated-circular-progress-bar";
import { atom, useAtom } from "jotai";
import { Button } from "../ui/button";
import { Minus, Plus } from "lucide-react";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Popover, PopoverContent } from "../ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "../ui/command";
import { Command as CommandPrimitive } from "cmdk";
import { ScrollArea, ScrollBar } from "~/components/ui/scroll-area";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
// import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Toggle } from "../ui/toggle";

// Form State Values
const courseCode = atom("");
const creditNumber = atom(0);
const gradeIndexAtom = atom(5);

export const courseAddInfoArray = {
  0: courseCode,
  1: creditNumber,
  2: gradeIndexAtom,
};

const CourseCodeEntry: FC = ({}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [courseName, setCourseName] = useAtom(courseCode);
  const inputRef = useRef<HTMLInputElement>(null);
  const exampleCourseCode = [
    "MTH 101",
    "GST 111",
    "PHY 101",
    "PHY 107",
    "STA 111",
    "MTH 103",
  ];

  const autoCompleteCallback = useCallback(() => {
    setIsOpen(false);
    inputRef.current?.blur();
  }, []);

  return (
    <div className="grid gap-2">
      <Label>Course</Label>
      <div>
        <Command vimBindings={false} className="overflow-visible bg-background">
          <CommandPrimitive.Input asChild>
            <Input
              ref={inputRef}
              value={courseName}
              onChange={(e) => {
                setCourseName(e.target.value);
              }}
              onFocus={() => {
                setIsOpen(true);
              }}
              onBlur={() => {
                setIsOpen(false);
              }}
              className="rounded-xl"
              placeholder="e.g. MTH 101"
            />
          </CommandPrimitive.Input>
          {isOpen && (
            <div className="relative flex w-full flex-col animate-in fade-in-0 zoom-in-95">
              <CommandList className="absolute top-2 z-50 flex w-full flex-col rounded-xl border bg-card opacity-100">
                <CommandEmpty>Well that&apos;s new.</CommandEmpty>
                <CommandGroup>
                  <ScrollArea>
                    <ScrollAreaPrimitive.Viewport className="max-h-40">
                      {exampleCourseCode.map((val, index) => (
                        <CommandItem
                          onMouseDown={() => {
                            setCourseName(val);
                            autoCompleteCallback();
                          }}
                          onSelect={() => {
                            setCourseName(val);
                            autoCompleteCallback();
                          }}
                          key={val + index}
                          className="cursor-pointer rounded-lg data-[selected=true]:bg-[yellow] data-[selected=true]:text-[hsl(var(--card))]"
                        >
                          {val}
                        </CommandItem>
                      ))}
                    </ScrollAreaPrimitive.Viewport>
                    <ScrollBar />
                  </ScrollArea>
                </CommandGroup>
              </CommandList>
            </div>
          )}
        </Command>
      </div>
    </div>
  );
};

const NumberOfCredits: FC = ({}) => {
  const MAX_VALUE = 4;
  const [credit, setCredit] = useAtom(creditNumber);
  return (
    <div className="grid gap-2">
      <Label>Credit</Label>
      <div className="flex flex-grow items-end justify-between">
        <Button
          className="rounded-full"
          disabled={!credit}
          variant={"outline"}
          size={"icon"}
          onClick={() => {
            if (credit > 0) {
              setCredit((prev) => prev - 1);
            }
          }}
        >
          <span className="sr-only">Decrease credit number</span>
          <Minus />
        </Button>
        <AnimatedCircularProgressBar
          className="h-32"
          max={MAX_VALUE}
          min={0}
          value={credit}
          gaugePrimaryColor="yellow"
          gaugeSecondaryColor="rgba(0, 0, 0, 0.1)"
        />
        <Button
          className="rounded-full"
          size={"icon"}
          variant={"outline"}
          onClick={() => {
            setCredit((prev) => prev + 1);
          }}
        >
          <span className="sr-only">Increase credit number</span>
          <Plus />
        </Button>
      </div>
    </div>
  );
};

const GradeComponent: FC = ({}) => {
  const [gradeIndex, setGradeIndex] = useAtom(gradeIndexAtom);
  const grades = ["A", "B", "C", "D", "E", "F"];
  const initState = Array.from({ length: grades.length }, () => false);
  initState[gradeIndex] = true;
  const [toggleStates, setToggleStates] = useState(initState);

  return (
    <div className="grid gap-2">
      <Label>Grade</Label>
      <div className="flex gap-2">
        {grades.map((value, index) => (
          <div key={`select_${value}`}>
            <Toggle
              pressed={toggleStates[index]}
              onPressedChange={() => {
                setGradeIndex(index);
                setToggleStates((prev) => {
                  const newArr = [...prev];
                  newArr.fill(false);
                  newArr[index] = true;
                  return newArr;
                });
              }}
            >
              {value}
            </Toggle>
          </div>
        ))}
      </div>
    </div>
  );
};

export { NumberOfCredits, CourseCodeEntry, GradeComponent };
