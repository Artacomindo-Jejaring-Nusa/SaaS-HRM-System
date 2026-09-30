import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getStorageUrl(path: string | null | undefined) {
  if (!path) return "";
  if (path.startsWith("data:")) return path;

  // If already absolute URL
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  
  // Clean leading slashes and redundant storage/ prefix without regex (eliminates ReDoS risk)
  let cleanPath = path;
  while (cleanPath.startsWith("/")) {
    cleanPath = cleanPath.slice(1);
  }

  if (cleanPath.startsWith("storage/")) {
    cleanPath = cleanPath.slice("storage/".length);
  }

  let baseUrl = process.env.NEXT_PUBLIC_STORAGE_URL || "http://127.0.0.1:8000/storage";
  while (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1);
  }

  return `${baseUrl}/${cleanPath}`;
}
