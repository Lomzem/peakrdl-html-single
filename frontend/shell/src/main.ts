import { mount } from "svelte";

import App from "../../src/routes/+page.svelte";

mount(App, {
  target: document.getElementById("app")!
});
