export const LANGUAGES = ['en', 'vi'] as const;
export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'en';
export const LANGUAGE_STORAGE_KEY = 'human-atlas.language';

const englishMessages = {
  'language.label': 'Language',
  'controls.search': 'Find a structure',
  'controls.searchAria': 'Search anatomy',
  'controls.about': 'About this atlas',
  'controls.systems': 'Systems',
  'controls.closeSystems': 'Close systems',
  'controls.all': 'All',
  'controls.skeleton': 'Skeleton',
  'controls.organs': 'Organs',
  'controls.hideAll': 'Hide all',
  'controls.reset': 'Reset',
  'controls.resetViewLayers': 'Reset view and layers',
  'controls.explode': 'Explode anatomy',
  'controls.assembled': 'Assembled',
  'controls.everyPiece': 'Every piece',
  'controls.openSystems': 'Open system layers',
  'controls.sourceCredits': 'Source & credits',
  'search.close': 'Close search',
  'search.placeholder': 'Heart, femur, cranial nerve…',
  'search.aria': 'Search named anatomical structures',
  'search.noMatches': 'No structures match your search.',
  'search.emptyHint': 'Start with a major organ, or search every named structure.',
  'search.refineHint': 'Showing up to 80 matches. Refine your search to find smaller structures.',
  'search.piece': 'piece',
  'search.pieces': 'pieces',
  'loading.preparing': 'Preparing the anatomy',
  'loading.progress': '{progress}% · Loading {count} pieces',
  'controls.reload': 'Reload viewer',
} as const;

const vietnameseMessages = {
  'language.label': 'Ngôn ngữ',
  'controls.search': 'Tìm cấu trúc',
  'controls.searchAria': 'Tìm kiếm giải phẫu',
  'controls.about': 'Giới thiệu atlas',
  'controls.systems': 'Các hệ cơ quan',
  'controls.closeSystems': 'Đóng các hệ cơ quan',
  'controls.all': 'Tất cả',
  'controls.skeleton': 'Bộ xương',
  'controls.organs': 'Cơ quan',
  'controls.hideAll': 'Ẩn tất cả',
  'controls.reset': 'Đặt lại',
  'controls.resetViewLayers': 'Đặt lại góc nhìn và các lớp',
  'controls.explode': 'Tách giải phẫu',
  'controls.assembled': 'Lắp ráp',
  'controls.everyPiece': 'Từng mảnh',
  'controls.openSystems': 'Mở các lớp hệ cơ quan',
  'controls.sourceCredits': 'Nguồn & ghi công',
  'search.close': 'Đóng tìm kiếm',
  'search.placeholder': 'Tìm theo tên tiếng Anh hoặc mã nguồn…',
  'search.aria': 'Tìm kiếm các cấu trúc giải phẫu có tên',
  'search.noMatches': 'Không có cấu trúc phù hợp.',
  'search.emptyHint': 'Bắt đầu với một cơ quan lớn hoặc tìm trong mọi cấu trúc có tên.',
  'search.refineHint': 'Hiển thị tối đa 80 kết quả. Hãy thu hẹp tìm kiếm để tìm cấu trúc nhỏ hơn.',
  'search.piece': 'mảnh',
  'search.pieces': 'mảnh',
  'loading.preparing': 'Đang chuẩn bị dữ liệu giải phẫu',
  'loading.progress': '{progress}% · Đang tải {count} mảnh',
  'controls.reload': 'Tải lại trình xem',
} satisfies Record<keyof typeof englishMessages, string>;

const messages = {en: englishMessages, vi: vietnameseMessages};
export type MessageKey = keyof typeof englishMessages;
export type MessageValues = Record<string, number | string>;

export function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'vi';
}

export function translate(language: Language, key: MessageKey, values?: MessageValues): string {
  let message = messages[language][key] ?? messages.en[key] ?? key;
  for (const [name, value] of Object.entries(values ?? {})) message = message.replaceAll(`{${name}}`, String(value));
  return message;
}

export const getMessage = translate;

type StorageReader = Pick<Storage, 'getItem'>;
type StorageWriter = Pick<Storage, 'setItem'>;

function browserStorage(): (StorageReader & StorageWriter) | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function readStoredLanguage(storage: StorageReader | undefined = browserStorage()): Language {
  try {
    const value = storage?.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(value) ? value : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export function persistLanguage(language: Language, storage: StorageWriter | undefined = browserStorage()): void {
  try {
    storage?.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // A blocked or unavailable storage should not prevent the viewer from working.
  }
}
