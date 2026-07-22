/**
 * 证件照历史记录管理（IndexedDB 存储）
 *
 * 在浏览器本地保存用户的制作记录，解决"下次找不到"的痛点。
 * 所有数据存储在用户本地，不上传服务器。
 */

// ============================================================
// 类型定义
// ============================================================

export interface HistoryRecord {
  /** 唯一 ID（自增时间戳） */
  id: number;
  /** 制作时间 ISO 字符串 */
  createdAt: string;
  /** 场景名称（如 "护照"） */
  sceneName?: string;
  /** 照片尺寸名称（如 "1寸"） */
  sizeName: string;
  /** 尺寸像素 */
  widthPx: number;
  heightPx: number;
  /** 背景色 */
  bgColor: string;
  /** 缩略图 Blob URL（小型 base64，用于列表展示） */
  thumbnailDataUrl: string;
  /** 原图 Blob（完整分辨率，用于重新编辑） */
  originalBlob?: Blob;
  /** 成品图 Blob（完整分辨率，用于下载） */
  resultBlob?: Blob;
}

// ============================================================
// IndexedDB 封装
// ============================================================

const DB_NAME = 'IdPhotoStudio';
const DB_VERSION = 2;
const STORE_NAME = 'history';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ============================================================
// 公开 API
// ============================================================

/**
 * 保存一条制作记录
 * 注意：Blob 必须提前转成 base64 或直接存 Blob（取决于浏览器支持）
 */
export async function addHistoryRecord(
  record: Omit<HistoryRecord, 'id'>,
): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(record);
    req.onsuccess = () => {
      resolve(req.result as number);
      // 限制历史记录数量（保留最近 50 条）
      trimHistory(store, 50);
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * 获取所有历史记录（按时间倒序）
 */
export async function getAllHistoryRecords(): Promise<HistoryRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('createdAt');
    // 降序（最新的在前）
    const req = index.openCursor(null, 'prev');
    const records: HistoryRecord[] = [];
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        records.push(cursor.value);
        cursor.continue();
      } else {
        resolve(records);
      }
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * 删除一条记录
 */
export async function deleteHistoryRecord(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 清空所有记录
 */
export async function clearAllHistory(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 获取记录总数
 */
export async function getHistoryCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.count();
    req.onsuccess = () => {
      resolve(req.result);
      db.close();
    };
    req.onerror = () => reject(req.error);
  });
}

// ============================================================
// 内部工具
// ============================================================

/**
 * 限制历史记录数量（保留最新的 N 条）
 */
async function trimHistory(
  store: IDBObjectStore,
  maxCount: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const countReq = store.count();
    countReq.onsuccess = () => {
      const total = countReq.result;
      if (total <= maxCount) {
        resolve();
        return;
      }
      // 删除最旧的记录
      const index = store.index('createdAt');
      const cursorReq = index.openCursor(null, 'next');
      let toDelete = total - maxCount;
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor && toDelete > 0) {
          store.delete(cursor.primaryKey);
          toDelete--;
          cursor.continue();
        } else {
          resolve();
        }
      };
    };
    countReq.onerror = () => reject(countReq.error);
  });
}

/**
 * 从 Blob 生成缩略图 data URL（最长边 200px）
 */
export function generateThumbnail(
  blob: Blob,
  maxDimension = 200,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > maxDimension || h > maxDimension) {
        const ratio = maxDimension / Math.max(w, h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => reject(new Error('缩略图生成失败'));
    img.src = URL.createObjectURL(blob);
  });
}
