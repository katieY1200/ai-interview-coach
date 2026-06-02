import { useEffect, forwardRef } from 'react';

interface Props {
  stream: MediaStream | null;
  isRecording: boolean;
  isAnalysisReady: boolean;
  isAnalysisLoading: boolean;
}

export const WebcamPreview = forwardRef<HTMLVideoElement, Props>(
  ({ stream, isRecording, isAnalysisReady, isAnalysisLoading }, ref) => {
    useEffect(() => {
      const video = (ref as React.RefObject<HTMLVideoElement>)?.current;
      if (video && stream) {
        video.srcObject = stream;
        video.play().catch(() => {});
      }
    }, [stream, ref]);

    return (
      <div
        className="relative rounded-xl overflow-hidden bg-gray-900 shadow-lg"
        style={{ width: 180, height: 135 }}
      >
        <video
          ref={ref}
          muted
          playsInline
          className="w-full h-full object-cover scale-x-[-1]"
        />

        {/* 녹화 표시 */}
        {isRecording && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 rounded-full px-2 py-0.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white text-xs font-medium">REC</span>
          </div>
        )}

        {/* 분석 상태 */}
        <div className="absolute bottom-2 right-2">
          {isAnalysisLoading && (
            <div className="bg-black/60 rounded-full px-2 py-0.5 text-xs text-yellow-300">
              AI 분석 로딩...
            </div>
          )}
          {isAnalysisReady && !isAnalysisLoading && (
            <div className="bg-black/60 rounded-full px-2 py-0.5 text-xs text-emerald-300">
              ● 분석 중
            </div>
          )}
        </div>

        {/* 스트림 없을 때 */}
        {!stream && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs text-center px-2">
            카메라 없음
          </div>
        )}
      </div>
    );
  }
);

WebcamPreview.displayName = 'WebcamPreview';
