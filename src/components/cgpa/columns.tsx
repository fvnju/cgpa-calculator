"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { z } from "zod";
import { Checkbox } from "../ui/checkbox";

export const courseSchema = z
  .object({
    selected: z.boolean().optional(),
    course: z.string().min(3),
    credit: z.number().min(1),
    grade: z.enum(["A", "B", "C", "D", "E", "F"]),
  })
  .strict();

export type Course = z.infer<typeof courseSchema>;

export const columns: ColumnDef<Course>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),

    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "course",
    header: "Course",
  },
  {
    accessorKey: "credit",
    header: "Credit",
  },
  {
    accessorKey: "grade",
    header: "Grade",
  },
  // {
  //   id: "actions",
  //   cell: (
  //     {
  //       /*row*/
  //     },
  //   ) => {
  //     //const course = row.original;

  //     return (
  //       <DropdownMenu>
  //         <DropdownMenuTrigger asChild>
  //           <Button variant="ghost" className="h-8 w-8 p-0">
  //             <span className="sr-only">Open menu</span>
  //             <MoreHorizontal className="h-4 w-4" />
  //           </Button>
  //         </DropdownMenuTrigger>
  //         <DropdownMenuContent align="end" className="rounded-xl">
  //           <DropdownMenuItem asChild>
  //             <Button variant={"destructive"} className="w-full rounded-xl">
  //               Delete
  //             </Button>
  //           </DropdownMenuItem>
  //         </DropdownMenuContent>
  //       </DropdownMenu>
  //     );
  //   },
  // },
];
