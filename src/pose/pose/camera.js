export class Camera {
  constructor() {
    this.video = document.getElementById("video");
  }

  static async setup(cameraParam) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(
        "Browser API navigator.mediaDevices.getUserMedia not available"
      );
    }

    const { targetFPS, sizeOption } = cameraParam;
    const videoConfig = {
      audio: false,
      video: {
        facingMode: "user",
        width: sizeOption.width,
        height: sizeOption.height,
        frameRate: {
          ideal: targetFPS
        }
      }
    };

    // webcam stream
    const stream = await navigator.mediaDevices.getUserMedia(videoConfig);

    // 將 camera 的畫面放到 video
    const camera = new Camera();
    camera.video.srcObject = stream;

    // 等待 video 載入完成
    await new Promise(resolve => {
      camera.video.onloadedmetadata = () => {
        resolve(true);
      };
    });

    // 播放 video
    camera.video.play();

    const videoWidth = camera.video.videoWidth;
    const videoHeight = camera.video.videoHeight;

    // 設置 video 的高度和寬度
    camera.video.width = videoWidth;
    camera.video.height = videoHeight;

    // 返回 camera instance
    return camera;
  }
}
