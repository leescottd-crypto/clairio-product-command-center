const DB_NAME = "clairio-task-attachments";
const STORE_NAME = "files";
const DB_VERSION = 1;

export type AttachmentBlobRecord = {
  id: string;
  blob: Blob;
  name: string;
  type: string;
  size: number;
  updatedAt: string;
};

function openAttachmentDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

export async function saveAttachmentBlob(record: AttachmentBlobRecord) {
  const db = await openAttachmentDb();

  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };

    transaction.objectStore(STORE_NAME).put(record);
  });
}

export async function getAttachmentBlob(id: string) {
  const db = await openAttachmentDb();

  return new Promise<AttachmentBlobRecord | null>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(id);

    request.onsuccess = () => resolve((request.result as AttachmentBlobRecord | undefined) ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

export async function deleteAttachmentBlob(id: string) {
  const db = await openAttachmentDb();

  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };

    transaction.objectStore(STORE_NAME).delete(id);
  });
}
