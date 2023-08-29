import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs";
import * as posedetection from "@tensorflow-models/pose-detection";
import _ from "lodash";
import * as $ from "jquery";

import { Camera } from "./pose/camera";
import { RendererCanvas2d } from "./pose/renderer_canvas2d";
import * as params from "./pose/params";
import { setupStats } from "./pose/stats_panel";
import { setBackendAndEnvFlags } from "./pose/util";

import * as game from "./game";

window.$ = $;

const { STATE } = params;
window.STATE = params.STATE;

// pose detector
let detector;
// camera instance
let camera;

// fps panel
let stats;
// 用於計算 fps 相關的參數
let startInferenceTime;
let numInferences = 0;
let inferenceTimeSum = 0;
let lastPanelUpdate = 0;

// pose renderer
let renderer = null;

// pose canvas
let canvas;

async function createDetector() {
  const modelType = posedetection.movenet.modelType.SINGLEPOSE_THUNDER;
  const modelConfig = {
    modelType,
    modelUrl: "/models/movenet/thunder/model.json"
  };
  return posedetection.createDetector(STATE.model, modelConfig);
}

function beginEstimatePosesStats() {
  startInferenceTime = (performance || Date).now();
}

function endEstimatePosesStats() {
  const endInferenceTime = (performance || Date).now();
  inferenceTimeSum += endInferenceTime - startInferenceTime;
  ++numInferences;

  const panelUpdateMilliseconds = 1000;
  if (endInferenceTime - lastPanelUpdate >= panelUpdateMilliseconds) {
    const averageInferenceTime = inferenceTimeSum / numInferences;
    inferenceTimeSum = 0;
    numInferences = 0;
    stats.customFpsPanel.update(
      1000.0 / averageInferenceTime,
      120 /* maxValue */
    );
    lastPanelUpdate = endInferenceTime;
  }
}

async function renderResult() {
  // 確保 camera 正常
  if (camera.video.readyState < 2) {
    await new Promise(resolve => {
      camera.video.onloadeddata = () => {
        resolve(true);
      };
    });
  }

  let poses = null;

  // 開始計算 fps
  beginEstimatePosesStats();

  // 進行姿勢估計
  try {
    poses = await detector.estimatePoses(camera.video);
    window.poses = poses;
  } catch (error) {
    detector.dispose();
    detector = null;
    alert(error);
  }

  if (poses) {
    poses.forEach(pose => {
      const boundingBox = getBoundingBox(pose.keypoints);
      pose.box = {
        yMin: boundingBox.minY,
        xMin: boundingBox.minX,
        yMax: boundingBox.maxY,
        xMax: boundingBox.maxX,
        width: boundingBox.maxX - boundingBox.minX,
        height: boundingBox.maxY - boundingBox.minY
      };
      pose.angles = calcAngles(pose.keypoints);
    });
  }

  // 將姿勢估計結果畫到 pose canvas 上
  renderer.draw([camera.video, poses]);

  // 結束計算 fps
  endEstimatePosesStats();
}

const { NEGATIVE_INFINITY, POSITIVE_INFINITY } = Number;
function getBoundingBox(keypoints) {
  return keypoints.reduce(
    ({ maxX, maxY, minX, minY }, { x, y }) => {
      return {
        maxX: Math.max(maxX, x),
        maxY: Math.max(maxY, y),
        minX: Math.min(minX, x),
        minY: Math.min(minY, y)
      };
    },
    {
      maxX: NEGATIVE_INFINITY,
      maxY: NEGATIVE_INFINITY,
      minX: POSITIVE_INFINITY,
      minY: POSITIVE_INFINITY
    }
  );
}

function calcAngles(arr) {
  const angles = [];
  const obj = {};

  const scoreThreshold = params.STATE.modelConfig.scoreThreshold || 0;

  obj["right_shoulder,right_elbow"] = {
    x1: arr[6].x,
    y1: arr[6].y,
    x2: arr[8].x,
    y2: arr[8].y,
    visible: arr[6].score >= scoreThreshold && arr[8].score >= scoreThreshold
  };
  obj["right_elbow,right_wrist"] = {
    x1: arr[8].x,
    y1: arr[8].y,
    x2: arr[10].x,
    y2: arr[10].y,
    visible: arr[8].score >= scoreThreshold && arr[10].score >= scoreThreshold
  };

  const line11 = obj["right_shoulder,right_elbow"];
  const line12 = obj["right_elbow,right_wrist"];
  if (line11 && line12 && line11.visible && line12.visible) {
    angles[1] = calcAngle(
      line12.x1,
      line12.y1,
      line12.x2,
      line12.y2,
      line11.x2,
      line11.y2,
      line11.x1,
      line11.y1
    );
  }

  obj["left_shoulder,left_elbow"] = {
    x1: arr[5].x,
    y1: arr[5].y,
    x2: arr[7].x,
    y2: arr[7].y,
    visible: arr[5].score >= scoreThreshold && arr[7].score >= scoreThreshold
  };

  obj["left_elbow,left_wrist"] = {
    x1: arr[7].x,
    y1: arr[7].y,
    x2: arr[9].x,
    y2: arr[9].y,
    visible: arr[7].score >= scoreThreshold && arr[9].score >= scoreThreshold
  };

  const line21 = obj["left_shoulder,left_elbow"];
  const line22 = obj["left_elbow,left_wrist"];
  if (line21 && line22 && line21.visible && line22.visible) {
    angles[2] = calcAngle(
      line21.x2,
      line21.y2,
      line21.x1,
      line21.y1,
      line22.x1,
      line22.y1,
      line22.x2,
      line22.y2
    );
  }

  obj["right_shoulder,right_hip"] = {
    x1: arr[6].x,
    y1: arr[6].y,
    x2: arr[12].x,
    y2: arr[12].y,
    visible: arr[6].score >= scoreThreshold && arr[12].score >= scoreThreshold
  };

  const line31 = obj["right_shoulder,right_elbow"];
  const line32 = obj["right_shoulder,right_hip"];
  if (line31 && line32 && line31.visible && line32.visible) {
    angles[3] = calcAngle(
      line32.x1,
      line32.y1,
      line32.x2,
      line32.y2,
      line31.x1,
      line31.y1,
      line31.x2,
      line31.y2
    );
  }

  obj["left_shoulder,left_hip"] = {
    x1: arr[5].x,
    y1: arr[5].y,
    x2: arr[11].x,
    y2: arr[11].y,
    visible: arr[5].score >= scoreThreshold && arr[11].score >= scoreThreshold
  };

  const line41 = obj["left_shoulder,left_elbow"];
  const line42 = obj["left_shoulder,left_hip"];
  if (line41 && line42 && line41.visible && line42.visible) {
    angles[4] = calcAngle(
      line41.x1,
      line41.y1,
      line41.x2,
      line41.y2,
      line42.x1,
      line42.y1,
      line42.x2,
      line42.y2
    );
  }

  obj["right_hip,right_knee"] = {
    x1: arr[12].x,
    y1: arr[12].y,
    x2: arr[14].x,
    y2: arr[14].y,
    visible: arr[12].score >= scoreThreshold && arr[14].score >= scoreThreshold
  };

  const line51 = obj["right_shoulder,right_hip"];
  const line52 = obj["right_hip,right_knee"];
  if (line51 && line52 && line51.visible && line52.visible) {
    angles[5] = calcAngle(
      line52.x1,
      line52.y1,
      line52.x2,
      line52.y2,
      line51.x2,
      line51.y2,
      line51.x1,
      line51.y1
    );
  }

  obj["left_hip,left_knee"] = {
    x1: arr[11].x,
    y1: arr[11].y,
    x2: arr[13].x,
    y2: arr[13].y,
    visible: arr[11].score >= scoreThreshold && arr[13].score >= scoreThreshold
  };

  const line61 = obj["left_shoulder,left_hip"];
  const line62 = obj["left_hip,left_knee"];
  if (line61 && line62 && line61.visible && line62.visible) {
    angles[6] = calcAngle(
      line61.x2,
      line61.y2,
      line61.x1,
      line61.y1,
      line62.x1,
      line62.y1,
      line62.x2,
      line62.y2
    );
  }

  obj["right_knee,right_ankle"] = {
    x1: arr[14].x,
    y1: arr[14].y,
    x2: arr[16].x,
    y2: arr[16].y,
    visible: arr[14].score >= scoreThreshold && arr[16].score >= scoreThreshold
  };

  const line71 = obj["right_hip,right_knee"];
  const line72 = obj["right_knee,right_ankle"];
  if (line71 && line72 && line71.visible && line72.visible) {
    angles[7] = calcAngle(
      line71.x2,
      line71.y2,
      line71.x1,
      line71.y1,
      line72.x1,
      line72.y1,
      line72.x2,
      line72.y2
    );
  }

  obj["left_knee,left_ankle"] = {
    x1: arr[13].x,
    y1: arr[13].y,
    x2: arr[15].x,
    y2: arr[15].y,
    visible: arr[13].score >= scoreThreshold && arr[15].score >= scoreThreshold
  };

  const line81 = obj["left_hip,left_knee"];
  const line82 = obj["left_knee,left_ankle"];
  if (line81 && line82 && line81.visible && line82.visible) {
    angles[8] = calcAngle(
      line82.x1,
      line82.y1,
      line82.x2,
      line82.y2,
      line81.x2,
      line81.y2,
      line81.x1,
      line81.y1
    );
  }

  return angles;
}

function calcAngle(A1x, A1y, A2x, A2y, B1x, B1y, B2x, B2y) {
  var dAx = A2x - A1x;
  var dAy = A2y - A1y;
  var dBx = B2x - B1x;
  var dBy = B2y - B1y;
  var angle = Math.atan2(dAx * dBy - dAy * dBx, dAx * dBx + dAy * dBy);
  // if(angle < 0) {angle = angle * -1;}
  var degree_angle = angle * (180 / Math.PI);
  return parseInt(degree_angle);
}

async function renderPrediction() {
  await renderResult();

  requestAnimationFrame(renderPrediction);
}

// app 入口
async function start() {
  // 設置 fps
  stats = setupStats();

  // 設置 camera
  camera = await Camera.setup(STATE.camera);

  // 設置 tfjs backend
  await setBackendAndEnvFlags(STATE.flags, STATE.backend);

  // 設置 pose detector
  detector = await createDetector();

  // 設置 pose canvas
  canvas = document.getElementById("output");
  canvas.width = camera.video.width;
  canvas.height = camera.video.height;

  // 設置 pose renderer 到 pose canvas
  renderer = new RendererCanvas2d(canvas, { flip: true });

  // 設置遊戲, pixi js 開始產生 canvas 到指定大小
  game.start();

  // 開始 render loop
  renderPrediction();
}

// const urlParams = new URLSearchParams(window.location.search);
// const debug = urlParams.get("debug");
// if (debug) {
//   setTimeout(() => {
//     $("#next-btn").trigger("click");
//   }, 200);
// }

$("#start-btn").on("click", function() {
  $("#page1").hide();
  $("#page2").show();
});

$("#next-btn").on("click", function() {
  $("#page1").hide();
  $("#page2").hide();
  $("#pixi-content").show();
  $("#other").show();
});
$("#pose1-btn").on("click", function() {
  window.targetPose = 1;
  $("#page1").hide();
  $("#page2").hide();
  $("#pixi-content").show();
  $("#other").show();
  $("#pose1-image").show()
  startCheckPose("pose1");
});
$("#pose2-btn").on("click", function() {
  window.targetPose = 2;
  $("#page1").hide();
  $("#page2").hide();
  $("#pixi-content").show();
  $("#other").show();
  $("#pose2-image").show()
  startCheckPose("pose2");
});
$("#pose3-btn").on("click", function() {
  window.targetPose = 3;
  $("#page1").hide();
  $("#page2").hide();
  $("#pixi-content").show();
  $("#other").show();
  $("#pose3-image").show()
  startCheckPose("pose3");
});
$("#pose4-btn").on("click", function() {
  window.targetPose = 4;
  $("#page1").hide();
  $("#page2").hide();
  $("#pixi-content").show();
  $("#other").show();
  $("#pose4-image").show()
  startCheckPose("pose4");
});
$("#pose5-btn").on("click", function() {
  window.targetPose = 5;
  $("#page1").hide();
  $("#page2").hide();
  $("#pixi-content").show();
  $("#other").show();
  $("#pose5-image").show()
  startCheckPose("pose5");
});
$("#pose6-btn").on("click", function() {
  window.targetPose = 6;
  $("#page1").hide();
  $("#page2").hide();
  $("#pixi-content").show();
  $("#other").show();
  $("#pose6-image").show()
  startCheckPose("pose6");
});
$("#pose7-btn").on("click", function() {
  window.targetPose = 7;
  $("#page1").hide();
  $("#page2").hide();
  $("#pixi-content").show();
  $("#other").show();
  $("#pose7-image").show()
  startCheckPose("pose7");
});
$("#pose8-btn").on("click", function() {
  window.targetPose = 8;
  $("#page1").hide();
  $("#page2").hide();
  $("#pixi-content").show();
  $("#other").show();
  $("#pose8-image").show()
  startCheckPose("pose8");
});

$("#page1").show();
start();

// draw target pose angles
setInterval(() => {
  if (window.poses && window.poses.length > 0) {
    const pose = window.poses[0];
    const angles = pose.angles;
    const text = $("#text");
    text.html("");
    for (let i = 1; i <= 8; i++) {
      const angle = angles[i];
      if (angle) {
        text.append(`<div>${i}: ${angle}</div>`);
      } else {
        text.append(`<div>${i}: -</div>`);
      }
    }
  }
}, 1000);

function startCheckPose(poseIndex) {
  // setup 初始值
  const anglesCheckList = [];
  anglesCheckList[1] = { okTime: null };
  anglesCheckList[2] = { okTime: null };
  anglesCheckList[3] = { okTime: null };
  anglesCheckList[4] = { okTime: null };
  anglesCheckList[5] = { okTime: null };
  anglesCheckList[6] = { okTime: null };
  anglesCheckList[7] = { okTime: null };
  anglesCheckList[8] = { okTime: null };

  // 每 0.2 秒檢查一次
  setInterval(() => {
    const currentTime = Date.now();
    const timeout = 1000;
    const pose = window.poses[0];
    if (pose) {
      const angles = pose.angles;

      // ok time 代表檢查角度非常正確在範圍內的登記時間

      // 如果曾經 ok，但超過時間, 變成不可信
      for (let i = 1; i <= 8; i++) {
        if (anglesCheckList[i].okTime) {
          if (currentTime - anglesCheckList[i].okTime > timeout) {
            anglesCheckList[i].okTime = null;
          }
        }
      }

      const regAngles = PoseAngles[poseIndex]
      const diffThread = 30

      // 檢查角度
      if (typeof angles[1] !== "undefined") {
        let angleDiff = Math.abs(angles[1] - regAngles[1])
        if(angleDiff > 180) { angleDiff = 360 - angleDiff }
        console.log('1', angleDiff)

        // 在範圍內
        if (angleDiff < diffThread) {
          anglesCheckList[1].okTime = currentTime;
        } else {
          // 不在範圍內, 但曾經 ok, 而且還沒超過 timeout
          // do nothing
        }
      }

      if (typeof angles[2] !== "undefined") {
        let angleDiff = Math.abs(angles[2] - regAngles[2])
        if(angleDiff > 180) { angleDiff = 360 - angleDiff }
        console.log('2', angleDiff)

        // 在範圍內
        if (angleDiff < diffThread) {
          anglesCheckList[2].okTime = currentTime;
        } else {
          // 不在範圍內, 但曾經 ok, 而且還沒超過 timeout
          // do nothing
        }
      }

      if (typeof angles[3] !== "undefined") {
        let angleDiff = Math.abs(angles[3] - regAngles[3])
        if(angleDiff > 180) { angleDiff = 360 - angleDiff }
        console.log('3', angleDiff)

        // 在範圍內
        if (angleDiff < diffThread) {
          anglesCheckList[3].okTime = currentTime;
        } else {
          // 不在範圍內, 但曾經 ok, 而且還沒超過 timeout
          // do nothing
        }
      }

      if (typeof angles[4] !== "undefined") {
        let angleDiff = Math.abs(angles[4] - regAngles[4])
        if(angleDiff > 180) { angleDiff = 360 - angleDiff }
        console.log('4', angleDiff)

        // 在範圍內
        if (angleDiff < diffThread) {
          anglesCheckList[4].okTime = currentTime;
        } else {
          // 不在範圍內, 但曾經 ok, 而且還沒超過 timeout
          // do nothing
        }
      }

      if (typeof angles[5] !== "undefined") {
        let angleDiff = Math.abs(angles[5] - regAngles[5])
        if(angleDiff > 180) { angleDiff = 360 - angleDiff }
        console.log('5', angleDiff)

        // 在範圍內
        if (angleDiff < diffThread) {
          anglesCheckList[5].okTime = currentTime;
        } else {
          // 不在範圍內, 但曾經 ok, 而且還沒超過 timeout
          // do nothing
        }
      }

      if (typeof angles[6] !== "undefined") {
        let angleDiff = Math.abs(angles[6] - regAngles[6])
        if(angleDiff > 180) { angleDiff = 360 - angleDiff }
        console.log('6', angleDiff)

        // 在範圍內
        if (angleDiff < diffThread) {
          anglesCheckList[6].okTime = currentTime;
        } else {
          // 不在範圍內, 但曾經 ok, 而且還沒超過 timeout
          // do nothing
        }
      }

      if (typeof angles[7] !== "undefined") {
        let angleDiff = Math.abs(angles[7] - regAngles[7])
        if(angleDiff > 180) { angleDiff = 360 - angleDiff }
        console.log('7', angleDiff)

        // 在範圍內
        if (angleDiff < diffThread) {
          anglesCheckList[7].okTime = currentTime;
        } else {
          // 不在範圍內, 但曾經 ok, 而且還沒超過 timeout
          // do nothing
        }
      }

      if (typeof angles[8] !== "undefined") {
        let angleDiff = Math.abs(angles[8] - regAngles[8])
        if(angleDiff > 180) { angleDiff = 360 - angleDiff }
        console.log('8', angleDiff)

        // 在範圍內
        if (angleDiff < diffThread) {
          anglesCheckList[8].okTime = currentTime;
        } else {
          // 不在範圍內, 但曾經 ok, 而且還沒超過 timeout
          // do nothing
        }
      }

      if (
        anglesCheckList[1].okTime &&
        anglesCheckList[2].okTime &&
        anglesCheckList[3].okTime &&
        anglesCheckList[4].okTime &&
        anglesCheckList[5].okTime &&
        anglesCheckList[6].okTime &&
        anglesCheckList[7].okTime &&
        anglesCheckList[8].okTime
      ) {
        alert("成功");
      }
    }
  }, 200);
}


const PoseAngles = {
  pose1: [0, 152, 154, -176, 176, -173, 121, -172, 65],    // tree
  pose2: [0, -171, -177, -172, 175, 132, 75, -139, 70],    // low lune
  pose3: [0, -166, 169, -174, -176, -120, -152, -129, 162],  // warrior 1
  pose4: [0, 178, -173, 95, 112, 128, 91, -169, 102],      // warrior 2
  pose5: [0, -173, 179, -160, 168, -78, 167, -158, 161],   // warrior 3
  pose6: [0, 167, -174, 164, -168, 91, -90, 97, -97],      // chair
  pose7: [0, -175, 176, -110, 109, -83, 84, -80, 82],      // awkward
  pose8: [0, 157, 158, 80, 95, 179, 62, -173, 164],        // half_moon
}
