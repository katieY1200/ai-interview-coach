import { useEffect, useRef, useState, useCallback } from 'react';
import {
  FaceLandmarker,
  PoseLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
  type PoseLandmarkerResult,
} from '@mediapipe/tasks-vision';

export interface BehaviorWarning {
  type: 'gaze_deviation' | 'excessive_movement' | 'flat_expression' | 'no_face';
  label: string;
  timestamp: number; // seconds since interview started
}

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.20/wasm';
const FACE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const POSE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

const COOLDOWN_MS: Record<string, number> = {
  gaze_deviation: 5000,
  excessive_movement: 5000,
  flat_expression: 10000,
  no_face: 4000,
};

export function useBehaviorAnalysis() {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentWarning, setCurrentWarning] = useState<BehaviorWarning | null>(null);
  const [warnings, setWarnings] = useState<BehaviorWarning[]>([]);

  const faceRef = useRef<FaceLandmarker | null>(null);
  const poseRef = useRef<PoseLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastWarningTime = useRef<Record<string, number>>({});
  const prevShoulderRef = useRef<{ x: number; y: number } | null>(null);
  const movementBuffer = useRef<number[]>([]);
  const expressionBuffer = useRef<number[]>([]);
  const noFaceFrames = useRef(0);
  const lastFaceTime = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_URL);

        const [face, pose] = await Promise.all([
          FaceLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'GPU' },
            outputFaceBlendshapes: true,
            runningMode: 'VIDEO',
            numFaces: 1,
          }),
          PoseLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: POSE_MODEL, delegate: 'GPU' },
            runningMode: 'VIDEO',
            numPoses: 1,
          }),
        ]);

        if (!cancelled) {
          faceRef.current = face;
          poseRef.current = pose;
          setIsReady(true);
        }
      } catch (e) {
        console.warn('MediaPipe 초기화 실패:', e);
        // TODO: 초기화 실패 시 사용자에게 안내 (현재는 분석 없이 진행)
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const triggerWarning = useCallback((type: BehaviorWarning['type'], label: string, elapsed: number) => {
    const now = Date.now();
    const cooldown = COOLDOWN_MS[type] ?? 5000;
    if ((now - (lastWarningTime.current[type] ?? 0)) < cooldown) return;

    lastWarningTime.current[type] = now;
    const w: BehaviorWarning = { type, label, timestamp: elapsed };
    setCurrentWarning(w);
    setWarnings((prev) => [...prev, w]);
    setTimeout(() => setCurrentWarning(null), 3500);
  }, []);

  const analyzeGaze = useCallback((result: FaceLandmarkerResult, elapsed: number) => {
    if (!result.faceLandmarks?.length) {
      noFaceFrames.current += 1;
      // 얼굴이 3초 이상 미감지 → 경고
      if (elapsed - lastFaceTime.current > 3) {
        triggerWarning('no_face', '카메라를 바라봐 주세요', elapsed);
      }
      return;
    }

    noFaceFrames.current = 0;
    lastFaceTime.current = elapsed;

    const lm = result.faceLandmarks[0];

    // 좌측 홍채(468) vs 좌측 눈 코너 (33=외, 133=내)
    const lIrisX = lm[468].x;
    const lOuterX = lm[33].x;
    const lInnerX = lm[133].x;
    const lEyeW = Math.abs(lOuterX - lInnerX);

    // 우측 홍채(473) vs 우측 눈 코너 (362=내, 263=외)
    const rIrisX = lm[473].x;
    const rInnerX = lm[362].x;
    const rOuterX = lm[263].x;
    const rEyeW = Math.abs(rOuterX - rInnerX);

    if (lEyeW < 0.01 || rEyeW < 0.01) return;

    const lRatio = (lIrisX - Math.min(lOuterX, lInnerX)) / lEyeW;
    const rRatio = (rIrisX - Math.min(rInnerX, rOuterX)) / rEyeW;
    const avg = (lRatio + rRatio) / 2;

    if (avg < 0.2 || avg > 0.8) {
      triggerWarning('gaze_deviation', '카메라를 바라봐 주세요', elapsed);
    }
  }, [triggerWarning]);

  const analyzeExpression = useCallback((result: FaceLandmarkerResult, elapsed: number) => {
    if (!result.faceLandmarks?.length) return;

    const lm = result.faceLandmarks[0];
    // 입술 간격 (상: 13, 하: 14) + 눈썹-눈 간격 (눈썹:70, 눈:159)
    const mouthOpen = Math.abs(lm[13].y - lm[14].y);
    const browRaise = Math.abs(lm[70].y - lm[159].y);
    const score = mouthOpen + browRaise;

    expressionBuffer.current.push(score);
    if (expressionBuffer.current.length > 30) expressionBuffer.current.shift(); // ~10초

    if (expressionBuffer.current.length >= 30) {
      const max = Math.max(...expressionBuffer.current);
      const min = Math.min(...expressionBuffer.current);
      const variation = max - min;
      if (variation < 0.01) {
        triggerWarning('flat_expression', '표정이 굳었습니다. 자연스럽게 유지해 주세요', elapsed);
      }
    }
  }, [triggerWarning]);

  const analyzeMovement = useCallback((result: PoseLandmarkerResult, elapsed: number) => {
    if (!result.landmarks?.length) return;

    const lm = result.landmarks[0];
    const leftShoulder = lm[11];
    const rightShoulder = lm[12];
    const midX = (leftShoulder.x + rightShoulder.x) / 2;
    const midY = (leftShoulder.y + rightShoulder.y) / 2;

    if (prevShoulderRef.current) {
      const dx = midX - prevShoulderRef.current.x;
      const dy = midY - prevShoulderRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      movementBuffer.current.push(dist);
      if (movementBuffer.current.length > 15) movementBuffer.current.shift();

      const avg = movementBuffer.current.reduce((a, b) => a + b, 0) / movementBuffer.current.length;
      if (avg > 0.015) {
        triggerWarning('excessive_movement', '몸이 너무 흔들립니다. 안정적인 자세를 유지해 주세요', elapsed);
      }
    }

    prevShoulderRef.current = { x: midX, y: midY };
  }, [triggerWarning]);

  const startAnalysis = useCallback((video: HTMLVideoElement, getElapsed: () => number) => {
    if (!faceRef.current || !poseRef.current) return;

    let lastFaceMs = 0;
    let lastPoseMs = 0;
    const FACE_INTERVAL = 300;
    const POSE_INTERVAL = 500;

    const loop = () => {
      if (video.readyState < 2) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const now = performance.now();
      const elapsed = getElapsed();

      if (now - lastFaceMs >= FACE_INTERVAL && faceRef.current) {
        const faceResult: FaceLandmarkerResult = faceRef.current.detectForVideo(video, now);
        analyzeGaze(faceResult, elapsed);
        analyzeExpression(faceResult, elapsed);
        lastFaceMs = now;
      }

      if (now - lastPoseMs >= POSE_INTERVAL && poseRef.current) {
        const poseResult: PoseLandmarkerResult = poseRef.current.detectForVideo(video, now);
        analyzeMovement(poseResult, elapsed);
        lastPoseMs = now;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
  }, [analyzeGaze, analyzeExpression, analyzeMovement]);

  const stopAnalysis = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    expressionBuffer.current = [];
    movementBuffer.current = [];
    prevShoulderRef.current = null;
    noFaceFrames.current = 0;
  }, []);

  return { isReady, isLoading, currentWarning, warnings, startAnalysis, stopAnalysis };
}
