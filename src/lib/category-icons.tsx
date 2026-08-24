import { createElement, type SVGProps } from "react";
import {
  Leaf,
  Apple,
  Wheat,
  Carrot,
  Bean,
  Egg,
  Bird,
  Sparkles,
  Sprout,
  type LucideIcon,
} from "lucide-react";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  leaf: Leaf,
  apple: Apple,
  wheat: Wheat,
  carrot: Carrot,
  bean: Bean,
  egg: Egg,
  bird: Bird,
  sparkles: Sparkles,
};

export function getCategoryIcon(icon: string | null | undefined): LucideIcon {
  return (icon && CATEGORY_ICONS[icon]) || Sprout;
}

// Renders the category icon as an element rather than handing back a
// component type to render inline — assigning a dynamically-selected
// component to a capitalized variable and using it as a JSX tag trips
// React Compiler's "components created during render" check, even though
// the lookup itself is a stable, pure table read.
export function renderCategoryIcon(
  icon: string | null | undefined,
  props?: SVGProps<SVGSVGElement>
) {
  return createElement(getCategoryIcon(icon), props);
}

const CATEGORY_TINTS: Record<string, string> = {
  leaf: "bg-primary/10 text-primary",
  apple: "bg-orange-500/10 text-orange-600",
  wheat: "bg-amber-500/10 text-amber-700",
  carrot: "bg-orange-600/10 text-orange-700",
  bean: "bg-yellow-700/10 text-yellow-800",
  egg: "bg-secondary/10 text-secondary-foreground",
  bird: "bg-red-500/10 text-red-600",
  sparkles: "bg-emerald-500/10 text-emerald-700",
};

export function getCategoryTint(icon: string | null | undefined): string {
  return (icon && CATEGORY_TINTS[icon]) || "bg-accent text-primary";
}
