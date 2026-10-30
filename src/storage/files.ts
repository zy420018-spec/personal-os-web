const DB_NAME = "personal-os-files";
const STORE_NAME = "evidence-files";
const DB_VERSION = 1;

export interface StoredFile {
  id: string;
  name: string;
  type: string;
  size: number;
  blob: Blob;
  createdAt: string;
}

const openDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const runTransaction = async <T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
) => {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
};

export const saveEvidenceFile = async (file: File) => {
  const fileId =
    globalThis.crypto?.randomUUID?.() ||
    `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const record: StoredFile = {
    id: fileId,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    blob: file,
    createdAt: new Date().toISOString(),
  };
  await runTransaction("readwrite", (store) => store.put(record));
  return {
    fileId,
    fileName: file.name,
    mimeType: record.type,
    fileSize: file.size,
  };
};

export const getEvidenceFile = async (fileId: string) =>
  runTransaction<StoredFile | undefined>("readonly", (store) =>
    store.get(fileId),
  );

export const deleteEvidenceFile = async (fileId: string) =>
  runTransaction("readwrite", (store) => store.delete(fileId));

export const downloadStoredFile = async (fileId: string) => {
  const file = await getEvidenceFile(fileId);
  if (!file) throw new Error("文件不存在或已被清理。");
  const url = URL.createObjectURL(file.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const createStoredFileUrl = async (fileId: string) => {
  const file = await getEvidenceFile(fileId);
  if (!file) return "";
  return URL.createObjectURL(file.blob);
};
