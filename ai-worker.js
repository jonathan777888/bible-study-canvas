import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.1";
env.allowLocalModels = false;
let generator = null;

async function loadModel() {
  if (generator) return generator;
  const options = navigator.gpu
    ? { device: "webgpu", dtype: "q4f16" }
    : { dtype: "q4" };
  options.progress_callback = (progress) => {
    self.postMessage({ type: "progress", progress });
  };
  generator = await pipeline(
    "text-generation",
    "onnx-community/Qwen3-0.6B-ONNX",
    options
  );
  self.postMessage({ type: "ready" });
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
          "Distingue clairement ce qui vient de la Bible et ce qui vient des notes personnelles. " +
          "Cite les références bibliques présentes dans le contexte. " +
          "Si le contexte ne suffit pas, dis-le clairement et demande un passage supplémentaire. " +
          "N'invente jamais de verset et ne prétends jamais parler au nom de Dieu. " +
          "Sois respectueux, bienveillant, bref et pratique."
      },
      {
        role: "user",
        content:
          "PASSAGE BIBLIQUE FOURNI:\n" + (passage || "Aucun passage fourni.") +
          "\n\nNOTES PERSONNELLES:\n" + (notes || "Aucune note fournie.") +
          "\n\nQUESTION:\n" + question
      }
    ];
    const output = await pipe(messages, {
      max_new_tokens: 320,
      do_sample: false,
      repetition_penalty: 1.08
    });
    let answer = output?.[0]?.generated_text?.at?.(-1)?.content || "";
    answer = answer.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    self.postMessage({ type: "answer", answer });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error?.message || "Le modèle local n'a pas pu démarrer."
    });
  }
};
