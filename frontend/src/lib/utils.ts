import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function normalizeAbsoluteUrl(path: string): string {
  const isBrowser = typeof globalThis.window !== "undefined";
  const browserLocation = isBrowser ? (globalThis as any).location : undefined;
  const hostname = browserLocation?.hostname;
  const isRemoteHost = Boolean(hostname && hostname !== "localhost" && hostname !== "127.0.0.1");

  if (isRemoteHost && (path.includes("localhost") || path.includes("127.0.0.1"))) {
    const storageIndex = path.indexOf("/storage/");
    if (storageIndex !== -1) {
      const subPath = path.slice(storageIndex + "/storage/".length);
      return getStorageUrl(subPath);
    }
  }

  if (isBrowser && browserLocation?.protocol === "https:" && path.startsWith("http://")) {
    return path.replace(/^http:\/\//i, "https://");
  }

  return path;
}

function cleanStoragePath(path: string): string {
  let clean = path;
  while (clean.startsWith("/")) {
    clean = clean.slice(1);
  }
  if (clean.startsWith("storage/")) {
    clean = clean.slice("storage/".length);
  }
  return clean;
}

function resolveBaseStorageUrl(): string {
  if (process.env.NEXT_PUBLIC_STORAGE_URL) {
    return process.env.NEXT_PUBLIC_STORAGE_URL;
  }
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/i, "") + "/storage";
  }
  if (typeof globalThis.window !== "undefined" && (globalThis as any).location?.origin) {
    return `${(globalThis as any).location.origin}/storage`;
  }
  return "http://127.0.0.1:8000/storage";
}

export function getStorageUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("data:") || path.startsWith("blob:")) return path;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return normalizeAbsoluteUrl(path);
  }

  const cleanPath = cleanStoragePath(path);
  let baseUrl = resolveBaseStorageUrl();
  while (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1);
  }

  return `${baseUrl}/${cleanPath}`;
}
