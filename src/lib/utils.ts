import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]){ return twMerge(clsx(inputs)); }
export function wordCount(t: string){ return t.trim().split(/\s+/).filter(Boolean).length; }