import * as ort from "onnxruntime-web";
// Use vladmandic fork of face-api
// @ts-ignore
import * as faceapi from "@vladmandic/face-api";

/* ====================================================================
 * 1) ONNX Runtime and face-api.js Initialization
 * ==================================================================== */

let faceApiReady: boolean = false;

// Existing model sessions
let arcSession: ort.InferenceSession | null = null;
let gaSession: ort.InferenceSession | null = null;
let rppgSession: ort.InferenceSession | null = null;
let unified209Session: ort.InferenceSession | null = null;

// NEW: Digital Human / SadTalker model sessions
let sadtalkerExpressionSession: ort.InferenceSession | null = null;
let sadtalkerMotionSession: ort.InferenceSession | null = null;
let sadtalkerLipsyncSession: ort.InferenceSession | null = null;
let sadtalkerFaceGenSession: ort.InferenceSession | null = null;

// NEW: XTTS Voice model sessions
let xttsSpeakerEncoderSession: ort.InferenceSession | null = null;
let xttsVoiceSession: ort.InferenceSession | null = null;

async function setupOrt(): Promise<void> {
  const crossIso = (globalThis as any).crossOriginIsolated === true;
  const env: any = ort.env;
  env.wasm.simd = true;

  if (crossIso) {
    env.wasm.numThreads = Math.max(2, navigator.hardwareConcurrency || 4);
    env.wasm.proxy = true;
  } else {
    env.wasm.numThreads = 1;
    env.wasm.proxy = false;
    console.warn(
      "[onnxruntime-web] Not crossOriginIsolated. Using single-thread WASM (no SAB)."
    );
  }
}

async function initFaceAPI(): Promise<void> {
  if (faceApiReady) return;

  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
    faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
    faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
    faceapi.nets.faceExpressionNet.loadFromUri("/models"),
  ]);

  faceApiReady = true;
  console.log("✅ @vladmandic/face-api models loaded (including landmarks for alignment)");
}

export async function initOnnx(): Promise<void> {
  await setupOrt();
  await initFaceAPI();

  // ============ Existing Models ============
  if (!arcSession) {
    arcSession = await ort.InferenceSession.create(
      "/models/arcfaceresnet100-11-int8.onnx",
      { executionProviders: ["wasm"] }
    );
    console.log("✅ ArcFace model loaded");
  }

  if (!gaSession) {
    gaSession = await ort.InferenceSession.create("/models/genderage.onnx", {
      executionProviders: ["wasm"],
    });
    console.log("✅ Gender/Age model loaded");
  }

  if (!rppgSession) {
    try {
      rppgSession = await ort.InferenceSession.create("/models/rppg_model.onnx", {
        executionProviders: ["wasm"],
      });
      console.log("✅ rPPG model loaded successfully");
    } catch (error) {
      console.warn(
        "⚠️ rPPG model failed to load. Camera vitals will use simulated values:",
        error
      );
      rppgSession = null;
    }
  }

  if (!unified209Session) {
    try {
      unified209Session = await ort.InferenceSession.create(
        "/models/unified_209_parameters_web.onnx",
        { executionProviders: ["wasm"] }
      );
      console.log("✅ Unified 209-parameters model loaded successfully");
    } catch (error) {
      console.warn(
        "⚠️ Unified 209-parameters model failed to load:",
        error
      );
      unified209Session = null;
    }
  }

  // ============ Digital Human / SadTalker Models ============
  await initDigitalHumanModels();

  console.log("✅ All ONNX models initialized");
}

/**
 * Initialize Digital Human (SadTalker + XTTS) models separately
 * Can be called independently if you only need digital human features
 */
export async function initDigitalHumanModels(): Promise<void> {
  await setupOrt();

  // SadTalker Expression Model (Audio → Facial Expressions)
  if (!sadtalkerExpressionSession) {
    try {
      // Try optimized version first, fallback to regular
      sadtalkerExpressionSession = await ort.InferenceSession.create(
        "/models/sadtalker_expression_optimized.onnx",
        { executionProviders: ["wasm"] }
      );
      console.log("✅ SadTalker Expression model loaded (optimized)");
    } catch {
      try {
        sadtalkerExpressionSession = await ort.InferenceSession.create(
          "/models/sadtalker_expression.onnx",
          { executionProviders: ["wasm"] }
        );
        console.log("✅ SadTalker Expression model loaded");
      } catch (error) {
        console.warn("⚠️ SadTalker Expression model failed to load:", error);
      }
    }
  }

  // SadTalker Motion Model (Audio → Head Pose/Motion)
  if (!sadtalkerMotionSession) {
    try {
      sadtalkerMotionSession = await ort.InferenceSession.create(
        "/models/sadtalker_motion_optimized.onnx",
        { executionProviders: ["wasm"] }
      );
      console.log("✅ SadTalker Motion model loaded (optimized)");
    } catch {
      try {
        sadtalkerMotionSession = await ort.InferenceSession.create(
          "/models/sadtalker_motion.onnx",
          { executionProviders: ["wasm"] }
        );
        console.log("✅ SadTalker Motion model loaded");
      } catch (error) {
        console.warn("⚠️ SadTalker Motion model failed to load:", error);
      }
    }
  }

  // SadTalker Lipsync Model (Mel Spectrogram → Lip Coefficients)
  if (!sadtalkerLipsyncSession) {
    try {
      sadtalkerLipsyncSession = await ort.InferenceSession.create(
        "/models/sadtalker_lipsync_optimized.onnx",
        { executionProviders: ["wasm"] }
      );
      console.log("✅ SadTalker Lipsync model loaded (optimized)");
    } catch {
      try {
        sadtalkerLipsyncSession = await ort.InferenceSession.create(
          "/models/sadtalker_lipsync.onnx",
          { executionProviders: ["wasm"] }
        );
        console.log("✅ SadTalker Lipsync model loaded");
      } catch (error) {
        console.warn("⚠️ SadTalker Lipsync model failed to load:", error);
      }
    }
  }

  // SadTalker Face Generator Model (Expression + Pose → Face)
  if (!sadtalkerFaceGenSession) {
    try {
      sadtalkerFaceGenSession = await ort.InferenceSession.create(
        "/models/sadtalker_face_generator_optimized.onnx",
        { executionProviders: ["wasm"] }
      );
      console.log("✅ SadTalker Face Generator model loaded (optimized)");
    } catch {
      try {
        sadtalkerFaceGenSession = await ort.InferenceSession.create(
          "/models/sadtalker_face_generator.onnx",
          { executionProviders: ["wasm"] }
        );
        console.log("✅ SadTalker Face Generator model loaded");
      } catch (error) {
        console.warn("⚠️ SadTalker Face Generator model failed to load:", error);
      }
    }
  }

  // XTTS Speaker Encoder (Mel Spectrogram → Speaker Embedding)
  if (!xttsSpeakerEncoderSession) {
    try {
      xttsSpeakerEncoderSession = await ort.InferenceSession.create(
        "/models/xtts_speaker_encoder_optimized.onnx",
        { executionProviders: ["wasm"] }
      );
      console.log("✅ XTTS Speaker Encoder model loaded (optimized)");
    } catch {
      try {
        xttsSpeakerEncoderSession = await ort.InferenceSession.create(
          "/models/xtts_speaker_encoder.onnx",
          { executionProviders: ["wasm"] }
        );
        console.log("✅ XTTS Speaker Encoder model loaded");
      } catch (error) {
        console.warn("⚠️ XTTS Speaker Encoder model failed to load:", error);
      }
    }
  }

  // XTTS Voice Model (Text + Speaker Embedding → Mel Spectrogram)
  if (!xttsVoiceSession) {
    try {
      xttsVoiceSession = await ort.InferenceSession.create(
        "/models/xtts_voice_optimized.onnx",
        { executionProviders: ["wasm"] }
      );
      console.log("✅ XTTS Voice model loaded (optimized)");
    } catch {
      try {
        xttsVoiceSession = await ort.InferenceSession.create(
          "/models/xtts_voice.onnx",
          { executionProviders: ["wasm"] }
        );
        console.log("✅ XTTS Voice model loaded");
      } catch (error) {
        console.warn("⚠️ XTTS Voice model failed to load:", error);
      }
    }
  }
}

/**
 * Check which digital human models are loaded
 */
export function getDigitalHumanStatus(): Record<string, boolean> {
  return {
    sadtalkerExpression: sadtalkerExpressionSession !== null,
    sadtalkerMotion: sadtalkerMotionSession !== null,
    sadtalkerLipsync: sadtalkerLipsyncSession !== null,
    sadtalkerFaceGen: sadtalkerFaceGenSession !== null,
    xttsSpeakerEncoder: xttsSpeakerEncoderSession !== null,
    xttsVoice: xttsVoiceSession !== null,
  };
}

/* ====================================================================
 * 2) Canvas & Image Data Helpers (Face Alignment)
 * ==================================================================== */

/**
 * Uses face-api.js to detect, align (rotate/center), and extract the face region
 * from an image/video element into a precise 112x112 ImageData.
 */
export async function getAlignedFaceData(
  el: HTMLImageElement | HTMLVideoElement
): Promise<ImageData | null> {
  if (!faceApiReady) await initFaceAPI();

  const fullFaceDetection = await faceapi
    .detectSingleFace(el, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks();

  if (!fullFaceDetection) return null;

  const alignedImage = await faceapi.extractFaces(el, [fullFaceDetection.detection]);

  if (!alignedImage || alignedImage.length === 0) return null;

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = 112;
  outputCanvas.height = 112;
  const outputCtx = outputCanvas.getContext("2d")!;

  outputCtx.drawImage(alignedImage[0] as HTMLCanvasElement, 0, 0, 112, 112);

  return outputCtx.getImageData(0, 0, 112, 112);
}

export function imageDataFromElement(
  el: HTMLImageElement | HTMLVideoElement
): ImageData {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  const width = el instanceof HTMLVideoElement ? el.videoWidth : el.width;
  const height = el instanceof HTMLVideoElement ? el.videoHeight : el.height;

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(el, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

export function cropAndResizeTo112(
  img: HTMLImageElement | HTMLVideoElement | ImageData
): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = 112;
  canvas.height = 112;
  const ctx = canvas.getContext("2d")!;

  if (img instanceof ImageData) {
    const tmp = document.createElement("canvas");
    tmp.width = img.width;
    tmp.height = img.height;
    tmp.getContext("2d")!.putImageData(img, 0, 0);
    ctx.drawImage(tmp, 0, 0, 112, 112);
  } else {
    const width = img instanceof HTMLVideoElement ? img.videoWidth : img.width;
    const height = img instanceof HTMLVideoElement ? img.videoHeight : img.height;
    ctx.drawImage(img, 0, 0, width, height, 0, 0, 112, 112);
  }
  return ctx.getImageData(0, 0, 112, 112);
}

/* ====================================================================
 * 3) Tensors, Math, and Embedding Helpers
 * ==================================================================== */

function toTensorNCHW(imgData: ImageData, size: number): ort.Tensor {
  const chw = new Float32Array(3 * size * size);
  const { data, width, height } = imgData;

  if (width !== size || height !== size) {
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    c.getContext("2d")!.putImageData(imgData, 0, 0);
    const resized = c.getContext("2d")!.getImageData(0, 0, size, size);
    return toTensorNCHW(resized, size);
  }

  let p = 0;
  const channelSize = size * size;
  for (let i = 0; i < channelSize; i++) {
    const r = data[p] / 255;
    const g = data[p + 1] / 255;
    const b = data[p + 2] / 255;
    p += 4;
    chw[i] = r;
    chw[i + channelSize] = g;
    chw[i + 2 * channelSize] = b;
  }
  return new ort.Tensor("float32", chw, [1, 3, size, size]);
}

function toTensorNHWC(imgData: ImageData, size: number): ort.Tensor {
  const hwc = new Float32Array(size * size * 3);
  const { data, width, height } = imgData;

  if (width !== size || height !== size) {
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    c.getContext("2d")!.putImageData(imgData, 0, 0);
    const resized = c.getContext("2d")!.getImageData(0, 0, size, size);
    return toTensorNHWC(resized, size);
  }

  let j = 0;
  for (let i = 0; i < data.length; i += 4) {
    hwc[j++] = data[i] / 255;
    hwc[j++] = data[i + 1] / 255;
    hwc[j++] = data[i + 2] / 255;
  }
  return new ort.Tensor("float32", hwc, [1, size, size, 3]);
}

/** Calculates the cosine similarity between two Float32Array vectors. */
export function cosineSim(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denominator = Math.sqrt(na) * Math.sqrt(nb);
  return denominator === 0 ? 0 : dot / denominator;
}

/** Performs L2 (Euclidean) normalization on a vector. */
function l2normalize(v: Float32Array): Float32Array {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  s = Math.max(1e-12, Math.sqrt(s));
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / s;
  return out;
}

/** Computes the element-wise average of an array of Float32Array embeddings. */
export function averageEmbeddings(embeddings: Float32Array[]): Float32Array {
  if (embeddings.length === 0) {
    return new Float32Array(0);
  }

  const dim = embeddings[0].length;
  const avg = new Float32Array(dim).fill(0);
  const N = embeddings.length;

  for (const emb of embeddings) {
    if (emb.length !== dim) {
      console.warn("Embeddings must have uniform dimension.");
      continue;
    }
    for (let i = 0; i < dim; i++) {
      avg[i] += emb[i];
    }
  }

  for (let i = 0; i < dim; i++) {
    avg[i] /= N;
  }

  return l2normalize(avg);
}

/** ArcFace ONNX embedding (512-D). Input is now guaranteed to be aligned 112x112. */
export async function runArcfaceEmbedding(img112: ImageData): Promise<Float32Array> {
  if (!arcSession) throw new Error("ArcFace session not initialized");
  if (img112.width !== 112 || img112.height !== 112) {
    throw new Error("Input to runArcfaceEmbedding must be 112x112 aligned image data.");
  }
  const input = toTensorNCHW(img112, 112);
  const out = await arcSession.run({ data: input });
  const emb = out["fc1"].data as Float32Array;
  return l2normalize(emb);
}

/** face-api.js embeddings (128-D) */
export async function getFaceEmbedding(
  el: HTMLImageElement | HTMLVideoElement
): Promise<Float32Array | null> {
  if (!faceApiReady) await initFaceAPI();
  const det = await faceapi
    .detectSingleFace(el, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!det) return null;
  return new Float32Array(det.descriptor);
}

/* ====================================================================
 * 4) High-level Face Verification (Core Logic)
 * ==================================================================== */

interface VerifyResult {
  recognized: boolean;
  similarity: number;
  path: "face-api" | "arcface" | "matcher";
}

export async function verifyFace(
  refEl: HTMLImageElement,
  liveEl: HTMLVideoElement,
  threshold: number = 0.75
): Promise<VerifyResult> {
  try {
    const refImgData = imageDataFromElement(refEl);
    const liveImgData = imageDataFromElement(liveEl);
    const refCrop = cropAndResizeTo112(refImgData);
    const liveCrop = cropAndResizeTo112(liveImgData);

    const refArc = await runArcfaceEmbedding(refCrop);
    const liveArc = await runArcfaceEmbedding(liveCrop);

    const sim = cosineSim(refArc, liveArc);

    return { recognized: sim >= threshold, similarity: sim, path: "arcface" };
  } catch (error) {
    console.error("ArcFace Verification Failed:", error);
    return { recognized: false, similarity: 0, path: "arcface" };
  }
}

export async function verifyFaceWithMatcher(
  refEl: HTMLImageElement,
  liveEl: HTMLVideoElement,
  distanceThreshold: number = 0.6
): Promise<VerifyResult> {
  const refEmb = await getFaceEmbedding(refEl);
  const liveEmb = await getFaceEmbedding(liveEl);

  if (!refEmb || !liveEmb) {
    return { recognized: false, similarity: 0, path: "matcher" };
  }

  const refDescriptor = new faceapi.LabeledFaceDescriptors("ReferenceFace", [refEmb]);
  const faceMatcher = new faceapi.FaceMatcher([refDescriptor], distanceThreshold);
  const match = faceMatcher.findBestMatch(liveEmb);

  const recognized = match.distance < distanceThreshold;
  const similarity = 1 - match.distance;

  return { recognized, similarity: similarity, path: "matcher" };
}

/* ====================================================================
 * 5) Secondary Features (Gender/Age, Camera Vitals, 209-Param Model)
 * ==================================================================== */

interface GenderAgeResult {
  gender: "male" | "female";
  age: number;
}

export async function getGenderAge(img96: ImageData): Promise<GenderAgeResult> {
  if (!gaSession) throw new Error("GenderAge session not initialized");
  const input = toTensorNCHW(img96, 96);
  const out = await gaSession.run({ data: input });
  const arr = out["fc1"].data as Float32Array;

  const maleProb = arr[0] ?? 0.5;
  const femaleProb = arr[1] ?? 0.5;
  const ageFrac = arr[2] ?? 0.3;

  const gender: "male" | "female" = maleProb > femaleProb ? "male" : "female";
  const age = Math.round(Math.max(0, Math.min(100, ageFrac * 100)));
  return { gender, age };
}

export interface VitalsResult {
  hr_bpm: number;
  rmssd_ms: number;
  sdnn_ms: number;
}

export async function getVitals(frames: ImageData[]): Promise<VitalsResult> {
  if (!rppgSession) {
    console.warn("rPPG model not available, using simulated vitals");
    return {
      hr_bpm: 70 + Math.random() * 10,
      rmssd_ms: 35 + Math.random() * 15,
      sdnn_ms: 55 + Math.random() * 15,
    };
  }

  if (frames.length < 2) throw new Error("Need at least 2 frames for rPPG");

  try {
    const f1 = toTensorNHWC(frames[0], 36);
    const f2 = toTensorNHWC(frames[1], 36);

    const out = await rppgSession.run({ input_1: f1, input_2: f2 });
    const raw = (out["dense_1"].data as Float32Array)[0] ?? 0.0;

    const hr_bpm = 60 + raw * 20;
    const rmssd_ms = Math.abs(raw) * 30;
    const sdnn_ms = Math.abs(raw) * 50;

    return { hr_bpm, rmssd_ms, sdnn_ms };
  } catch (error) {
    console.error("rPPG model error, falling back to simulated values:", error);
    return {
      hr_bpm: 70 + Math.random() * 10,
      rmssd_ms: 35 + Math.random() * 15,
      sdnn_ms: 55 + Math.random() * 15,
    };
  }
}

/* ---------- Unified 209-Parameters Model ---------- */

export interface Unified209Inputs {
  heart_rate: number;
  respiratory_rate: number;
  sbp: number;
  dbp: number;
  spo2: number;
  glucose: number;
  age: number;
  gender_code: number;
  height_cm: number;
  weight_kg: number;
  std_interval: number;
  vlf_power: number;
  lf_power: number;
  hf_power: number;
}

export type Unified209Outputs = Record<string, number>;

export async function runUnified209(
  inputs: Unified209Inputs
): Promise<Unified209Outputs> {
  if (!unified209Session) {
    throw new Error("Unified 209-parameters session not initialized");
  }

  const makeScalar = (v: number) =>
    new ort.Tensor("float32", new Float32Array([v]), [1]);

  const feeds: Record<string, ort.Tensor> = {
    heart_rate: makeScalar(inputs.heart_rate),
    respiratory_rate: makeScalar(inputs.respiratory_rate),
    sbp: makeScalar(inputs.sbp),
    dbp: makeScalar(inputs.dbp),
    spo2: makeScalar(inputs.spo2),
    glucose: makeScalar(inputs.glucose),
    age: makeScalar(inputs.age),
    gender_code: makeScalar(inputs.gender_code),
    height_cm: makeScalar(inputs.height_cm),
    weight_kg: makeScalar(inputs.weight_kg),
    std_interval: makeScalar(inputs.std_interval),
    vlf_power: makeScalar(inputs.vlf_power),
    lf_power: makeScalar(inputs.lf_power),
    hf_power: makeScalar(inputs.hf_power),
  };

  const outMap = await unified209Session.run(feeds);
  const result: Unified209Outputs = {};

  for (const [name, tensor] of Object.entries(outMap)) {
    const data = tensor.data as Float32Array | number[];
    result[name] = (data as any)[0] ?? 0;
  }

  return result;
}

/* ====================================================================
 * 6) Digital Human Pipeline - SadTalker + XTTS Models
 * ==================================================================== */

/**
 * SadTalker Expression Prediction
 * Input: Audio features [1, 512]
 * Output: Expression coefficients [1, 64]
 */
export interface ExpressionResult {
  coefficients: Float32Array;
}

export async function predictExpression(
  audioFeatures: Float32Array
): Promise<ExpressionResult> {
  if (!sadtalkerExpressionSession) {
    throw new Error("SadTalker Expression model not initialized");
  }

  const input = new ort.Tensor("float32", audioFeatures, [1, 512]);
  const out = await sadtalkerExpressionSession.run({ audio_features: input });
  const coefficients = out["expression_coefficients"].data as Float32Array;

  return { coefficients };
}

/**
 * SadTalker Motion/Pose Prediction
 * Input: Audio features [1, 512]
 * Output: Head pose [1, 6] (rotation xyz + translation xyz)
 */
export interface MotionResult {
  pose: Float32Array; // [yaw, pitch, roll, tx, ty, tz]
}

export async function predictMotion(
  audioFeatures: Float32Array
): Promise<MotionResult> {
  if (!sadtalkerMotionSession) {
    throw new Error("SadTalker Motion model not initialized");
  }

  const input = new ort.Tensor("float32", audioFeatures, [1, 512]);
  const out = await sadtalkerMotionSession.run({ audio_features: input });
  const pose = out["head_pose"].data as Float32Array;

  return { pose };
}

/**
 * SadTalker Lipsync Prediction
 * Input: Mel spectrogram [1, 80, T]
 * Output: Lip coefficients [1, 20]
 */
export interface LipsyncResult {
  lipCoefficients: Float32Array;
}

export async function predictLipsync(
  melSpectrogram: Float32Array,
  timeFrames: number
): Promise<LipsyncResult> {
  if (!sadtalkerLipsyncSession) {
    throw new Error("SadTalker Lipsync model not initialized");
  }

  const input = new ort.Tensor("float32", melSpectrogram, [1, 80, timeFrames]);
  const out = await sadtalkerLipsyncSession.run({ mel_spectrogram: input });
  const lipCoefficients = out["lip_coefficients"].data as Float32Array;

  return { lipCoefficients };
}

/**
 * SadTalker Face Generation
 * Input: Expression coefficients [1, 64] + Pose [1, 6]
 * Output: Generated face [1, 3, 256, 256]
 */
export interface FaceGenResult {
  faceImage: Float32Array; // Raw tensor data
  width: number;
  height: number;
}

export async function generateFace(
  expression: Float32Array,
  pose: Float32Array
): Promise<FaceGenResult> {
  if (!sadtalkerFaceGenSession) {
    throw new Error("SadTalker Face Generator model not initialized");
  }

  const expressionTensor = new ort.Tensor("float32", expression, [1, 64]);
  const poseTensor = new ort.Tensor("float32", pose, [1, 6]);

  const out = await sadtalkerFaceGenSession.run({
    expression: expressionTensor,
    pose: poseTensor,
  });

  const faceImage = out["generated_face"].data as Float32Array;

  return {
    faceImage,
    width: 256,
    height: 256,
  };
}

/**
 * Convert Face Generator output tensor to ImageData
 */
export function faceGenTensorToImageData(result: FaceGenResult): ImageData {
  const { faceImage, width, height } = result;
  const imageData = new ImageData(width, height);
  const data = imageData.data;

  // Tensor is [1, 3, H, W] in range [-1, 1]
  const channelSize = width * height;

  for (let i = 0; i < channelSize; i++) {
    const r = ((faceImage[i] + 1) / 2) * 255;
    const g = ((faceImage[i + channelSize] + 1) / 2) * 255;
    const b = ((faceImage[i + 2 * channelSize] + 1) / 2) * 255;

    const pixelIndex = i * 4;
    data[pixelIndex] = Math.max(0, Math.min(255, r));
    data[pixelIndex + 1] = Math.max(0, Math.min(255, g));
    data[pixelIndex + 2] = Math.max(0, Math.min(255, b));
    data[pixelIndex + 3] = 255;
  }

  return imageData;
}

/**
 * XTTS Speaker Encoder
 * Input: Mel spectrogram [1, 80, T]
 * Output: Speaker embedding [1, 512]
 */
export interface SpeakerEmbeddingResult {
  embedding: Float32Array;
}

export async function extractSpeakerEmbedding(
  melSpectrogram: Float32Array,
  timeFrames: number
): Promise<SpeakerEmbeddingResult> {
  if (!xttsSpeakerEncoderSession) {
    throw new Error("XTTS Speaker Encoder model not initialized");
  }

  const input = new ort.Tensor("float32", melSpectrogram, [1, 80, timeFrames]);
  const out = await xttsSpeakerEncoderSession.run({ mel_spectrogram: input });
  const embedding = out["speaker_embedding"].data as Float32Array;

  return { embedding: l2normalize(embedding) };
}

/**
 * XTTS Voice Synthesis (Text Embedding + Speaker → Mel)
 * Input: Text embedding [1, seq_len, 256] + Speaker embedding [1, 512]
 * Output: Mel spectrogram [1, seq_len, 80]
 */
export interface VoiceSynthResult {
  melSpectrogram: Float32Array;
  seqLen: number;
}

export async function synthesizeVoice(
  textEmbedding: Float32Array,
  seqLen: number,
  speakerEmbedding: Float32Array
): Promise<VoiceSynthResult> {
  if (!xttsVoiceSession) {
    throw new Error("XTTS Voice model not initialized");
  }

  const textTensor = new ort.Tensor("float32", textEmbedding, [1, seqLen, 256]);
  const speakerTensor = new ort.Tensor("float32", speakerEmbedding, [1, 512]);

  const out = await xttsVoiceSession.run({
    text_embedding: textTensor,
    speaker_embedding: speakerTensor,
  });

  const melSpectrogram = out["mel_spectrogram"].data as Float32Array;

  return {
    melSpectrogram,
    seqLen,
  };
}

/* ====================================================================
 * 6.1) Audio Processing Utilities for Digital Human
 * ==================================================================== */

/**
 * Compute simple mel spectrogram from audio samples
 * This is a simplified version - for production use Web Audio API or a library
 */
export function computeMelSpectrogram(
  audioSamples: Float32Array,
  _sampleRate: number = 16000,
  nMels: number = 80,
  nFft: number = 1024,
  hopLength: number = 256
): { mel: Float32Array; timeFrames: number } {
  const numFrames = Math.floor((audioSamples.length - nFft) / hopLength) + 1;
  const mel = new Float32Array(nMels * numFrames);

  // Simple mel bank computation (approximation)
  for (let frame = 0; frame < numFrames; frame++) {
    const start = frame * hopLength;
    const frameData = audioSamples.slice(start, start + nFft);

    // Compute power spectrum (simplified)
    for (let m = 0; m < nMels; m++) {
      let sum = 0;
      for (let i = 0; i < Math.min(frameData.length, 100); i++) {
        sum += frameData[i] * frameData[i];
      }
      // Log mel (simplified)
      mel[m * numFrames + frame] = Math.log(Math.max(1e-10, sum / 100));
    }
  }

  // Normalize
  let min = Infinity,
    max = -Infinity;
  for (let i = 0; i < mel.length; i++) {
    if (mel[i] < min) min = mel[i];
    if (mel[i] > max) max = mel[i];
  }
  const range = max - min || 1;
  for (let i = 0; i < mel.length; i++) {
    mel[i] = (mel[i] - min) / range;
  }

  return { mel, timeFrames: numFrames };
}

/**
 * Extract audio features from mel spectrogram
 * Returns [1, 512] feature vector for expression/motion models
 */
export function extractAudioFeatures(
  melSpectrogram: Float32Array,
  timeFrames: number
): Float32Array {
  const features = new Float32Array(512);

  // Simple averaging over time and frequency bands
  const nMels = 80;

  for (let f = 0; f < 512; f++) {
    const melBand = f % nMels;
    let sum = 0;
    let count = 0;

    for (let t = 0; t < timeFrames; t++) {
      sum += melSpectrogram[melBand * timeFrames + t];
      count++;
    }

    features[f] = count > 0 ? sum / count : 0;
  }

  return features;
}

/* ====================================================================
 * 6.2) Complete Digital Human Pipeline
 * ==================================================================== */

export interface DigitalHumanFrame {
  imageData: ImageData;
  expression: Float32Array;
  pose: Float32Array;
  lipCoefficients: Float32Array;
  timestamp: number;
}

export interface DigitalHumanPipelineOptions {
  fps?: number;
  expressionScale?: number;
  poseScale?: number;
}

/**
 * Complete Digital Human Pipeline
 * Takes audio and generates animated face frames
 */
export class DigitalHumanPipeline {
  private options: Required<DigitalHumanPipelineOptions>;
  private speakerEmbedding: Float32Array | null = null;

  constructor(options: DigitalHumanPipelineOptions = {}) {
    this.options = {
      fps: options.fps ?? 25,
      expressionScale: options.expressionScale ?? 1.0,
      poseScale: options.poseScale ?? 1.0,
    };
  }

  /**
   * Initialize pipeline with reference voice for voice cloning
   */
  async initWithVoice(referenceAudio: Float32Array, sampleRate: number = 16000): Promise<void> {
    const { mel, timeFrames } = computeMelSpectrogram(referenceAudio, sampleRate);
    const { embedding } = await extractSpeakerEmbedding(mel, timeFrames);
    this.speakerEmbedding = embedding;
    console.log("✅ Speaker embedding extracted for voice cloning");
  }

  /**
   * Generate frames from audio
   */
  async generateFrames(
    audioSamples: Float32Array,
    sampleRate: number = 16000
  ): Promise<DigitalHumanFrame[]> {
    const { mel, timeFrames } = computeMelSpectrogram(audioSamples, sampleRate);


    const durationSec = audioSamples.length / sampleRate;
    const numFrames = Math.floor(durationSec * this.options.fps);
    const frames: DigitalHumanFrame[] = [];

    const framesPerMelSegment = Math.max(1, Math.floor(timeFrames / numFrames));

    for (let i = 0; i < numFrames; i++) {
      const timestamp = i / this.options.fps;

      // Get mel segment for this frame
      const melStart = Math.floor((i / numFrames) * timeFrames);
      const melEnd = Math.min(melStart + framesPerMelSegment, timeFrames);
      const segmentLength = melEnd - melStart;

      // Extract segment
      const melSegment = new Float32Array(80 * segmentLength);
      for (let m = 0; m < 80; m++) {
        for (let t = 0; t < segmentLength; t++) {
          melSegment[m * segmentLength + t] = mel[m * timeFrames + melStart + t];
        }
      }

      // Predict lipsync
      let lipCoefficients: Float32Array;
      try {
        const lipsync = await predictLipsync(melSegment, segmentLength);
        lipCoefficients = lipsync.lipCoefficients;
      } catch {
        lipCoefficients = new Float32Array(20).fill(0);
      }

      // Extract audio features for this segment
      const segmentFeatures = extractAudioFeatures(melSegment, segmentLength);

      // Predict expression
      let expression: Float32Array;
      try {
        const expResult = await predictExpression(segmentFeatures);
        expression = expResult.coefficients;
        // Scale expression
        for (let j = 0; j < expression.length; j++) {
          expression[j] *= this.options.expressionScale;
        }
      } catch {
        expression = new Float32Array(64).fill(0);
      }

      // Predict motion/pose
      let pose: Float32Array;
      try {
        const motionResult = await predictMotion(segmentFeatures);
        pose = motionResult.pose;
        // Scale pose
        for (let j = 0; j < pose.length; j++) {
          pose[j] *= this.options.poseScale;
        }
      } catch {
        pose = new Float32Array(6).fill(0);
      }

      // Generate face
      let imageData: ImageData;
      try {
        const faceResult = await generateFace(expression, pose);
        imageData = faceGenTensorToImageData(faceResult);
      } catch {
        // Return empty frame on error
        imageData = new ImageData(256, 256);
      }

      frames.push({
        imageData,
        expression,
        pose,
        lipCoefficients,
        timestamp,
      });
    }

    return frames;
  }

  /**
   * Get current speaker embedding
   */
  getSpeakerEmbedding(): Float32Array | null {
    return this.speakerEmbedding;
  }

  /**
   * Compare speaker embeddings for voice verification
   */
  compareSpeakers(embedding1: Float32Array, embedding2: Float32Array): number {
    return cosineSim(embedding1, embedding2);
  }
}

/* ====================================================================
 * 7) Personality Scoring (Improved, keyword-driven, 0..20 deltas)
 * ==================================================================== */

type OceanScores = {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
};

type Pf16Scores = {
  Warmth: number;
  Reasoning: number;
  EmotionalStability: number;
  Dominance: number;
  Liveliness: number;
  RuleConsciousness: number;
  SocialBoldness: number;
  Sensitivity: number;
  Vigilance: number;
  Abstractedness: number;
  Privateness: number;
  Apprehension: number;
  OpennessToChange: number;
  SelfReliance: number;
  Perfectionism: number;
  Tension: number;
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const countHits = (text: string, phrases: string[]) => {
  let c = 0;
  for (const p of phrases) {
    const re = new RegExp(
      `\\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "g"
    );
    c += (text.match(re) || []).length;
  }
  return c;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const scaleDelta = (z: number, maxDelta = 20) =>
  Math.round(clamp01(z) * maxDelta);

const OCEAN_LEX: Record<keyof OceanScores, { pos: string[]; neg: string[] }> = {
  openness: {
    pos: [
      "curious",
      "curiosity",
      "creative",
      "creativity",
      "innovative",
      "imaginative",
      "abstract",
      "explore",
      "learning",
      "novel",
      "variety",
      "art",
      "theory",
      "conceptual",
      "open-minded",
      "research",
    ],
    neg: [
      "rigid",
      "conventional",
      "traditional",
      "routine",
      "narrow",
      "literal",
      "closed-minded",
    ],
  },
  conscientiousness: {
    pos: [
      "organized",
      "plan",
      "planning",
      "deadline",
      "punctual",
      "prioritize",
      "discipline",
      "structured",
      "process",
      "quality",
      "meticulous",
      "detail",
      "reliable",
      "responsible",
      "diligent",
      "schedule",
    ],
    neg: [
      "procrastinate",
      "messy",
      "late",
      "chaotic",
      "careless",
      "inconsistent",
      "impulsive",
    ],
  },
  extraversion: {
    pos: [
      "team",
      "talk",
      "communication",
      "present",
      "presentation",
      "networking",
      "energize",
      "outgoing",
      "social",
      "collaborate",
      "discussion",
      "lead",
      "facilitate",
      "brainstorm",
    ],
    neg: [
      "introvert",
      "quiet",
      "reserved",
      "prefer alone",
      "isolate",
      "shy",
      "avoid people",
    ],
  },
  agreeableness: {
    pos: [
      "support",
      "help",
      "empathy",
      "cooperate",
      "collaborate",
      "trust",
      "kind",
      "polite",
      "feedback",
      "compromise",
      "mentor",
      "assist",
      "listen",
      "respect",
    ],
    neg: [
      "argue",
      "conflict",
      "hostile",
      "blame",
      "aggressive",
      "confrontational",
      "stubborn",
    ],
  },
  neuroticism: {
    pos: [
      "stress",
      "anxious",
      "worry",
      "overthink",
      "nervous",
      "pressure",
      "panic",
      "frustrated",
      "irritated",
    ],
    neg: [
      "calm",
      "compose",
      "resilient",
      "cope",
      "manage stress",
      "bounce back",
      "stable",
      "even-tempered",
    ],
  },
};

const PF16_LEX: Record<keyof Pf16Scores, { pos: string[]; neg: string[] }> = {
  Warmth: {
    pos: [
      "warm",
      "friendly",
      "approachable",
      "supportive",
      "bonding",
      "team spirit",
      "relationship",
    ],
    neg: ["cold", "distant", "aloof", "detached"],
  },
  Reasoning: {
    pos: [
      "analyze",
      "logic",
      "reason",
      "deduce",
      "pattern",
      "model",
      "quantitative",
      "evidence",
      "data",
    ],
    neg: ["guess", "assume", "hunch"],
  },
  EmotionalStability: {
    pos: ["calm", "composed", "steady", "resilient", "cope", "recover", "bounce back"],
    neg: ["moody", "unstable", "overwhelmed", "panic"],
  },
  Dominance: {
    pos: ["lead", "assertive", "drive", "influence", "decision", "take charge", "ownership"],
    neg: ["passive", "submissive", "avoid decision"],
  },
  Liveliness: {
    pos: ["energetic", "enthusiastic", "cheerful", "lively", "fun", "engaging"],
    neg: ["dull", "monotone", "low energy"],
  },
  RuleConsciousness: {
    pos: [
      "procedure",
      "process",
      "policy",
      "compliance",
      "standards",
      "governance",
      "audit",
    ],
    neg: ["cut corners", "ignore rules", "bypass"],
  },
  SocialBoldness: {
    pos: [
      "confident",
      "public speaking",
      "present",
      "network",
      "meet new people",
      "outspoken",
    ],
    neg: ["shy", "avoid", "stage fright", "hesitant"],
  },
  Sensitivity: {
    pos: [
      "empathetic",
      "sensitive",
      "aesthetic",
      "tender",
      "considerate",
      "feelings",
    ],
    neg: ["insensitive", "blunt", "harsh"],
  },
  Vigilance: {
    pos: ["skeptical", "question", "risk", "due diligence", "monitor", "alert"],
    neg: ["naive", "overtrusting", "careless"],
  },
  Abstractedness: {
    pos: ["abstract", "conceptual", "big picture", "vision", "ideation", "theoretical"],
    neg: ["concrete only", "literal", "practical only"],
  },
  Privateness: {
    pos: ["private", "discreet", "boundaries", "confidential", "reserved"],
    neg: ["overshare", "talk openly about personal"],
  },
  Apprehension: {
    pos: ["self-critique", "prepare", "double-check", "concern", "cautious"],
    neg: ["overconfident", "carefree", "reckless"],
  },
  OpennessToChange: {
    pos: ["adapt", "change", "flexible", "iterate", "pivot", "improve", "innovation"],
    neg: ["resist change", "rigid", "fixed"],
  },
  SelfReliance: {
    pos: ["independent", "self-reliant", "autonomous", "solo", "ownership"],
    neg: ["dependent", "need guidance", "hand-holding"],
  },
  Perfectionism: {
    pos: [
      "detail",
      "quality",
      "perfection",
      "standards",
      "polish",
      "refine",
      "checklist",
      "organize",
      "tidy",
    ],
    neg: ["sloppy", "good enough", "rough"],
  },
  Tension: {
    pos: [
      "tight deadline",
      "pressure",
      "urgent",
      "restless",
      "driven",
      "tense",
      "stressed",
    ],
    neg: ["relaxed", "unhurried", "laid-back"],
  },
};

function traitScore01(text: string, pos: string[], neg: string[]) {
  const p = countHits(text, pos);
  const n = countHits(text, neg);
  if (p === 0 && n === 0) return 0;
  const raw = (p - n) / (p + n);
  return clamp01((raw + 1) / 2);
}

export function calcOCEANFromSpeech(speechText: string) {
  const text = norm(speechText);

  const deltas: OceanScores = {
    openness: scaleDelta(
      traitScore01(text, OCEAN_LEX.openness.pos, OCEAN_LEX.openness.neg)
    ),
    conscientiousness: scaleDelta(
      traitScore01(
        text,
        OCEAN_LEX.conscientiousness.pos,
        OCEAN_LEX.conscientiousness.neg
      )
    ),
    extraversion: scaleDelta(
      traitScore01(text, OCEAN_LEX.extraversion.pos, OCEAN_LEX.extraversion.neg)
    ),
    agreeableness: scaleDelta(
      traitScore01(text, OCEAN_LEX.agreeableness.pos, OCEAN_LEX.agreeableness.neg)
    ),
    neuroticism: scaleDelta(
      traitScore01(text, OCEAN_LEX.neuroticism.pos, OCEAN_LEX.neuroticism.neg)
    ),
  };

  return deltas;
}

export function calc16PFfromSpeech(speechText: string) {
  const text = norm(speechText);

  const out: Pf16Scores = {
    Warmth: scaleDelta(
      traitScore01(text, PF16_LEX.Warmth.pos, PF16_LEX.Warmth.neg)
    ),
    Reasoning: scaleDelta(
      traitScore01(text, PF16_LEX.Reasoning.pos, PF16_LEX.Reasoning.neg)
    ),
    EmotionalStability: scaleDelta(
      traitScore01(
        text,
        PF16_LEX.EmotionalStability.pos,
        PF16_LEX.EmotionalStability.neg
      )
    ),
    Dominance: scaleDelta(
      traitScore01(text, PF16_LEX.Dominance.pos, PF16_LEX.Dominance.neg)
    ),
    Liveliness: scaleDelta(
      traitScore01(text, PF16_LEX.Liveliness.pos, PF16_LEX.Liveliness.neg)
    ),
    RuleConsciousness: scaleDelta(
      traitScore01(
        text,
        PF16_LEX.RuleConsciousness.pos,
        PF16_LEX.RuleConsciousness.neg
      )
    ),
    SocialBoldness: scaleDelta(
      traitScore01(
        text,
        PF16_LEX.SocialBoldness.pos,
        PF16_LEX.SocialBoldness.neg
      )
    ),
    Sensitivity: scaleDelta(
      traitScore01(text, PF16_LEX.Sensitivity.pos, PF16_LEX.Sensitivity.neg)
    ),
    Vigilance: scaleDelta(
      traitScore01(text, PF16_LEX.Vigilance.pos, PF16_LEX.Vigilance.neg)
    ),
    Abstractedness: scaleDelta(
      traitScore01(
        text,
        PF16_LEX.Abstractedness.pos,
        PF16_LEX.Abstractedness.neg
      )
    ),
    Privateness: scaleDelta(
      traitScore01(text, PF16_LEX.Privateness.pos, PF16_LEX.Privateness.neg)
    ),
    Apprehension: scaleDelta(
      traitScore01(
        text,
        PF16_LEX.Apprehension.pos,
        PF16_LEX.Apprehension.neg
      )
    ),
    OpennessToChange: scaleDelta(
      traitScore01(
        text,
        PF16_LEX.OpennessToChange.pos,
        PF16_LEX.OpennessToChange.neg
      )
    ),
    SelfReliance: scaleDelta(
      traitScore01(
        text,
        PF16_LEX.SelfReliance.pos,
        PF16_LEX.SelfReliance.neg
      )
    ),
    Perfectionism: scaleDelta(
      traitScore01(
        text,
        PF16_LEX.Perfectionism.pos,
        PF16_LEX.Perfectionism.neg
      )
    ),
    Tension: scaleDelta(
      traitScore01(text, PF16_LEX.Tension.pos, PF16_LEX.Tension.neg)
    ),
  };

  return out;
}
