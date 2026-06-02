import { useRef, useState, useCallback } from 'react';
import { recordingStore } from '../services/recordingStore';

export function useVideoRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback((stream: MediaStream) => {
    chunksRef.current = [];

    const mimeType =
      ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find(
        (t) => MediaRecorder.isTypeSupported(t)
      ) ?? '';

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' });
      // 다음 페이지(ResultsPage)에서 읽을 수 있도록 모듈 싱글톤에 저장
      // React Router state로 Blob을 직렬화할 수 없어서 이 방식을 택했다
      recordingStore.set(URL.createObjectURL(blob));
    };

    recorder.start(1000);
    recorderRef.current = recorder;
    setIsRecording(true);
  }, []);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    setIsRecording(false);
  }, []);

  return { isRecording, startRecording, stopRecording };
}
