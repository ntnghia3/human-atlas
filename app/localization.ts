export const LANGUAGES = ['en', 'vi'] as const;
export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'en';
export const LANGUAGE_STORAGE_KEY = 'human-atlas.language';

const englishMessages = {
  'language.label': 'Language',
  'language.english': 'English',
  'language.vietnamese': 'Tiếng Việt',
  'brand.interactiveAnatomy': 'Interactive anatomy',
  'identity.modeledPieces': '{count} modeled pieces',
  'navigation.explorerPanels': 'Explorer panels',
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
  'controls.showOnlySystem': 'Show only this system',
  'controls.toggleSystem': 'Show or hide this system',
  'controls.piecesVisible': '{count} pieces visible',
  'search.close': 'Close search',
  'search.placeholder': 'Search a structure by name or ID…',
  'search.aria': 'Search named anatomical structures',
  'search.noMatches': 'No structures match your search.',
  'search.emptyHint': 'Start with a major organ, or search every named structure.',
  'search.refineHint': 'Showing up to 80 matches. Refine your search to find smaller structures.',
  'search.piece': 'piece',
  'search.pieces': 'pieces',
  'loading.preparing': 'Preparing the anatomy',
  'loading.progress': '{progress}% · Loading {count} pieces',
  'controls.reload': 'Reload viewer',
  'camera.controls': 'Camera controls',
  'camera.threeQuarter': 'Three-quarter view',
  'camera.front': 'Front view',
  'camera.side': 'Side view',
  'camera.back': 'Back view',
  'camera.rotate': 'Rotate body',
  'camera.pause': 'Pause rotation',
  'camera.autoRotate': 'Auto rotate',
  'camera.dragOrbit': 'Drag to orbit',
  'camera.dragPan': 'Drag to pan',
  'camera.pinchZoom': 'Pinch to zoom',
  'camera.tapInspect': 'Tap to inspect',
  'scene.aria': 'Interactive human anatomy. Drag to orbit, pinch or scroll to zoom, and tap a structure to inspect it.',
  'scene.selectedStructure': 'Selected structure',
  'scene.inventory': 'Anatomical inventory',
  'scene.separatedStructures': 'Separated structures',
  'detail.originalEnglish': 'Original English term',
  'detail.vietnameseUnavailable': 'Verified Vietnamese terminology not yet available',
  'detail.canonicalLatin': 'Canonical Latin',
  'detail.sourceIds': 'Source identifiers',
  'detail.atlasReference': 'Atlas reference',
  'detail.selectedPieces': 'Selected pieces',
  'detail.includedStructures': 'Included structures',
  'detail.morePieces': 'And {count} more modeled pieces.',
  'detail.viewSource': 'View anatomical source',
  'detail.showSurrounding': 'Show surrounding anatomy',
  'detail.isolate': 'Isolate structure',
  'detail.clearSelection': 'Clear selection',
  'about.eyebrow': 'Source & scope',
  'about.title': 'A body, revealed.',
  'about.sourceHeading': 'Source',
  'about.datasetLicense': 'Dataset license',
  'about.originalGeometry': 'Original geometry & metadata',
  'about.sourcePublication': 'Read the source publication',
  'errors.webgl': 'This browser could not start the 3D viewer. Please try a browser with WebGL enabled.',
  'errors.atlasLoad': 'The anatomy catalogue could not be loaded.',
  'errors.chunkLoad': 'Could not load the anatomy.',
  'errors.contextLost': 'The 3D session was paused by your device. Reload to continue.',
} as const;

const vietnameseMessages = {
  'language.label': 'Ngôn ngữ',
  'language.english': 'English',
  'language.vietnamese': 'Tiếng Việt',
  'brand.interactiveAnatomy': 'Giải phẫu tương tác',
  'identity.modeledPieces': '{count} mảnh mô hình',
  'navigation.explorerPanels': 'Bảng điều khiển khám phá',
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
  'controls.showOnlySystem': 'Chỉ hiển thị hệ này',
  'controls.toggleSystem': 'Hiển thị hoặc ẩn hệ này',
  'controls.piecesVisible': '{count} mảnh đang hiển thị',
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
  'camera.controls': 'Điều khiển góc nhìn',
  'camera.threeQuarter': 'Góc nhìn ba phần tư',
  'camera.front': 'Góc nhìn trước',
  'camera.side': 'Góc nhìn bên',
  'camera.back': 'Góc nhìn sau',
  'camera.rotate': 'Xoay mô hình',
  'camera.pause': 'Tạm dừng xoay',
  'camera.autoRotate': 'Tự động xoay',
  'camera.dragOrbit': 'Kéo để xoay quanh',
  'camera.dragPan': 'Kéo để di chuyển',
  'camera.pinchZoom': 'Chụm để thu phóng',
  'camera.tapInspect': 'Chạm để xem chi tiết',
  'scene.aria': 'Giải phẫu người tương tác. Kéo để xoay, chụm hoặc cuộn để thu phóng, chạm vào một cấu trúc để xem chi tiết.',
  'scene.selectedStructure': 'Cấu trúc đang chọn',
  'scene.inventory': 'Danh mục giải phẫu',
  'scene.separatedStructures': 'Cấu trúc đã tách',
  'detail.originalEnglish': 'Tên tiếng Anh gốc',
  'detail.vietnameseUnavailable': 'Chưa có thuật ngữ tiếng Việt đã được thẩm định',
  'detail.canonicalLatin': 'Tên Latin chuẩn',
  'detail.sourceIds': 'Mã định danh nguồn',
  'detail.atlasReference': 'Mã tham chiếu atlas',
  'detail.selectedPieces': 'Mảnh đã chọn',
  'detail.includedStructures': 'Các cấu trúc đi kèm',
  'detail.morePieces': 'Còn {count} mảnh mô hình khác.',
  'detail.viewSource': 'Xem nguồn dữ liệu giải phẫu',
  'detail.showSurrounding': 'Hiển thị vùng xung quanh',
  'detail.isolate': 'Cô lập cấu trúc',
  'detail.clearSelection': 'Bỏ chọn',
  'about.eyebrow': 'Nguồn & phạm vi',
  'about.title': 'Khám phá cơ thể.',
  'about.sourceHeading': 'Nguồn',
  'about.datasetLicense': 'Giấy phép dữ liệu',
  'about.originalGeometry': 'Hình học & siêu dữ liệu gốc',
  'about.sourcePublication': 'Đọc ấn phẩm nguồn',
  'errors.webgl': 'Trình duyệt không thể khởi động trình xem 3D. Hãy thử trình duyệt có hỗ trợ WebGL.',
  'errors.atlasLoad': 'Không thể tải danh mục giải phẫu.',
  'errors.chunkLoad': 'Không thể tải dữ liệu giải phẫu.',
  'errors.contextLost': 'Phiên 3D đã bị thiết bị tạm dừng. Hãy tải lại để tiếp tục.',
} satisfies Record<keyof typeof englishMessages, string>;

const messages = {en: englishMessages, vi: vietnameseMessages};
export type MessageKey = keyof typeof englishMessages;
export type MessageValues = Record<string, number | string>;
export const MESSAGE_KEYS = Object.keys(englishMessages) as MessageKey[];

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
