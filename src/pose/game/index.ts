import { Manager } from "./Manager";
import { LoaderScene } from "./scenes/LoaderScene";

export const start = () => {
  // 設置好 pixi manager, 並且設置好畫面大小
  Manager.initialize(640, 480, 0x666666);

  // manager 轉到 loader scene, 過程會載入遊戲所有會用到的圖片資源
  const loady: LoaderScene = new LoaderScene();
  Manager.changeScene(loady);
};
