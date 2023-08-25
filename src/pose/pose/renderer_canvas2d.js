import * as posedetection from "@tensorflow-models/pose-detection";

import * as params from "./params";

export class RendererCanvas2d {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.options = options;

    this.ctx = canvas.getContext("2d");

    // 有 flip 就會把畫面水平翻轉
    if (options.flip) {
      this.flip();
    }
  }

  flip() {
    // Because the image from camera is mirrored, need to flip horizontally.
    this.ctx.translate(this.canvas.width, 0);
    this.ctx.scale(-1, 1);
  }

  // 把 video 和 poses 的數據畫到 pose canvas 上
  draw(rendererParams) {
    const [video, poses] = rendererParams;

    // 把 video 的畫面畫到 canvas 上
    this.drawCtx(video);

    // 把 poses 的數據畫到 canvas 上
    if (poses && poses.length > 0) {
      this.drawResults(poses);
    }
  }

  drawCtx(video) {
    this.ctx.drawImage(
      video,
      0,
      0,
      video.width,
      video.height,
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );
  }

  clearCtx() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // poses 中每個 pose 都要畫, 因為可以應付多人
  drawResults(poses) {
    for (const pose of poses) {
      this.drawResult(pose);
    }
  }

  // 畫 keypoints 和 skeleton
  drawResult(pose) {
    if (pose.keypoints != null) {
      this.drawKeypoints(pose.keypoints);
      this.drawSkeleton(pose.keypoints);
      this.drawBoundingBox(pose);
    }
  }

  drawKeypoints(keypoints) {
    const keypointInd = posedetection.util.getKeypointIndexBySide(
      params.STATE.model
    );
    this.ctx.fillStyle = "Red";
    this.ctx.strokeStyle = "White";
    this.ctx.lineWidth = params.DEFAULT_LINE_WIDTH;

    for (const i of keypointInd.middle) {
      this.drawKeypoint(keypoints[i]);
    }

    this.ctx.fillStyle = "Green";
    for (const i of keypointInd.left) {
      this.drawKeypoint(keypoints[i]);
    }

    this.ctx.fillStyle = "Orange";
    for (const i of keypointInd.right) {
      this.drawKeypoint(keypoints[i]);
    }
  }

  drawKeypoint(keypoint) {
    // If score is null, just show the keypoint.
    const score = keypoint.score != null ? keypoint.score : 1;
    const scoreThreshold = params.STATE.modelConfig.scoreThreshold || 0;

    if (score >= scoreThreshold) {
      const circle = new Path2D();
      circle.arc(keypoint.x, keypoint.y, params.DEFAULT_RADIUS, 0, 2 * Math.PI);
      this.ctx.fill(circle);
      this.ctx.stroke(circle);
    }
  }

  drawSkeleton(keypoints) {
    // Each poseId is mapped to a color in the color palette.
    const color = "White";
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = params.DEFAULT_LINE_WIDTH;

    posedetection.util
      .getAdjacentPairs(params.STATE.model)
      .forEach(([i, j]) => {
        const kp1 = keypoints[i];
        const kp2 = keypoints[j];

        // If score is null, just show the keypoint.
        const score1 = kp1.score != null ? kp1.score : 1;
        const score2 = kp2.score != null ? kp2.score : 1;
        const scoreThreshold = params.STATE.modelConfig.scoreThreshold || 0;

        if (score1 >= scoreThreshold && score2 >= scoreThreshold) {
          this.ctx.beginPath();
          this.ctx.moveTo(kp1.x, kp1.y);
          this.ctx.lineTo(kp2.x, kp2.y);
          this.ctx.stroke();
        }
      });
  }

  drawBoundingBox(pose) {
    let color = "Red";

    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = params.DEFAULT_LINE_WIDTH;
    this.ctx.beginPath();
    this.ctx.rect(
      pose.box.xMin,
      pose.box.yMin,
      pose.box.width,
      pose.box.height
    );
    this.ctx.stroke();
  }
}
