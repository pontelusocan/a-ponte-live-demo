import type { ShareSubmission } from "./submission";

export type Member = {
  username: string; email: string; displayName: string; avatar: string;
  company: string; relationship: string; verified: boolean;
};
export type MemberPhoto = { id: string; description: string; createdAt: string; status: "pending" | "approved" | "declined" };
export type ShareDraft = { submission: ShareSubmission; id: string; expires: number };

export async function memberRequest<T>(path: string, data?: object): Promise<T> {
  const response = await fetch("/api/members/" + path, {
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
    ...(data && {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(data)}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "temporarily_unavailable");
  return result;
}

export function linkParameters() {
  return new URLSearchParams(window.location.hash.slice(1));
}

export function clearLink() {
  history.replaceState(history.state, "", location.pathname + location.search);
}

async function draftOperation<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open("aponte-live-drafts", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("drafts");
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction("drafts", mode);
      const request = operation(transaction.objectStore("drafts"));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally { database.close(); }
}

export async function saveDraft(draft: ShareDraft) {
  // One active draft per device. A later draft supersedes the previous one.
  await draftOperation("readwrite", store => store.put(draft, "active"));
}
export async function loadDraft(id: string): Promise<ShareDraft | null> {
  const draft = await draftOperation<ShareDraft | undefined>("readonly", store => store.get("active"));
  if (draft && draft.expires <= Date.now()) await removeDraft(draft.id);
  return draft?.id === id && draft.expires > Date.now() ? draft : null;
}
export async function removeDraft(id: string) {
  await draftOperation("readwrite", store => {
    const request = store.get("active");
    request.onsuccess = () => { if (request.result?.id === id) store.delete("active"); };
    return request;
  });
}
