// 페이지 간 녹화 blob URL 전달용 모듈 레벨 싱글톤
let _blobUrl: string | null = null;

export const recordingStore = {
  set(url: string) {
    _blobUrl = url;
  },
  get(): string | null {
    return _blobUrl;
  },
  consume(): string | null {
    const url = _blobUrl;
    _blobUrl = null;
    return url;
  },
};
