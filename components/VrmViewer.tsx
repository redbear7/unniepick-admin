'use client';

/**
 * VrmViewer — Three.js + @pixiv/three-vrm 기반 3D 캐릭터 뷰어
 * - SSR 없이 클라이언트 전용 동작
 * - 아이들 애니메이션: 눈깜빡임, 호흡(가슴 상하)
 * - 립싱크: audioAnalyser ref를 통해 외부에서 진폭 전달
 */

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

export interface VrmViewerHandle {
  /** Web Audio AnalyserNode 연결 — 립싱크 구동 */
  connectAnalyser: (analyser: AnalyserNode) => void;
  /** 말하기 종료 시 입 초기화 */
  stopSpeaking: () => void;
}

interface Props {
  modelUrl: string;
  width?: number;
  height?: number;
  className?: string;
}

const VrmViewer = forwardRef<VrmViewerHandle, Props>(
  ({ modelUrl, width = 200, height = 280, className }, ref) => {
    const canvasRef   = useRef<HTMLCanvasElement>(null);
    const vrmRef      = useRef<any>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const freqDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
    const rafRef      = useRef<number>(0);

    useImperativeHandle(ref, () => ({
      connectAnalyser(analyser: AnalyserNode) {
        analyserRef.current = analyser;
        freqDataRef.current = new Uint8Array(analyser.frequencyBinCount);
      },
      stopSpeaking() {
        analyserRef.current = null;
        freqDataRef.current = null;
        if (vrmRef.current) {
          vrmRef.current.expressionManager?.setValue('aa', 0);
        }
      },
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      let disposed = false;

      (async () => {
        // Three.js / VRM — 동적 임포트 (SSR 회피)
        const THREE  = await import('three');
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        const { VRMLoaderPlugin, VRMUtils } = await import('@pixiv/three-vrm');

        // ── 씬 ──────────────────────────────────────────────────
        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(width, height);
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        const scene  = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 20);
        camera.position.set(0, 1.35, 2.2);

        // 조명
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        const dir     = new THREE.DirectionalLight(0xffffff, 1.2);
        dir.position.set(1, 2, 2);
        scene.add(ambient, dir);

        // ── VRM 로드 ────────────────────────────────────────────
        const loader = new GLTFLoader();
        loader.register(parser => new VRMLoaderPlugin(parser));

        let vrm: any = null;
        try {
          const gltf = await loader.loadAsync(modelUrl);
          vrm = gltf.userData.vrm;
          VRMUtils.rotateVRM0(vrm); // VRM0 좌우 반전 보정
          scene.add(vrm.scene);
          vrmRef.current = vrm;
        } catch (e) {
          console.warn('[VrmViewer] 모델 로드 실패:', e);
          renderer.dispose();
          return;
        }

        if (disposed) { renderer.dispose(); return; }

        // ── 아이들 애니메이션 상태 ───────────────────────────────
        let blinkTimer  = 0;
        let blinkState  = 0;   // 0=open 1=closing 2=opening
        let breathPhase = 0;

        const clock = new THREE.Clock();

        // ── 렌더 루프 ────────────────────────────────────────────
        const tick = () => {
          if (disposed) return;
          rafRef.current = requestAnimationFrame(tick);

          const dt = clock.getDelta();
          if (!vrm) return;

          vrm.update(dt);

          // 호흡 (chest bone Y 오프셋)
          breathPhase += dt * 0.8;
          const breathVal = Math.sin(breathPhase) * 0.004;
          const chest = vrm.humanoid?.getNormalizedBoneNode('chest');
          if (chest) chest.position.y = breathVal;

          // 눈깜빡임
          blinkTimer -= dt;
          if (blinkState === 0 && blinkTimer <= 0) {
            blinkState = 1;
            blinkTimer = 0.08;
          } else if (blinkState === 1) {
            vrm.expressionManager?.setValue('blink', Math.min(1, (0.08 - blinkTimer) / 0.08));
            if (blinkTimer <= 0) { blinkState = 2; blinkTimer = 0.1; }
          } else if (blinkState === 2) {
            vrm.expressionManager?.setValue('blink', Math.max(0, blinkTimer / 0.1));
            if (blinkTimer <= 0) {
              blinkState = 0;
              blinkTimer = 2.5 + Math.random() * 2.5;
              vrm.expressionManager?.setValue('blink', 0);
            }
          }

          // 립싱크
          if (analyserRef.current && freqDataRef.current) {
            analyserRef.current.getByteFrequencyData(freqDataRef.current);
            // 저주파 평균으로 입 모양 계산
            const slice = freqDataRef.current.slice(0, 12);
            const avg   = slice.reduce((s, v) => s + v, 0) / slice.length;
            const mouth = Math.min(1, avg / 110);
            vrm.expressionManager?.setValue('aa', mouth);
          }

          renderer.render(scene, camera);
        };

        blinkTimer = 1 + Math.random() * 2;
        tick();
      })();

      return () => {
        disposed = true;
        cancelAnimationFrame(rafRef.current);
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [modelUrl]);

    return (
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={className}
        style={{ display: 'block' }}
      />
    );
  },
);

VrmViewer.displayName = 'VrmViewer';
export default VrmViewer;
