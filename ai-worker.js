import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.1";
env.allowLocalModels = false;

let generator = null;
const mobileDevice =
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
  (navigator.deviceMemory && navigator.deviceMemory <= 4);

const modelId = mobileDevice
  ? "onnx-community/SmolLM2-135M-Instruct-ONNX"
  : "onnx-community/Qwen3-0.6B-ONNX";

async function loadModel() {
  if (generator) return generator;

  // On mobile, q4 on WASM uses much less memory than the former 0.6B model.
  const options = mobileDevice
    ? { dtype: "q4" }
    : navigator.gpu
      ? { device: "webgpu", dtype: "q4f16" }
      : { dtype: "q4" };

  options.progress_callback = (progress) => {
    self.postMessage({ type: "progress", progress, mobileDevice });
  };

  self.postMessage({
    type: "loading",
    mobileDevice,
    model: mobileDevice ? "léger (téléphone)" : "complet (ordinateur)"
  });

  generator = await pipeline("text-generation", modelId, options);
  self.postMessage({ type: "ready", mobileDevice });
  return generator;
}

self.onmessage = async (event) => {
  if (event.data?.type !== "ask") return;
  try {
    const pipe = await loadModel();
    const { question, passage, notes } = event.data;
    const messages = [
      {
        role: "system",
        content:
          "Tu es un assistant de réflexion biblique personnel. Réponds uniquement en français. " +
          "Base ta réponse seulement sur le passage biblique et les notes fournis. " +
          "Distingue ce qui vient de la Bible et ce qui vient des notes personnelles. " +
          "Cite seulement les références présentes. Si le contexte ne suffit pas, dis-le. " +
          "N'invente jamais de verset et ne prétends jamais parler au nom de Dieu. " +
          "Sois respectueux, bienveillant, bref et pratique."
      },
      {
        role: "user",
        content:
          "PASSAGE :\n" + (passage || "Aucun passage fourni.") +
          "\n\nNOTES :\n" + (notes || "Aucune note fournie.") +
          "\n\nQUESTION :\n" + question
      }
    ];

    self.postMessage({ type: "generating", mobileDevice });
    const output = await pipe(messages, {
      max_new_tokens: mobileDevice ? 72 : 160,
      do_sample: false,
      repetition_penalty: 1.22,
      no_repeat_ngram_size: 4
    });

    let generated = output?.[0]?.generated_text;
    let answer = Array.isArray(generated)
      ? generated.at(-1)?.content || ""
      : String(generated || "");

    answer = answer
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/^assistant\s*/i, "")
      .trim();

    self.postMessage({ type: "answer", answer, mobileDevice });
  } catch (error) {
    self.postMessage({
      type: "error",
      mobileDevice,
      message: error?.message || "Le modèle local n'a pas pu démarrer."
    });
  }
};
