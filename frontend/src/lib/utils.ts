import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getStorageUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("data:") || path.startsWith("blob:")) return path;

  // If already absolute URL
  if (path.startsWith("http://") || path.startsWith("https://")) {
    // If the URL points to localhost / 127.0.0.1 but the frontend is running on a remote host (like staging/prod),
    // extract relative storage path and resolve using current origin / storage URL.
    if (
      typeof window !== "undefined" &&
      window.location &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      if (path.includes("localhost") || path.includes("127.0.0.1")) {
        const storageIndex = path.indexOf("/storage/");
        if (storageIndex !== -1) {
          const subPath = path.slice(storageIndex + "/storage/".length);
          return getStorageUrl(subPath);
        }
      }
    }

    // Upgrade HTTP to HTTPS if page is loaded over HTTPS to prevent mixed-content blocking
    if (
      typeof window !== "undefined" &&
      window.location?.protocol === "https:" &&
      path.startsWith("http://")
    ) {
      return path.replace(/^http:\/\//i, "https://");
    }

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

  let baseUrl = process.env.NEXT_PUBLIC_STORAGE_URL;
  if (!baseUrl) {
    if (process.env.NEXT_PUBLIC_API_URL) {
      baseUrl = process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/i, "") + "/storage";
    } else if (typeof window !== "undefined" && window.location?.origin) {
      baseUrl = `${window.location.origin}/storage`;
    } else {
      baseUrl = "http://127.0.0.1:8000/storage";
    }
  }

  while (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1);
  }

  return `${baseUrl}/${cleanPath}`;
}
