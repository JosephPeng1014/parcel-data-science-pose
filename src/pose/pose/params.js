import * as posedetection from "@tensorflow-models/pose-detection";

// pose 骨架畫線的參數
export const DEFAULT_LINE_WIDTH = 2;
export const DEFAULT_RADIUS = 4;

export const STATE = {
  // webcam 參數
  // 主要有擷圖 webcam 的長和寬
  camera: {
    targetFPS: 60,
    sizeOption: {
      width: 640,
      height: 480
    }
  },

  // 模型參數
  backend: "tfjs-webgl",
  flags: {
    WEBGL_CPU_FORWARD: true,
    WEBGL_FLUSH_THRESHOLD: -1,
    WEBGL_FORCE_F16_TEXTURES: false,
    WEBGL_PACK: true,
    WEBGL_RENDER_FLOAT32_CAPABLE: true,
    WEBGL_VERSION: 2
  },
  modelConfig: {
    scoreThreshold: 0.2,
    type: "multipose"
  },
  model: posedetection.SupportedModels.MoveNet
};
