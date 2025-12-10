import { html, css } from './utils';

export default class Header extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    const template = document.createElement("template");
    template.innerHTML = html`
      <div class="container" part="container">
        <nav id="nav">
          <a href="https://codercat.tk" target="_blank">.other</a>
          <a href="about.html">.about</a>
        </nav>
      </div>
    `.toString();

    const styleString = css`
      .container {
        position: absolute;
        display: flex;
        justify-content: flex-end;
        align-items: center;
        height: 20px;
        width: 100%;
        top: 25px;
        /* padding: 25px 0 0 0; */
      }

      nav {
        margin: 20px;
      }

      a {
        color: white;
        font-size: 20px;
        font-family: "Courier New";
        text-decoration: none;
        opacity: 0.7;
        margin: 10px;
      }

      @media screen and (max-width: 768px) {

      }
    `;

    const style = document.createElement("style");
    style.textContent = styleString[0];

    this.shadowRoot?.append(style, template.content.cloneNode(true));
  }
}
