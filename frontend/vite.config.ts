import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig, type Plugin } from "vite";

const virtualModuleId = "virtual:peakrdl-dev-document";
const resolvedVirtualModuleId = `\0${virtualModuleId}`;
const projectRoot = path.resolve(import.meta.dirname, "..");
const exampleRdl = path.join(projectRoot, "example-rdl", "example.rdl");

function devDocumentPlugin(enabled: boolean): Plugin {
  let documentJson: string | null = null;

  const loadDocument = () => {
    documentJson = null;
    if (!enabled || !existsSync(exampleRdl)) return;

    const virtualEnvironment = process.env.PEAKRDL_HTML_SINGLE_PYTHON;
    const localEnvironment = path.join(projectRoot, ".venv", "bin", "python");
    const python =
      virtualEnvironment || (existsSync(localEnvironment) ? localEnvironment : "python");

    try {
      documentJson = execFileSync(python, ["-m", "peakrdl_html_single.dev_document", exampleRdl], {
        cwd: projectRoot,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
        env: {
          ...process.env,
          PYTHONPATH: [path.join(projectRoot, "src"), process.env.PYTHONPATH]
            .filter(Boolean)
            .join(path.delimiter),
        },
      });
      console.info("[html-single] Using example-rdl/example.rdl for development data");
    } catch (error) {
      console.warn("[html-single] Could not compile development RDL; using an empty model", error);
    }
  };

  loadDocument();
  return {
    name: "peakrdl-dev-document",
    resolveId(id) {
      return id === virtualModuleId ? resolvedVirtualModuleId : undefined;
    },
    load(id) {
      if (id === resolvedVirtualModuleId) return `export default ${JSON.stringify(documentJson)}`;
    },
    configureServer(server) {
      server.watcher.add(exampleRdl);
      const update = (file: string) => {
        if (path.resolve(file) !== exampleRdl) return;
        loadDocument();
        const module = server.moduleGraph.getModuleById(resolvedVirtualModuleId);
        if (module) server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("add", update);
      server.watcher.on("change", update);
      server.watcher.on("unlink", update);
    },
  };
}

export default defineConfig(({ command }) => {
  return {
    plugins: [devDocumentPlugin(command === "serve"), tailwindcss(), sveltekit()],
  };
});
