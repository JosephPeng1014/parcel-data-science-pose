import { Container, Sprite, Texture } from "pixi.js";
import { IScene, Manager } from "../Manager";

declare global {
  interface Window {
    poses: any;
  }
}

export class GameScene extends Container implements IScene {
  // canvas 的 sprite
  private canvas: Sprite;
  // canvas 會顯示在這裡
  private canvasTexture: Texture;

  constructor() {
    super();
    this.sortableChildren = true;

    // canvas sprite
    const canvas = document.getElementById("output");
    this.canvasTexture = Texture.from(canvas as any);
    this.canvas = new Sprite(this.canvasTexture);
    this.canvas.zIndex = 2;
    this.addChild(this.canvas);
  }

  //
  public update(framesPassed: number): void {
    // canvas texture 更新動畫
    this.canvasTexture.update();
  }

  public resize(screenWidth: number, screenHeight: number): void {
    console.log("game screenWidth", screenWidth, "screenHeight", screenHeight);
  }
}
