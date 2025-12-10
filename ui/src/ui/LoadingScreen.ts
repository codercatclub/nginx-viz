import { html, css } from "./utils";

interface ProgressEvent extends CustomEvent {
  detail: {
    idx: number;
    src: string;
  };
}

interface OnItemLoadEndEvent extends CustomEvent {
  detail: {
    idx: number;
    total: number;
  };
}

export default class LoadingScreen extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    const template = document.createElement("template");
    template.innerHTML = html`
      <div id="loading-screen">
        <div class="load-container">
          <div id="progress">
            <div id="bar"></div>
          </div>
          <div id="load-log">loading assets...</div>
        </div>
      </div>
    `.toString();

    const styleString = css`
      #loading-screen {
        display: flex;
        position: fixed;
        top: 0;
        bottom: 0;
        left: 0;
        right: 0;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        background-color: rgb(24, 23, 23);
      }

      .load-container {
        display: flex;
        flex-direction: column;
        font-family: Courier New, Courier, monospace;
        font-size: 12px;
        width: 240px;
        color: rgba(255, 255, 255, 0.87);
      }

      #progress {
        width: 100%;
        border-style: solid;
        border-width: 1px;
        border-color: white;
        margin-bottom: 5px;
      }

      #bar {
        width: 0%;
        height: 10px;
        background-color: white;
      }

      @media screen and (max-width: 768px) {
      }
    `;

    const style = document.createElement("style");
    style.textContent = styleString[0];

    this.shadowRoot?.append(style, template.content.cloneNode(true));

    const loadingScreenEl = this.shadowRoot?.querySelector(
      "#loading-screen"
    ) as HTMLElement;
    const barEl = this.shadowRoot?.getElementById("bar");

    window.addEventListener("on-item-load-end", ((e: OnItemLoadEndEvent) => {
      const { total, idx } = e.detail;
      const itemsLoaded = total - (total - (idx + 1));

      const width = (itemsLoaded / total) * 100;

      if (barEl) {
        barEl.style.width = width + "%";
      }
    }) as EventListener);

    window.addEventListener("on-load-start", (() => {
      if (loadingScreenEl) {
        loadingScreenEl.style.display = "flex";
      }
    }) as EventListener);

    window.addEventListener("on-load-end", (() => {
      if (loadingScreenEl) {
        loadingScreenEl.style.display = "none";
      }
    }) as EventListener);
  }
}
