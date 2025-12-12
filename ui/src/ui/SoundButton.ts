import { html, css } from "./utils";

const noSoundSVG = `
  <svg width="35" viewBox="-50.00 -50.00 966.95 796.93">
    <path d="M153.105 470.641 L485.545 690.721 L491.795 694.354 L497.212 696.425 L501.795 696.934 L505.546 695.882 L508.462 693.268 L510.546 689.092 L511.796 683.355 L512.212 676.056 L512.212 20.878 L511.796 13.579 L510.546 7.842 L508.462 3.666 L505.546 1.052 L501.795 0.0 L497.212 0.509 L491.795 2.58 L485.545 6.213 L153.105 226.293 L31.836 226.293 L24.375 226.798 L17.908 228.313 L12.436 230.838 L7.959 234.373 L4.477 238.918 L1.99 244.473 L0.497 251.037 L0.0 258.612 L0.0 438.322 L0.497 445.897 L1.99 452.461 L4.477 458.016 L7.959 462.561 L12.436 466.096 L17.908 468.621 L24.375 470.136 L31.836 470.641 Z" stroke="{{color}}" stroke-width="10.0px" fill="none"/>
    <path d="M625.555 478.17 L740.623 361.357 L855.692 478.17 L866.947 466.743 L751.879 349.931 L866.947 233.118 L855.692 221.692 L740.623 338.504 L625.555 221.692 L614.299 233.118 L729.367 349.931 L614.299 466.743 Z" stroke="{{color}}" stroke-width="none" fill="{{color}}"/>
  </svg>
`;

const soundSVG = `
  <svg width="35" viewBox="-50.00 -50.00 957.91 796.93">
    <path d="M153.204 470.641 L485.859 690.721 L492.113 694.354 L497.533 696.425 L502.119 696.934 L505.872 695.882 L508.79 693.268 L510.875 689.092 L512.126 683.355 L512.543 676.056 L512.543 20.878 L512.126 13.579 L510.875 7.842 L508.79 3.666 L505.872 1.052 L502.119 0.0 L497.533 0.509 L492.113 2.58 L485.859 6.213 L153.204 226.293 L31.857 226.293 L24.39 226.798 L17.919 228.313 L12.444 230.838 L7.964 234.373 L4.48 238.918 L1.991 244.473 L0.498 251.037 L0.0 258.612 L0.0 438.322 L0.498 445.897 L1.991 452.461 L4.48 458.016 L7.964 462.561 L12.444 466.096 L17.919 468.621 L24.39 470.136 L31.857 470.641 Z" stroke="{{color}}" stroke-width="10.0px" fill="none"/>
    <path d="M857.913 358.01 L857.913 341.851 L695.329 341.851 L695.329 358.01 Z" stroke="{{color}}" stroke-width="none" fill="{{color}}"/>
    <path d="M792.867 95.576 L784.903 81.582 L644.101 164.053 L652.065 178.047 Z" stroke="{{color}}" stroke-width="none" fill="{{color}}"/>
    <path d="M784.903 618.28 L792.867 604.286 L652.065 521.815 L644.101 535.809 Z" stroke="{{color}}" stroke-width="none" fill="{{color}}"/>
  </svg>
`;

const applyColor = (button: string, color: string) =>
  button.replace(/{{color}}/g, color);

export default class LoadingScreen extends HTMLElement {
  private muted = true;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    const template = document.createElement("template");
    template.innerHTML = html` <div class="sound-btn"></div> `.toString();

    const styleString = css`
      .sound-btn {
        cursor: pointer;
        transition: opacity 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .sound-btn:hover {
        opacity: 0.7;
      }

      @media screen and (max-width: 768px) {
      }
    `;

    const style = document.createElement("style");
    style.textContent = styleString[0];

    this.shadowRoot?.append(style, template.content.cloneNode(true));

    const soundBtnEl = this.shadowRoot?.querySelector(".sound-btn");
    // TODO (Kirill): Figure out how to pass color through props
    const color = "rgb(255, 255, 255)";

    if (soundBtnEl) {
      soundBtnEl.innerHTML = applyColor(noSoundSVG, color);

      soundBtnEl.addEventListener("click", () => {
        if (this.muted) {
          soundBtnEl.innerHTML = applyColor(soundSVG, color);
          const event = new CustomEvent("play-sounds");
          window.dispatchEvent(event);
        } else {
          soundBtnEl.innerHTML = applyColor(noSoundSVG, color);
          const event = new CustomEvent("stop-sounds");
          window.dispatchEvent(event);
        }
        this.muted = !this.muted;
      });
    }
  }
}
