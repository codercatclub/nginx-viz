import { html, css } from "./utils";

export default class Tutorial extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    const template = document.createElement("template");
    template.innerHTML = html` <div class="tutorial">
      .scroll to move.
    </div>`.toString();

    const styleString = css`
      @import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300&display=swap");

      .tutorial {
        position: absolute;
        bottom: 20px;
        left: 50%;
        z-index: 999;
        opacity: 0.6;
        color: white;
        font-family: "IBM Plex Mono", monospace;
        font-size: 18px;
      }

      span {
        line-height: 20px;
      }

      @media screen and (max-width: 768px) {
      }
    `;

    const style = document.createElement("style");
    style.textContent = styleString[0];

    this.shadowRoot?.append(style, template.content.cloneNode(true));
  }
}
