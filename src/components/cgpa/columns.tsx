"use client";

import { type ColumnDef } from "@tanstack/react-table";

export type Course = {
  course: string;
  credit: number;
  grade: "A" | "B" | "C" | "D" | "E" | "F";
};

export const columns: ColumnDef<Course>[] = [
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
