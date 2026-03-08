"use client";

import * as React from "react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger_ = DropdownMenuPrimitive.Trigger;
const DropdownMenuContent = DropdownMenuPrimitive.Content;
const DropdownMenuItem = DropdownMenuPrimitive.Item;
const DropdownMenuSeparator = DropdownMenuPrimitive.Separator;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
const DropdownMenuSub_ = DropdownMenuPrimitive.Sub;
const DropdownMenuSubTrigger = DropdownMenuPrimitive.SubTrigger;
const DropdownMenuSubContent = DropdownMenuPrimitive.SubContent;
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const DropdownMenuTrigger = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuTrigger_>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuTrigger_>
>(({ className, ...props }, ref) => (
  <DropdownMenuTrigger_
    ref={ref}
    className={cn(
      "flex size-9 items-center justify-center rounded-md outline-none transition-colors hover:bg-muted focus:ring-1 focus:ring-ring disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
DropdownMenuTrigger.displayName = DropdownMenuTrigger_.displayName;

const DropdownMenuContent_ = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuContent>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuContent
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent_.displayName = "DropdownMenuContent";

const DropdownMenuItem_ = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuItem>
>(({ className, ...props }, ref) => (
  <DropdownMenuItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  />
));
DropdownMenuItem_.displayName = "DropdownMenuItem";

const DropdownMenuSeparator_ = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuSeparator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuSeparator>
>(({ className, ...props }, ref) => (
  <DropdownMenuSeparator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-border", className)}
    {...props}
  />
));
DropdownMenuSeparator_.displayName = "DropdownMenuSeparator";

const DropdownMenuSubTrigger_ = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuSubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuSubTrigger>
>(({ className, ...props }, ref) => (
  <DropdownMenuSubTrigger
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent",
      className,
    )}
    {...props}
  />
));
DropdownMenuSubTrigger_.displayName = "DropdownMenuSubTrigger";

const DropdownMenuSubContent_ = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuSubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuSubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuSubContent
    ref={ref}
    className={cn(
      "z-50 min-w-[12rem] max-w-[min(20rem,90vw)] max-h-[min(16rem,70vh)] overflow-y-auto overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg",
      "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className,
    )}
    {...props}
  />
));
DropdownMenuSubContent_.displayName = "DropdownMenuSubContent";

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
};
export { DropdownMenuContent_ as DropdownMenuContent };
export { DropdownMenuItem_ as DropdownMenuItem };
export { DropdownMenuSeparator_ as DropdownMenuSeparator };
export { DropdownMenuSub_ as DropdownMenuSub };
export { DropdownMenuSubTrigger_ as DropdownMenuSubTrigger };
export { DropdownMenuSubContent_ as DropdownMenuSubContent };
