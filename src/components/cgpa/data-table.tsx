"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Button } from "~/components/ui/button";
import { toast } from "sonner";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "~/components/ui/context-menu";
import { ScrollArea, ScrollBar } from "~/components/ui/scroll-area";
import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { TableCell, TableHead, TableRow } from "~/components/ui/table";
import { courseArrayAtom } from "./page";
import { useAtom } from "jotai";
import { MoreVertical } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import NumberFlow from "@number-flow/react";
import { Checkbox } from "../ui/checkbox";
import { CustomDrawerDialog, customModalState } from "./state";
import { useMediaQuery } from "./page";
import { CSVDownloader } from "./csvDownloader";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
}

export function DataTable<TData, TValue>({
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [rowSelection, setRowSelection] = React.useState({});
  const table = ttble<TData, TValue>(
    data,
    columns,
    setRowSelection,
    rowSelection,
  );
  const [courses, setCourseArray] = useAtom(courseArrayAtom);
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

  const [, setCustomModal] = useAtom(customModalState);

  const allChecked = table.getIsAllPageRowsSelected();
  React.useEffect(() => {
    setCourseArray((prev) => {
      return prev.map((value) => {
        value.selected = allChecked;
        return value;
      });
    });
  }, [allChecked, setCourseArray]);

  return (
    <>
      <div className="mb-4 flex w-full items-center justify-between">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <p
                onClick={async () => {
                  await navigator.clipboard.writeText(
                    calculateCGPA().toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                      minimumFractionDigits: 2,
                    }),
                  );
                  toast.success("CGPA successfully copied to clipboard.");
                }}
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

        <div className="flex gap-2">
          <Button
            className="rounded-xl"
            disabled={
              !(
                table.getIsAllPageRowsSelected() ||
                table.getIsSomePageRowsSelected()
              )
            }
            variant={"outline"}
            onClick={() => {
              CSVDownloader(courses, "file.csv");
            }}
          >
            Export as CSV
          </Button>
          <CustomDrawerDialog
            actions={
              <>
                <Button
                  className="flex-grow rounded-xl md:flex-grow-0"
                  disabled={
                    !(
                      table.getIsAllPageRowsSelected() ||
                      table.getIsSomePageRowsSelected()
                    )
                  }
                  onClick={() => {
                    setCourseArray((prev) =>
                      prev.filter((value) => !value.selected),
                    );
                    table.toggleAllPageRowsSelected(false);
                    setCustomModal(false);
                    toast.warning("Deleted successfully.");
                  }}
                  variant={"destructive"}
                >
                  Delete
                </Button>
              </>
            }
          >
            <Button variant={"ghost"}>
              <MoreVertical />
            </Button>
          </CustomDrawerDialog>
        </div>
      </div>
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border">
        <div className="flex w-full [&_tr]:border-b">
          {table.getHeaderGroups().map((headerGroup) => (
            <div
              className="flex w-full items-center border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
              key={headerGroup.id}
            >
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead
                    key={header.id}
                    className={
                      header.id === "select"
                        ? "flex-0 flex w-10 items-center justify-center text-center"
                        : "flex flex-1 items-center justify-center text-center"
                    }
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                );
              })}
            </div>
          ))}
        </div>

        <ScrollArea className="flex flex-1">
          {table.getRowModel().rows?.length ? (
            <ScrollAreaPrimitive.Viewport className="flex flex-1">
              <div className="flex h-60 flex-grow flex-col [&_tr:last-child]:border-0">
                {table.getRowModel().rows.map((row) => {
                  return (
                    <ContextMenu key={row.id}>
                      <ContextMenuTrigger asChild>
                        <TableRow
                          className="flex"
                          key={row.id}
                          data-state={row.getIsSelected() && "selected"}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell
                              key={cell.id}
                              className={
                                cell.id.endsWith("select")
                                  ? "flex-0 flex w-10 items-center justify-center"
                                  : "flex-1 text-center"
                              }
                            >
                              {cell.id.endsWith("select") ? (
                                <Checkbox
                                  checked={row.getIsSelected()}
                                  onCheckedChange={(v) => {
                                    row.toggleSelected(!!v);
                                    // @ts-expect-error idk
                                    setCourseArray((prev) => {
                                      const indexToReplace = parseInt(row.id);

                                      return prev.map((value, index) =>
                                        index === indexToReplace
                                          ? {
                                              course:
                                                prev[indexToReplace]?.course,
                                              selected: v,
                                              credit:
                                                prev[indexToReplace]?.credit,
                                              grade:
                                                prev[indexToReplace]?.grade,
                                            }
                                          : value,
                                      );
                                    });
                                  }}
                                  aria-label="Select row"
                                />
                              ) : (
                                flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext(),
                                )
                              )}
                            </TableCell>
                          ))}
                          <ScrollBar />
                          <ScrollAreaPrimitive.Corner />
                        </TableRow>
                      </ContextMenuTrigger>
                      {isDesktop && (
                        <ContextMenuContent className="rounded-xl">
                          <ContextMenuItem asChild>
                            <Button
                              variant={"destructive"}
                              className="w-full rounded-lg"
                              onClick={() => {
                                setCourseArray((prev) =>
                                  prev.filter((value) => {
                                    const bool =
                                      value.course !==
                                      prev[parseInt(row.id)]?.course;
                                    if (!bool) {
                                      toast.warning(
                                        `${value.course} was deleted`,
                                      );
                                    }
                                    return bool;
                                  }),
                                );
                              }}
                            >
                              Delete
                            </Button>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      )}
                    </ContextMenu>
                  );
                })}
              </div>
              <ScrollBar />
              <ScrollAreaPrimitive.Corner />
            </ScrollAreaPrimitive.Viewport>
          ) : (
            <TableRow className="flex w-full flex-1 items-center justify-center">
              <TableCell
                colSpan={columns.length}
                className="flex h-60 w-full flex-1 items-center justify-center text-center"
              >
                No results.
              </TableCell>
            </TableRow>
          )}
        </ScrollArea>
      </div>

      <div className="text-sm text-muted-foreground">
        {table.getFilteredSelectedRowModel().rows.length} of{" "}
        {table.getFilteredRowModel().rows.length} row(s) selected.
      </div>
    </>
  );
}
function ttble<TData, TValue>(
  data: TData[],
  columns: ColumnDef<TData, TValue>[],
  setRowSelection: React.Dispatch<React.SetStateAction<object>>,
  rowSelection: object,
) {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      //@ts-expect-error idek
      rowSelection,
    },
  });
}
