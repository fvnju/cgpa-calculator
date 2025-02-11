import { type ReactNode } from "react";
import { useMediaQuery } from "./page";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "../ui/drawer";
import { Button } from "../ui/button";
import { atom, useAtom } from "jotai";

export const customModalState = atom(false);

export function CustomDrawerDialog({
  children,
  actions,
}: {
  children: ReactNode;
  actions?: ReactNode;
}) {
  const [open, setOpen] = useAtom<boolean | undefined>(customModalState);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Table</DialogTitle>
            <DialogDescription>Make changes to the table.</DialogDescription>
          </DialogHeader>
          {actions}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{children}</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Edit Table</DrawerTitle>
          <DrawerDescription>Make changes to the table.</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-1 px-4">{actions}</div>
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
